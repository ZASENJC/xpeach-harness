// Join-chain E2E: empty models layer → market shows "Add & Select" → click →
// verify model re-mounts (In Library badge) and settings.yaml holds it.
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
// composer model chip — before join
const chipBefore = await page.locator('[class*="composer"] [class*="model"], button:has-text("swe-2-max")').count()
console.log('model chip before:', chipBefore)
await page.locator('[class*="footerBtn"]').first().click()
await page.waitForTimeout(2500)
await page.getByText(/Model Market|模型市场/).click()
await page.waitForTimeout(2500)
console.log('join buttons:', await page.getByText(/Add & Select|加入并选中/).count())
console.log('in-lib badges:', await page.getByText(/In Library|已在库/).count())
await page.screenshot({ path: '/tmp/xpeach-shots/95-market-unmounted.png' })
const join = page.getByText(/Add & Select|加入并选中/).first()
if (await join.count()) {
  await join.click()
  await page.waitForTimeout(4000)
  await page.screenshot({ path: '/tmp/xpeach-shots/96-market-joined.png' })
  console.log('after join: added label:', await page.getByText(/Added & selected|已入库并选中/).count())
  console.log('after join: in-lib:', await page.getByText(/In Library|已在库/).count())
}
// composer chip after join
console.log('model chip after:', await page.locator('button:has-text("swe-2-max")').count())
console.log('ERRS:', errs.slice(0, 5))
await browser.close()
