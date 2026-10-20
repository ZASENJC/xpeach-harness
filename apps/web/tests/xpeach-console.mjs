// Console E2E: footer → tab → market segment → try a model → join flow probe.
import { createRequire } from 'node:module'
const require = createRequire('/Volumes/SN 770/Developer/deepseek-harness/apps/web/package.json')
const { chromium } = require('playwright')
const url = process.argv[2]
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errs = []
page.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await page.goto(url, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(9000)
// open console via footer
await page.locator('[class*="footerBtn"]').first().click()
await page.waitForTimeout(3000)
console.log('tab root:', await page.locator('[class*="tabRoot"]').count())
console.log('segments:', await page.locator('[class*="segRow"] button').count())
await page.screenshot({ path: '/tmp/xpeach-shots/80-console-overview.png' })
// market segment
await page.getByText(/Model Market|模型市场/).click()
await page.waitForTimeout(2500)
console.log('market rows:', await page.locator('[class*="marketRow"]').count())
console.log('search input:', await page.locator('[class*="marketSearch"]').count())
await page.screenshot({ path: '/tmp/xpeach-shots/81-console-market.png' })
// try first model
const tryBtn = page.getByText(/^Try$|^试用$/).first()
if (await tryBtn.count()) {
  await tryBtn.click()
  await page.waitForTimeout(500)
  await page.locator('[class*="playInput"]').fill('Reply with the single word: PONG')
  await page.locator('[class*="playRun"]').click()
  await page.waitForTimeout(20000)
  console.log('reply box:', await page.locator('[class*="playReply"]').count())
  const reply = await page.locator('[class*="playText"]').innerText().catch(() => '')
  console.log('reply:', reply.slice(0, 60))
  await page.screenshot({ path: '/tmp/xpeach-shots/82-playground.png' })
}
console.log('ERRS:', errs.slice(0, 5))
await browser.close()
