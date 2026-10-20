// Right-pane XPeach console tab E2E.
import { createRequire } from 'node:module'
const require = createRequire('/Volumes/SN 770/Developer/deepseek-harness/apps/web/package.json')
const { chromium } = require('playwright')
const url = process.argv[2]
const dir = '/tmp/xpeach-shots'
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errs = []
page.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await page.goto(url, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(9000)
console.log('footer btn:', await page.locator('[class*="footerBtn"]').count())
await page.screenshot({ path: dir + '/40-footer.png' })
if (await page.locator('[class*="footerBtn"]').count()) {
  await page.locator('[class*="footerBtn"]').first().click()
  await page.waitForTimeout(5000)
  await page.screenshot({ path: dir + '/41-console-tab.png' })
  console.log('tab root:', await page.locator('[class*="tabRoot"]').count())
  console.log('usage cells:', await page.locator('[class*="tabRoot"] [class*="usageCell"]').count())
  await page.getByText(/Call Logs|调用日志/).click()
  await page.waitForTimeout(1500)
  console.log('log rows:', await page.locator('[class*="tabLogs"] li').count())
}
console.log('ERRS:', errs.slice(0, 5))
await browser.close()
