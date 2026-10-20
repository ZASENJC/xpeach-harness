/**
 * ChatGPT desktop local-data reader. The app's storage is not a published
 * format, so this module discovers its SQLite databases and reconstructs
 * threads with a schema-adaptive reader: it finds message tables (role +
 * content columns), groups rows by conversation/thread columns, reads titles
 * from a conversation table when present, and normalizes common spellings
 * (Core Data Z-prefixed columns, JSON content parts, boolean is_user).
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

export interface DbMessage {
  readonly role: 'user' | 'assistant'
  readonly text: string
  readonly time: number
}

export interface DbThread {
  readonly key: string
  readonly title: string
  readonly createdAt: number
  readonly messages: readonly DbMessage[]
}

const DB_EXTENSIONS = /.(db|sqlite|sqlite3)$/i

/** Run one read-only SQLite query and parse JSON output. */
function query(db: string, sql: string): unknown[] {
  try {
    const out = execFileSync('sqlite3', ['-readonly', '-json', db, sql], {
      encoding: 'utf8', timeout: 15_000, maxBuffer: 32 * 1024 * 1024,
    }).trim()
    if (out.length === 0) return []
    const parsed = JSON.parse(out) as unknown
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

/** Tables and their column names (lowercased, Z prefix stripped). */
function schema(db: string): { table: string, columns: Map<string, string> }[] {
  const tables = query(db, "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    .map(row => (row as { name?: unknown }).name)
    .filter((name): name is string => typeof name === 'string')
  const out: { table: string, columns: Map<string, string> }[] = []
  for (const table of tables) {
    const info = query(db, 'PRAGMA table_info(' + JSON.stringify(table) + ')')
    const columns = new Map<string, string>()
    for (const row of info) {
      const name = (row as { name?: unknown }).name
      if (typeof name !== 'string') continue
      const normalized = name.toLowerCase().replace(/^z_?/, '')
      columns.set(normalized, name)
    }
    out.push({ table, columns })
  }
  return out
}

/** First column matching any of the patterns. */
function pick(columns: Map<string, string>, patterns: readonly RegExp[]): string | undefined {
  for (const pattern of patterns) {
    for (const [normalized, original] of columns) {
      if (pattern.test(normalized)) return original
    }
  }
  return undefined
}

/** Extract readable text from a content cell (plain, JSON parts, or blocks). */
function contentText(value: unknown): string {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return contentText(JSON.parse(trimmed) as unknown)
      } catch { /* plain text that looks like JSON */ }
    }
    return trimmed
  }
  if (Array.isArray(value)) return value.map(item => contentText(item)).filter(Boolean).join('\n').trim()
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>
    for (const key of ['parts', 'text', 'content', 'body', 'value']) {
      if (record[key] !== undefined) {
        const text = contentText(record[key])
        if (text.length > 0) return text
      }
    }
  }
  return ''
}

/** Normalize a role cell. */
function roleOf(value: unknown): 'user' | 'assistant' | undefined {
  if (typeof value === 'boolean') return value ? 'user' : 'assistant'
  if (typeof value === 'number') return value === 1 ? 'user' : value === 0 ? 'assistant' : undefined
  if (typeof value !== 'string') return undefined
  const role = value.toLowerCase()
  if (role === 'user' || role === 'human' || role === 'customer') return 'user'
  if (role === 'assistant' || role === 'ai' || role === 'bot' || role === 'model' || role === 'chatgpt') return 'assistant'
  return undefined
}

/** Normalize a timestamp cell (seconds, milliseconds, or Core Data epoch). */
function timeOf(value: unknown): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  if (!Number.isFinite(n) || n <= 0) return 0
  if (n > 1e14) return Math.floor(n / 1000)
  if (n > 1e11) return Math.floor(n)
  if (n > 1e9) return Math.floor(n * 1000)
  // Core Data stores seconds since 2001-01-01.
  return Math.floor((n + 978_307_200) * 1000)
}

/** Decode one SQLite database into threads. */
export function decodeChatgptDatabase(path: string): DbThread[] {
  if (!existsSync(path)) return []
  const tables = schema(path)
  // Title table: a table with a title/name column and an id column.
  const titleTable = tables.find(table => table.columns.has('title') || table.columns.has('name'))
  const titleIdColumn = titleTable === undefined ? undefined
    : pick(titleTable.columns, [/^id$/, /(conversation|thread|chat).*id/, /^pk$/])
  const titles = new Map<string, string>()
  if (titleTable !== undefined && titleIdColumn !== undefined) {
    const titleColumn = titleTable.columns.get('title') ?? titleTable.columns.get('name')
    if (titleColumn !== undefined) {
      for (const row of query(path, 'SELECT ' + JSON.stringify(titleIdColumn) + ' AS id, ' + JSON.stringify(titleColumn) + ' AS title FROM ' + JSON.stringify(titleTable.table))) {
        const record = row as Record<string, unknown>
        const id = record['id']
        const title = record['title']
        if (id !== undefined && typeof title === 'string' && title.trim().length > 0) titles.set(String(id), title.trim())
      }
    }
  }
  const threads: DbThread[] = []
  for (const table of tables) {
    const roleColumn = pick(table.columns, [/^(role|author|sender|from|is_user|isuser|type)$/])
    const contentColumn = pick(table.columns, [/^(content|text|body|message|parts|data)$/])
    if (roleColumn === undefined || contentColumn === undefined) continue
    const idColumn = pick(table.columns, [/^id$/, /^pk$/])
    const groupColumn = pick(table.columns, [/(conversation|thread|chat|session).*(id)?/, /^conversation$/, /^thread$/])
    const timeColumn = pick(table.columns, [/^(created|timestamp|time|date|created_at|updated_at)/])
    const select = ['rowid AS __rowid']
    const aliases = new Map<string, string>()
    for (const [alias, column] of [['role', roleColumn], ['content', contentColumn], ['id', idColumn], ['group', groupColumn], ['time', timeColumn]] as const) {
      if (column !== undefined) { select.push(JSON.stringify(column) + ' AS "' + alias + '"'); aliases.set(alias, column) }
    }
    if (!aliases.has('role') || !aliases.has('content')) continue
    const rows = query(path, 'SELECT ' + select.join(', ') + ' FROM ' + JSON.stringify(table.table) + ' ORDER BY ' + (aliases.has('time') ? '5' : '__rowid'))
    const grouped = new Map<string, DbMessage[]>()
    for (const row of rows) {
      const record = row as Record<string, unknown>
      const role = roleOf(record['role'])
      const text = contentText(record['content'])
      if (role === undefined || text.length === 0) continue
      const group = record['group'] !== undefined && record['group'] !== null ? String(record['group']) : 'default'
      const time = timeOf(record['time'])
      const list = grouped.get(group) ?? []
      list.push({ role, text, time })
      grouped.set(group, list)
    }
    for (const [group, messages] of grouped) {
      if (!messages.some(message => message.role === 'user')) continue
      const createdAt = messages[0]?.time ?? Date.now()
      const title = titles.get(group) ?? (messages.find(message => message.role === 'user')?.text ?? 'ChatGPT thread').slice(0, 80)
      threads.push({ key: 'chatgpt-db:' + path + ':' + group, title: title.slice(0, 80), createdAt, messages })
    }
    // One message table is enough; later tables are usually indexes/metadata.
    break
  }
  return threads
}

/** SQLite files under the ChatGPT desktop data roots. */
export function chatgptDatabaseFiles(home: string): string[] {
  const roots = [
    join(home, 'Library', 'Application Support', 'com.openai.chat'),
    join(home, 'Library', 'Application Support', 'ChatGPT'),
    join(home, 'Library', 'Application Support', 'OpenAI', 'ChatGPT'),
    join(home, 'Library', 'Containers', 'com.openai.chat', 'Data', 'Library', 'Application Support'),
  ]
  const out: string[] = []
  const walk = (dir: string, depth: number): void => {
    if (depth > 4) return
    let entries: import('node:fs').Dirent[]
    try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const entry of entries) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) { walk(path, depth + 1); continue }
      if (DB_EXTENSIONS.test(entry.name)) out.push(path)
    }
  }
  for (const root of roots) walk(root, 0)
  return out
}
