import { createRequire } from 'node:module'
const require = createRequire('/Volumes/SN 770/Developer/deepseek-harness/apps/web/package.json')
const { chromium } = require('playwright')
const url = process.argv[2]
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto(url, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(9000)
const chip = page.locator('button').filter({ hasText: 'swe-2-max' }).first()
console.log('chip:', await chip.count())
if (await chip.count()) { await chip.click(); await page.waitForTimeout(2500) }
await page.screenshot({ path: '/tmp/xpeach-shots/97-picker.png' })
const txt = await page.evaluate(() => document.body.innerText)
console.log('mutate-e2e in picker:', /peach-mutate-e2e/.test(txt))
await browser.close()
