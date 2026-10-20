// Craft verification: open pill after a billed call — masked key, today
// spend, sparkline, relative times, console link.
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
await page.locator('[class*="pillRoot"] button').first().click()
await page.waitForTimeout(6000)
await page.screenshot({ path: '/tmp/xpeach-shots/60-pill-craft.png' })
console.log('mask line:', await page.locator('[class*="maskLine"]').count())
console.log('spark svg:', await page.locator('[class*="spark"] rect').count())
console.log('today cell:', await page.locator('text=Today, text=今日消费').count())
console.log('rel time (just now/min ago):', await page.locator('text=/just now|m ago|刚刚|分钟前/').count())
console.log('console link:', await page.locator('[class*="consoleLink"]').count())
// click it → console tab opens
if (await page.locator('[class*="consoleLink"]').count()) {
  await page.locator('[class*="consoleLink"]').click()
  await page.waitForTimeout(2500)
  await page.screenshot({ path: '/tmp/xpeach-shots/61-console-from-pill.png' })
  console.log('tab opened:', await page.locator('[class*="tabRoot"]').count())
}
console.log('ERRS:', errs.slice(0, 5))
await browser.close()
