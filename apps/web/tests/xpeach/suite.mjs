// XPeach regression suite: boots the profile (or reuses XPEACH_URL), runs
// every case-*.mjs against one browser, prints a pass table, exits nonzero on
// any failure. Usage: pnpm test:xpeach   or   XPEACH_URL=<url> pnpm test:xpeach
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { spawn } from 'node:child_process'

const dir = dirname(fileURLToPath(import.meta.url))
const root = resolve(dir, '../../..')

async function serveUrl() {
  if (process.env.XPEACH_URL) return { url: process.env.XPEACH_URL, child: null }
  console.log('booting profile xpeach …')
  const child = spawn('pnpm', ['dsh', '--profile', 'xpeach', '--no-open'], { cwd: root })
  const url = await new Promise((res, rej) => {
    let buf = ''
    const to = setTimeout(() => rej(new Error('boot timeout 45s')), 45000)
    child.stdout.on('data', d => {
      buf += String(d)
      const m = buf.match(/http:\/\/127\.0\.0\.1:\d+\/\?token=[A-Za-z0-9_-]+/)
      if (m) { clearTimeout(to); res(m[0]) }
    })
    child.stderr.on('data', d => { buf += String(d) })
    child.on('exit', c => rej(new Error('dsh exited ' + c + ': ' + buf.slice(-300))))
  })
  console.log('booted', url)
  return { url, child }
}

const { url, child } = await serveUrl()
process.env.XPEACH_URL = url

const files = readdirSync(dir).filter(f => f.startsWith('case-') && f.endsWith('.mjs')).sort()
const { boot } = await import(join(dir, 'harness.mjs'))
const { browser, page, errors } = await boot()
let closing = false
browser.on('disconnected', () => { if (!closing) { console.log('!! browser disconnected mid-suite'); process.exit(2) } })
page.on('crash', () => { console.log('!! page crashed mid-suite'); process.exit(3) })
const results = []
for (const f of files) {
  const mod = await import(join(dir, f))
  const t0 = Date.now()
  try {
    await mod.run(page, errors)
    results.push({ name: mod.name, ok: true })
    console.log('PASS', mod.name, (Date.now() - t0) + 'ms')
  } catch (e) {
    results.push({ name: mod.name, ok: false })
    console.log('FAIL', mod.name, '::', String((e && (e.message || e)) || e).slice(0, 160))
  }
}
closing = true
await browser.close()
if (child) child.kill('SIGTERM')
const fails = results.filter(r => !r.ok)
console.log('\n=== ' + (results.length - fails.length) + '/' + results.length + ' passed ===')
process.exit(fails.length ? 1 : 0)
