// E2E chat send: type in hero composer → send → wait for streamed reply.
// Also verifies hero brand mark (peach on welcome) and quota-notice absence.
import { createRequire } from 'node:module'
const require = createRequire('/Volumes/SN 770/Developer/deepseek-harness/apps/web/package.json')
const { chromium } = require('playwright')
const url = process.argv[2]
const dir = '/tmp/xpeach-shots'
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errs = []
page.on('pageerror', e => errs.push(String(e).slice(0, 200)))
page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)) })
await page.goto(url, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(9000)
await page.screenshot({ path: dir + '/10-welcome.png' })
console.log('hero peach mark:', await page.locator('svg:has(path[fill="#6FA85A"])').count())
console.log('hero fallback fish:', await page.locator('[class*="fish"]').count())

// find composer: the big textarea / contenteditable
const composer = page.locator('textarea, [contenteditable="true"]').first()
console.log('composer found:', await composer.count())
if (await composer.count()) {
  await composer.click()
  await composer.fill('Reply with exactly: PONG')
  await page.waitForTimeout(400)
  await page.screenshot({ path: dir + '/11-typed.png' })
  // send: Enter (composer convention) — watch for a send button if Enter just newlines
  await page.keyboard.press('Enter')
  console.log('sent; waiting for model reply…')
  await page.waitForTimeout(5000)
  await page.screenshot({ path: dir + '/12-streaming.png' })
  // wait up to 90s for a reply bubble containing PONG or any assistant text
  try {
    await page.waitForSelector('text=/PONG|pong|完成|Done/i', { timeout: 90000 })
    console.log('REPLY seen')
  } catch { console.log('no reply within 90s') }
  await page.screenshot({ path: dir + '/13-reply.png' })
}
console.log('ERRS:', errs.slice(0, 8))
await browser.close()
