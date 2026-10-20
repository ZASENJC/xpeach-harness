// Real session E2E: type into composer, send, wait for model reply via relay.
import { createRequire } from 'node:module'
const require = createRequire('/Volumes/SN 770/Developer/deepseek-harness/apps/web/package.json')
const { chromium } = require('playwright')
const url = process.argv[2]
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto(url, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(11000)
const input = page.locator('[contenteditable="true"], [role="textbox"]').first()
console.log('composer found:', await input.count())
await input.click()
await input.pressSequentially('Reply with exactly: PEACH_OK')
// send button: the round arrow at composer right — try aria-labels then Enter
let sent = false
for (const sel of ['button[aria-label*="end"]', 'button[title*="end"]', 'button[kind="submit"]']) {
  if (await page.locator(sel).count()) { await page.locator(sel).first().click(); sent = true; console.log('sent via', sel); break }
}
if (!sent) { await input.press('Enter'); console.log('sent via Enter') }
for (let i = 0; i < 16; i++) {
  await page.waitForTimeout(5000)
  const bt = await page.locator('body').innerText()
  const n = (bt.match(/PEACH_OK/g) || []).length
  if (n > 1) { console.log('REPLIED @iter', i); break }
  if (i % 4 === 3) console.log('waiting', i)
}
await page.screenshot({ path: '/tmp/xpeach-shots/D2-session.png' })
const bt = await page.locator('body').innerText()
const i = bt.lastIndexOf('PEACH_OK')
console.log('tail:', bt.slice(Math.max(0, i - 300), i + 60).replace(/\n/g, ' | '))
await browser.close()
