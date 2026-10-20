import { chromium } from 'playwright'
const h = await import('./harness.mjs')
const cs = await import('./case-session.mjs')
const b = await chromium.launch({ headless: true })
const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
await p.goto(process.env.XPEACH_URL, { waitUntil: 'domcontentloaded' })
await p.waitForTimeout(10000)
await h.openConsole(p)     // residue: console panel selected
await p.waitForTimeout(2000)
try { await cs.run(p); console.log('SESSION PASS') }
catch (e) {
  console.log('SESSION FAIL:', String(e).slice(0, 200))
  await p.screenshot({ path: '/tmp/xpeach-shots/G7-session-fail.png' })
  console.log('body tail:', (await p.evaluate(() => document.body.innerText)).slice(-300).replace(/\n/g,' | '))
}
await b.close()
