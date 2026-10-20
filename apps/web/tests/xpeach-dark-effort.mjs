// Dark-mode + model/effort pane probe.
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
// flip theme to dark via theme service — emulate prefers + find appearance setting
await page.emulateMedia({ colorScheme: 'dark' })
await page.waitForTimeout(1200)
await page.screenshot({ path: dir + '/20-dark.png' })
// model picker: click the model button in composer
const modelBtn = page.locator('button:has-text("swe-2-max"), [class*="model"]').last()
console.log('model picker btn:', await modelBtn.count())
if (await modelBtn.count()) {
  await modelBtn.click()
  await page.waitForTimeout(1500)
  await page.screenshot({ path: dir + '/21-model-picker.png' })
  const panelText = await page.evaluate(() => document.body.innerText)
  const effort = panelText.match(/effort|思考|强度|low|high|max|off/gi)
  console.log('effort mentions:', JSON.stringify(effort?.slice(0, 10)))
  // click an effort pane row if visible
}
console.log('ERRS:', errs.slice(0, 5))
await browser.close()
