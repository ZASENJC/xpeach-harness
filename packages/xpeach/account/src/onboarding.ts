/**
 * First-run onboarding: silently detect local conversation stores and agent
 * assets, then import the ones the user picks. Conversation threads from
 * Claude Code / Codex / zcode are decoded into native XPeach session logs
 * (v4 JSONL, concatenated zstd frames: one header frame + one event frame).
 */
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { zstdCompressSync, zstdDecompressSync } from 'node:zlib'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'
import { chatgptDatabaseFiles, decodeChatgptDatabase } from './chatgpt-db.ts'

import type {
  XPeachAssetImportResult, XPeachConversationImportResult, XPeachDetectedMcp, XPeachDetectedPrompt,
  XPeachDetectedSkill, XPeachDetectedSource, XPeachOnboardingScan, XPeachSourceId,
} from './types.ts'

/** One decoded conversation thread (internal to the importer). */
interface ImportedThread {
  readonly title: string
  readonly cwd?: string
  readonly createdAt: number
  readonly messages: readonly { readonly role: 'user' | 'assistant', readonly text: string, readonly time: number }[]
}

/** The OS user home. */
const home = (): string => homedir()

/** Directory that holds one product's session logs. */
const paths = (): Record<XPeachSourceId, string> => ({
  deepseek: join(home(), '.dsh', 'sessions'),
  claude: join(home(), '.claude', 'projects'),
  codex: join(home(), '.codex', 'sessions'),
  zcode: join(home(), '.zcode', 'v2', 'sessions'),
  chatgpt: join(home(), 'Library', 'Application Support', 'ChatGPT'),
})

/** Count matching files under a root (bounded walk). */
function countFiles(root: string, match: (name: string) => boolean, maxDepth = 5): number {
  if (!existsSync(root)) return 0
  let count = 0
  const walk = (dir: string, depth: number): void => {
    if (depth > maxDepth) return
    let entries: import('node:fs').Dirent[]
    try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const entry of entries) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) walk(path, depth + 1)
      else if (match(entry.name)) count += 1
    }
  }
  walk(root, 0)
  return count
}

/** Read a file if it exists, else undefined. */
function readText(path: string): string | undefined {
  try { return readFileSync(path, 'utf8') } catch { return undefined }
}

/** Parse JSON if it exists and is an object. */
function readJson(path: string): Record<string, unknown> | undefined {
  const text = readText(path)
  if (text === undefined) return undefined
  try {
    const value = JSON.parse(text) as unknown
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined
  } catch { return undefined }
}

/** MCP servers declared by the local agents. */
function scanMcp(): XPeachDetectedMcp[] {
  const out: XPeachDetectedMcp[] = []
  const push = (source: string, servers: unknown): void => {
    if (servers === null || typeof servers !== 'object') return
    for (const [name, config] of Object.entries(servers as Record<string, unknown>)) {
      if (config !== null && typeof config === 'object' && !Array.isArray(config)) {
        out.push({ source, name, config: config as Record<string, JsonValue> })
      }
    }
  }
  const claude = readJson(join(home(), '.claude.json'))
  push('claude', claude?.['mcpServers'])
  const cursor = readJson(join(home(), '.cursor', 'mcp.json'))
  push('cursor', cursor?.['mcpServers'])
  const zcode = readJson(join(home(), '.zcode', 'cli', 'config.json'))
  push('zcode', zcode?.['mcpServers'])
  // Codex TOML: a light [mcp_servers.NAME] scan is enough for the command/args/env trio.
  const toml = readText(join(home(), '.codex', 'config.toml'))
  if (toml !== undefined) {
    let current: Record<string, unknown> | undefined
    for (const line of toml.split('\n')) {
      const header = /^\[mcp_servers\.([^\]]+)\]\s*$/.exec(line)
      if (header !== null) {
        const name = header[1] as string
        current = {}
        out.push({ source: 'codex', name, config: current as Record<string, JsonValue> })
        continue
      }
      if (line.startsWith('[')) { current = undefined; continue }
      const pair = /^\s*([A-Za-z0-9_]+)\s*=\s*(.+)$/.exec(line)
      if (pair === null || current === undefined) continue
      const key = pair[1] as string
      const raw = (pair[2] as string).trim()
      try { current[key] = JSON.parse(raw) as JsonValue } catch { current[key] = raw.replace(/^['"]|['"]$/g, '') }
    }
  }
  return out
}

/** Skill directories across the local agents. */
function scanSkills(): XPeachDetectedSkill[] {
  const out: XPeachDetectedSkill[] = []
  for (const [source, root] of [
    ['claude', join(home(), '.claude', 'skills')],
    ['codex', join(home(), '.codex', 'skills')],
    ['zcode', join(home(), '.zcode', 'skills')],
  ] as const) {
    if (!existsSync(root)) continue
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const path = join(root, entry.name)
      if (!existsSync(join(path, 'SKILL.md'))) continue
      out.push({ source, name: entry.name, path })
    }
  }
  return out
}

/** User-global instruction files. */
function scanPrompts(): XPeachDetectedPrompt[] {
  const out: XPeachDetectedPrompt[] = []
  for (const [source, path] of [
    ['codex', join(home(), '.codex', 'AGENTS.md')],
    ['claude', join(home(), '.claude', 'CLAUDE.md')],
    ['zcode', join(home(), '.zcode', 'AGENTS.md')],
  ] as const) {
    const text = readText(path)
    if (text === undefined || text.trim().length === 0) continue
    out.push({ source, path, preview: text.trim().slice(0, 200) })
  }
  return out
}

/** Silent first-run detection. */
export function scanOnboarding(): XPeachOnboardingScan {
  const p = paths()
  const sources: XPeachDetectedSource[] = [
    { id: 'deepseek', label: 'DeepSeek Harness', path: p.deepseek, found: false, threads: 0 },
    { id: 'claude', label: 'Claude Code', path: p.claude, found: false, threads: 0 },
    { id: 'codex', label: 'Codex', path: p.codex, found: false, threads: 0 },
    { id: 'zcode', label: 'zcode', path: p.zcode, found: false, threads: 0 },
    { id: 'chatgpt', label: 'ChatGPT desktop', path: p.chatgpt, found: false, threads: 0 },
  ]
  const chatgptExports = chatgptExportFiles()
  const chatgptDatabases = chatgptDatabaseFiles(home())
  const chatgptDbThreads = chatgptDatabases.reduce((sum, path) => sum + decodeChatgptDatabase(path).length, 0)
  const counts: Record<XPeachSourceId, number> = {
    deepseek: countFiles(p.deepseek, name => /^session\.v\d+\.jsonl(\.zstd)?$/.test(name)),
    claude: countFiles(p.claude, name => name.endsWith('.jsonl')),
    codex: countFiles(p.codex, name => /^rollout-.*\.jsonl\.zst$/.test(name)),
    zcode: countFiles(p.zcode, name => name.endsWith('.json')),
    chatgpt: chatgptExports.reduce((sum, path) => sum + decodeChatgptExport(path).length, 0) + chatgptDbThreads,
  }
  for (const source of sources) {
    const threads = counts[source.id]
    source.found = source.id === 'chatgpt' ? threads > 0 : existsSync(p[source.id]) && threads > 0
    source.threads = threads
    if (source.id === 'chatgpt') {
      if (threads > 0) source.detail = chatgptExports[0] ?? chatgptDatabases[0] ?? 'conversations.json'
      else if (existsSync(p.chatgpt)) source.detail = 'desktop data detected but no readable conversations found'
    }
  }
  return { sources, mcp: scanMcp(), skills: scanSkills(), prompts: scanPrompts() }
}

/* ---------- conversation decoding ---------- */

/** Harness-injected context rows that are not human turns. */
function isInjected(text: string): boolean {
  const value = text.trim()
  return value.startsWith('<environment_context')
    || value.startsWith('<permissions instructions')
    || value.startsWith('<system-reminder')
    || value.startsWith('Current runtime context')
}

/** First human user message, used as the imported thread title. */
function humanTitle(messages: readonly { role: 'user' | 'assistant', text: string }[], fallback: string): string {
  const human = messages.find(message => message.role === 'user' && !isInjected(message.text))
  return (human?.text ?? fallback).slice(0, 80)
}

/** Claude Code transcript: JSONL of user/assistant envelopes. */
function decodeClaude(path: string): ImportedThread | undefined {
  const text = readText(path)
  if (text === undefined) return undefined
  const messages: { role: 'user' | 'assistant', text: string, time: number }[] = []
  let createdAt: number | undefined
  for (const line of text.split('\n')) {
    if (line.trim().length === 0) continue
    let event: Record<string, unknown>
    try { event = JSON.parse(line) as Record<string, unknown> } catch { continue }
    const type = event['type']
    if (type !== 'user' && type !== 'assistant') continue
    const message = event['message'] as Record<string, unknown> | undefined
    if (message === undefined) continue
    const content = message['content']
    const parts: string[] = []
    if (typeof content === 'string') parts.push(content)
    else if (Array.isArray(content)) {
      for (const block of content) {
        if (block !== null && typeof block === 'object' && (block as Record<string, unknown>)['type'] === 'text') {
          const t = (block as Record<string, unknown>)['text']
          if (typeof t === 'string' && t.length > 0) parts.push(t)
        }
      }
    }
    const body = parts.join('\n').trim()
    if (body.length === 0) continue
    if (type === 'user' && isInjected(body)) continue
    const timestamp = typeof event['timestamp'] === 'string' ? Date.parse(event['timestamp']) : NaN
    const time = Number.isFinite(timestamp) ? timestamp : Date.now()
    if (createdAt === undefined) createdAt = time
    messages.push({ role: type === 'user' ? 'user' : 'assistant', text: body, time })
  }
  if (!messages.some(m => m.role === 'user')) return undefined
  const cwd = typeof (JSON.parse(text.split('\n').find(l => l.includes('"cwd"')) ?? '{}') as Record<string, unknown>)['cwd'] === 'string'
    ? ((JSON.parse(text.split('\n').find(l => l.includes('"cwd"')) ?? '{}') as Record<string, unknown>)['cwd'] as string)
    : undefined
  return { title: humanTitle(messages, 'Claude Code thread'), ...(cwd !== undefined ? { cwd } : {}), createdAt: createdAt ?? Date.now(), messages }
}

/** Codex rollout: zstd JSONL with session_meta + response_item messages. */
function decodeCodex(path: string): ImportedThread | undefined {
  let text: string
  try { text = zstdDecompressSync(readFileSync(path)).toString('utf8') } catch { return undefined }
  const messages: { role: 'user' | 'assistant', text: string, time: number }[] = []
  let cwd: string | undefined
  let createdAt: number | undefined
  for (const line of text.split('\n')) {
    if (line.trim().length === 0) continue
    let event: Record<string, unknown>
    try { event = JSON.parse(line) as Record<string, unknown> } catch { continue }
    const payload = event['payload'] as Record<string, unknown> | undefined
    if (payload === undefined) continue
    if (event['type'] === 'session_meta') {
      if (typeof payload['cwd'] === 'string') cwd = payload['cwd']
      if (typeof payload['timestamp'] === 'string') {
        const t = Date.parse(payload['timestamp'])
        if (Number.isFinite(t)) createdAt = t
      }
      continue
    }
    if (event['type'] !== 'response_item' || payload['type'] !== 'message') continue
    const role = payload['role']
    if (role !== 'user' && role !== 'assistant') continue
    const content = payload['content']
    const parts: string[] = []
    if (Array.isArray(content)) {
      for (const block of content) {
        if (block !== null && typeof block === 'object') {
          const b = block as Record<string, unknown>
          if (b['type'] === 'input_text' || b['type'] === 'output_text') {
            const t = b['text']
            if (typeof t === 'string' && t.length > 0) parts.push(t)
          }
        }
      }
    }
    const body = parts.join('\n').trim()
    if (body.length === 0) continue
    if (role === 'user' && isInjected(body)) continue
    const time = typeof event['timestamp'] === 'string' ? Date.parse(event['timestamp']) : NaN
    messages.push({ role, text: body, time: Number.isFinite(time) ? time : Date.now() })
  }
  if (!messages.some(m => m.role === 'user')) return undefined
  return { title: humanTitle(messages, 'Codex thread'), ...(cwd !== undefined ? { cwd } : {}), createdAt: createdAt ?? Date.now(), messages }
}

/** zcode session: { meta, messages } JSON. */
function decodeZcode(path: string): ImportedThread | undefined {
  const value = readJson(path)
  if (value === undefined) return undefined
  const meta = value['meta'] as Record<string, unknown> | undefined
  const raw = value['messages']
  if (!Array.isArray(raw)) return undefined
  const messages: { role: 'user' | 'assistant', text: string, time: number }[] = []
  for (const item of raw) {
    if (item === null || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const role = row['role']
    if (role !== 'user' && role !== 'assistant') continue
    const content = row['content']
    const text = typeof content === 'string' ? content : Array.isArray(content)
      ? content.map(b => b !== null && typeof b === 'object' && typeof (b as Record<string, unknown>)['text'] === 'string' ? (b as Record<string, unknown>)['text'] as string : '').join('\n')
      : ''
    if (text.trim().length === 0) continue
    const time = typeof row['timestamp'] === 'number' ? row['timestamp'] : Date.now()
    messages.push({ role, text: text.trim(), time })
  }
  if (!messages.some(m => m.role === 'user')) return undefined
  const title = typeof meta?.['title'] === 'string' && (meta['title'] as string).length > 0 ? meta['title'] as string : (messages.find(m => m.role === 'user')?.text ?? 'zcode thread').slice(0, 80)
  const cwd = typeof meta?.['workspacePath'] === 'string' ? meta['workspacePath'] as string : undefined
  const createdAt = typeof meta?.['createdAt'] === 'number' ? meta['createdAt'] as number : Date.now()
  return { title, ...(cwd !== undefined ? { cwd } : {}), createdAt, messages }
}

/** Official ChatGPT export files the user may have downloaded. */
function chatgptExportFiles(): string[] {
  return [
    join(home(), 'Downloads', 'conversations.json'),
    join(home(), 'Desktop', 'conversations.json'),
    join(home(), 'Documents', 'conversations.json'),
  ].filter(path => existsSync(path))
}

/** Decode one ChatGPT export file into threads (current-node parent chain). */
function decodeChatgptExport(path: string): { key: string, thread: ImportedThread }[] {
  const text = readText(path)
  if (text === undefined) return []
  let value: unknown
  try { value = JSON.parse(text) } catch { return [] }
  if (!Array.isArray(value)) return []
  const out: { key: string, thread: ImportedThread }[] = []
  for (const item of value) {
    if (item === null || typeof item !== 'object') continue
    const conversation = item as Record<string, unknown>
    const mapping = conversation['mapping']
    if (mapping === null || typeof mapping !== 'object') continue
    const nodes = mapping as Record<string, unknown>
    const chain: Record<string, unknown>[] = []
    let nodeId = typeof conversation['current_node'] === 'string' ? conversation['current_node'] as string : undefined
    const seen = new Set<string>()
    while (nodeId !== undefined && nodes[nodeId] !== undefined && !seen.has(nodeId)) {
      seen.add(nodeId)
      const node = nodes[nodeId] as Record<string, unknown>
      chain.push(node)
      nodeId = typeof node['parent'] === 'string' ? node['parent'] as string : undefined
    }
    chain.reverse()
    const messages: { role: 'user' | 'assistant', text: string, time: number }[] = []
    for (const node of chain) {
      const message = node['message']
      if (message === null || typeof message !== 'object') continue
      const row = message as Record<string, unknown>
      const author = row['author'] as Record<string, unknown> | undefined
      const role = author?.['role']
      if (role !== 'user' && role !== 'assistant') continue
      const content = row['content'] as Record<string, unknown> | undefined
      const parts = Array.isArray(content?.['parts']) ? content?.['parts'] as unknown[] : []
      const body = parts.filter((part): part is string => typeof part === 'string').join('\n').trim()
      if (body.length === 0 || (role === 'user' && isInjected(body))) continue
      const time = typeof row['create_time'] === 'number' ? (row['create_time'] as number) * 1000 : Date.now()
      messages.push({ role, text: body, time })
    }
    if (!messages.some(message => message.role === 'user')) continue
    const createdAt = typeof conversation['create_time'] === 'number'
      ? (conversation['create_time'] as number) * 1000
      : messages[0]?.time ?? Date.now()
    const rawTitle = typeof conversation['title'] === 'string' ? (conversation['title'] as string).trim() : ''
    const title = (rawTitle.length > 0 ? rawTitle : humanTitle(messages, 'ChatGPT thread')).slice(0, 80)
    const id = typeof conversation['id'] === 'string' ? conversation['id'] as string : title + ':' + createdAt
    out.push({ key: 'chatgpt:' + id, thread: { title, createdAt, messages } })
  }
  return out
}

/** Every thread path for one source. */
function threadPaths(source: XPeachSourceId): string[] {
  const p = paths()
  const out: string[] = []
  const walk = (dir: string, depth: number): void => {
    if (depth > 6 || !existsSync(dir)) return
    let entries: import('node:fs').Dirent[]
    try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const entry of entries) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) { walk(path, depth + 1); continue }
      if (source === 'claude' && entry.name.endsWith('.jsonl')) out.push(path)
      if (source === 'codex' && /^rollout-.*\.jsonl\.zst$/.test(entry.name)) out.push(path)
      if (source === 'zcode' && entry.name.endsWith('.json')) out.push(path)
    }
  }
  walk(p[source], 0)
  return out
}

/** Session project directory key (mirrors the persistence slug). */
function projectKey(cwd: string): string {
  let out = ''
  let separator = false
  for (const ch of cwd) {
    if (ch === '/' || ch === '\\' || ch === ':') { if (!separator) out += '-'; separator = true; continue }
    if (ch !== '~' && /^[A-Za-z0-9._-]$/.test(ch)) { out += ch; separator = false; continue }
    out += '~' + ch.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')
    separator = false
  }
  const slug = out.replace(/^-+/, '') || 'root'
  return `--${slug.slice(0, 251)}--`
}

/** Write one decoded thread as a native v4 session log. */
function writeSession(root: string, thread: ImportedThread): string {
  const cwd = thread.cwd ?? join(home(), 'XPeach Imported')
  // A real directory gives the workspace bootstrap a home for cwd-less imports.
  if (thread.cwd === undefined) { try { mkdirSync(cwd, { recursive: true }) } catch { /* best effort */ } }
  const id = 'session-' + randomUUID()
  const dir = join(root, projectKey(cwd), id)
  mkdirSync(dir, { recursive: true })
  const events: Record<string, unknown>[] = []
  let seq = 0
  const time = (offset: number): number => thread.createdAt + offset
  const push = (type: string, data: Record<string, unknown>, extra: Record<string, unknown> = {}): number => {
    const current = seq
    events.push({ type, seq: seq++, time: time(seq * 1000), data, ...extra })
    return current
  }
  push('permission/preset', { preset: 'danger-full-access' })
  push('sandbox/mode', { mode: 'danger-full-access' })
  push('approval/policy', { policy: 'never' })
  push('session/end-seed', {})
  // Group messages into turns: one user message plus the assistants that follow.
  const turns: { user?: { text: string, time: number }, assistants: { text: string, time: number }[] }[] = []
  for (const message of thread.messages) {
    if (message.role === 'user') {
      turns.push({ user: { text: message.text, time: message.time }, assistants: [] })
    } else {
      if (turns.length === 0) turns.push({ assistants: [] })
      turns[turns.length - 1]!.assistants.push({ text: message.text, time: message.time })
    }
  }
  let turn = 0
  let titleWritten = false
  for (const current of turns) {
    if (current.user === undefined && current.assistants.length === 0) continue
    turn += 1
    push('turn/start', { turn })
    let step = 0
    if (current.user !== undefined) {
      step = 1
      push('step/start', { turn, step })
      const userSeq = push('user/message', {
        content: [{ type: 'text', text: current.user.text }],
        source: { kind: 'user', rpcId: randomUUID() },
        role: 'user',
        id: randomUUID(),
      }, { surfaceOp: 'append' })
      if (!titleWritten) {
        titleWritten = true
        push('session/title', { title: thread.title, messageSeqs: [userSeq], source: { kind: 'fallback' } })
      }
      if (current.assistants.length === 0) push('step/end', { turn, step })
    }
    for (const assistant of current.assistants) {
      if (step === 0) {
        step = 1
        push('step/start', { turn, step })
      } else if (step !== 1 || current.user === undefined) {
        step += 1
        push('step/start', { turn, step })
      }
      push('assistant/message', {
        turn,
        step,
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: assistant.text }],
          source: { kind: 'model', provider: 'imported', model: 'imported' },
          id: randomUUID(),
        },
        usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, totalTokens: 0 },
        stream: [],
      }, { surfaceOp: 'append' })
      push('step/end', { turn, step })
    }
    push('turn/end', { turn, reason: { kind: 'completed' } })
  }
  if (!titleWritten) {
    const firstUser = events.find(event => event['type'] === 'user/message')
    if (firstUser !== undefined) push('session/title', { title: thread.title, messageSeqs: [firstUser['seq'] as number], source: { kind: 'fallback' } })
  }
  const header = JSON.stringify({ type: 'session', version: 4, id, createdAt: thread.createdAt, cwd, isSeeded: false, delegationDepth: 0, agentPreset: 'ptc' }) + '\n'
  const body = events.map(event => JSON.stringify(event)).join('\n') + '\n'
  const headerFrame = zstdCompressSync(Buffer.from(header))
  const bodyFrame = zstdCompressSync(Buffer.from(body))
  writeFileSync(join(dir, 'session.v4.jsonl.zstd'), Buffer.concat([headerFrame, bodyFrame]))
  return join(dir, 'session.v4.jsonl.zstd')
}

/** Decode + import one source's threads into the XPeach session root. */
export function importConversations(source: XPeachSourceId, root: string): XPeachConversationImportResult {
  if (source === 'deepseek') {
    // DeepSeek logs are already native: copy session directories, never overwrite.
    const src = paths().deepseek
    if (!existsSync(src)) return { source, imported: 0, skipped: 0, error: 'not found' }
    let imported = 0
    let skipped = 0
    const walk = (dir: string, depth: number): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue
        const path = join(dir, entry.name)
        if (entry.name.startsWith('session-')) {
          const dest = join(root, basename(dir), entry.name)
          if (existsSync(dest)) { skipped += 1; continue }
          cpSync(path, dest, { recursive: true, force: false, filter: f => !f.endsWith('session.lock') })
          imported += 1
          continue
        }
        if (depth < 2) walk(path, depth + 1)
      }
    }
    walk(src, 0)
    return { source, imported, skipped }
  }
  const chatgptDbFiles = source === 'chatgpt' ? chatgptDatabaseFiles(home()) : []
  if (source === 'chatgpt' && chatgptExportFiles().length === 0 && chatgptDbFiles.length === 0) {
    return { source, imported: 0, skipped: 0, error: 'ChatGPT desktop data not found; export conversations.json or install the desktop app' }
  }
  const homeRoot = dirname(root)
  const indexFile = join(homeRoot, '.xpeach-imported.json')
  let index: Record<string, string[]> = {}
  try {
    const parsed = JSON.parse(readText(indexFile) ?? '{}') as unknown
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) index = parsed as Record<string, string[]>
  } catch { index = {} }
  const seen = new Set(index[source] ?? [])
  let imported = 0
  let skipped = 0
  const record = (key: string): void => { seen.add(key) }
  if (source === 'chatgpt') {
    for (const path of chatgptExportFiles()) {
      for (const { key, thread } of decodeChatgptExport(path)) {
        if (seen.has(key)) { skipped += 1; continue }
        try { writeSession(root, thread); record(key); imported += 1 } catch { skipped += 1 }
      }
    }
    for (const path of chatgptDbFiles) {
      for (const thread of decodeChatgptDatabase(path)) {
        if (seen.has(thread.key)) { skipped += 1; continue }
        try { writeSession(root, thread); record(thread.key); imported += 1 } catch { skipped += 1 }
      }
    }
  } else {
    const decode = source === 'claude' ? decodeClaude : source === 'codex' ? decodeCodex : decodeZcode
    for (const path of threadPaths(source)) {
      let key = path
      try { key = path + ':' + Math.floor(statSync(path).mtimeMs) } catch { /* unreadable */ }
      if (seen.has(key)) { skipped += 1; continue }
      const thread = decode(path)
      if (thread === undefined) { skipped += 1; continue }
      try { writeSession(root, thread); record(key); imported += 1 } catch { skipped += 1 }
    }
  }
  index[source] = [...seen]
  try { writeFileSync(indexFile, JSON.stringify(index), { mode: 0o600 }) } catch { /* best effort */ }
  return { source, imported, skipped }
}

/** Copy skills, merge prompts, and append MCP rows to the profile patch. */
export function importAssets(
  selection: { readonly mcp: boolean, readonly skills: boolean, readonly prompts: boolean },
  home_: string,
  profilePatch: string,
): XPeachAssetImportResult {
  const scan = scanOnboarding()
  const errors: string[] = []
  let mcp = 0
  let skills = 0
  let prompts = 0
  if (selection.skills) {
    const root = join(home_, 'skills')
    for (const skill of scan.skills) {
      const dest = join(root, skill.name)
      if (existsSync(dest)) continue
      try { mkdirSync(root, { recursive: true }); cpSync(skill.path, dest, { recursive: true, force: false }); skills += 1 } catch (error) {
        errors.push('skill ' + skill.name + ': ' + String(error))
      }
    }
  }
  if (selection.prompts) {
    const dest = join(home_, 'AGENTS.md')
    const parts: string[] = []
    for (const prompt of scan.prompts) {
      const text = readText(prompt.path)
      if (text === undefined || text.trim().length === 0) continue
      parts.push('<!-- imported from ' + prompt.path + ' -->\n' + text.trim())
    }
    if (parts.length > 0) {
      const existing = readText(dest)
      const merged = (existing === undefined ? '' : existing.trimEnd() + '\n\n') + parts.join('\n\n---\n\n') + '\n'
      try { writeFileSync(dest, merged); prompts = parts.length } catch (error) { errors.push('prompts: ' + String(error)) }
    }
  }
  if (selection.mcp && scan.mcp.length > 0) {
    const rows: string[] = []
    for (const server of scan.mcp) {
      const config = server.config
      const command = typeof config['command'] === 'string' ? config['command'] : undefined
      const url = typeof config['url'] === 'string' ? config['url'] : undefined
      if (command === undefined && url === undefined) continue
      const id = 'mcp-' + server.name.replace(/[^A-Za-z0-9._-]+/g, '-').toLowerCase()
      const lines = [
        '    - id: ' + id,
        "      name: '@deepseek-ai/dsh-mcp-client'",
        '      config:',
        '        transport: ' + (url !== undefined ? 'streamable-http' : 'stdio'),
        '        serverName: ' + JSON.stringify(server.name),
        '        failOnStartupError: false',
      ]
      if (command !== undefined) lines.push('        command: ' + JSON.stringify(command))
      if (url !== undefined) lines.push('        url: ' + JSON.stringify(url))
      if (Array.isArray(config['args'])) lines.push('        args: ' + JSON.stringify(config['args']))
      if (config['env'] !== null && typeof config['env'] === 'object') {
        const env = Object.fromEntries(Object.entries(config['env'] as Record<string, unknown>).filter(([, value]) => typeof value === 'string'))
        if (Object.keys(env).length > 0) lines.push('        env: ' + JSON.stringify(env))
      }
      rows.push(lines.join('\n'))
      mcp += 1
    }
    if (rows.length > 0) {
      try {
        const existing = readText(profilePatch)
        if (existing !== undefined && !existing.includes('dsh-mcp-client')) {
          writeFileSync(profilePatch, existing.trimEnd() + '\n- insert:\n' + rows.join('\n') + '\n')
        }
      } catch (error) { errors.push('mcp: ' + String(error)) }
    }
  }
  return { mcp, skills, prompts, errors }
}
