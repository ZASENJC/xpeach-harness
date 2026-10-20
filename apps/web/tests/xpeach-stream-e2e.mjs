// Streaming playground E2E: open a playground, run, sample the reply box
// mid-flight to verify incremental rendering, then final content.
import { createRequire } from 'node:module'
const require = createRequire('/Volumes/SN 770/Developer/deepseek-harness/apps/web/package.json')
const { chromium } = require('playwright')
const url = process.argv[2]
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errs = []
page.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await page.goto(url, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(10000)
if (!await page.locator('[class*="segRow"]').count()) { await page.locator('[class*="footerBtn"]').first().click(); await page.waitForTimeout(4500) }
await page.getByText(/Model Market|模型市场/).click()
await page.waitForTimeout(2000)
await page.getByText(/Try|试用/).first().click()
await page.waitForTimeout(1500)
// set a longer prompt to make streaming visible
const ta = page.locator('[class*="playInput"]')
await ta.fill('Tell me a short story about a peach in 3 sentences.')
await page.getByText(/^Run$|^运行$/).click()
// sample at intervals to catch streaming state
for (let i = 0; i < 6; i++) {
  await page.waitForTimeout(1200)
  const txt = await page.locator('[class*="playReply"]').innerText().catch(() => '')
  console.log('t' + i + ': len=' + txt.length + ' | ' + txt.slice(0, 60).replace(/\n/g, ' '))
}
await page.waitForTimeout(8000)
await page.screenshot({ path: '/tmp/xpeach-shots/B7-stream.png' })
const final = await page.locator('[class*="playReply"]').innerText().catch(() => 'NONE')
console.log('FINAL:', final.slice(0, 300))
console.log('ERRS:', errs.slice(0, 3))
await browser.close()
