import { chromium } from 'playwright'
const h = await import('./harness.mjs')
const cs = await import('./case-tools.mjs')
const b = await chromium.launch({ headless: true })
const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
await p.goto(process.env.XPEACH_URL, { waitUntil: 'domcontentloaded' })
await p.waitForTimeout(10000)
await h.openConsole(p)
try { await cs.run(p, []); console.log('TOOLS PASS') }
catch (e) {
  console.log('TOOLS FAIL:', String(e).slice(0, 300))
  await p.screenshot({ path: '/tmp/xpeach-shots/G5-tools-fail.png' })
}
await b.close()
