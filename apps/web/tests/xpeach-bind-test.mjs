// E2E bind/unbind cycle: unbind → bind form → paste key → rebind → data returns.
import { createRequire } from 'node:module'
const require = createRequire('/Volumes/SN 770/Developer/deepseek-harness/apps/web/package.json')
const { chromium } = require('playwright')
const url = process.argv[2]
const KEY = process.argv[3]
const dir = '/tmp/xpeach-shots'
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errs = []
page.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await page.goto(url, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(8000)
// open settings via sidebar-foot "Settings" text
await page.getByText('Settings', { exact: true }).first().click()
await page.waitForTimeout(1600)
// settings overlay nav: the section list item labeled XPeach
const overlay = page.locator('[role="presentation"]').last()
await overlay.locator('text=XPeach').first().click({ timeout: 8000 })
await page.waitForTimeout(8000)
const bound = await page.locator('[class*="bindOk"]').count()
console.log('BOUND visible:', bound)
await page.screenshot({ path: dir + '/05-bound.png' })
if (bound) {
  await page.locator('[class*="bindGhost"]').first().click()
  await page.waitForTimeout(2000)
  console.log('bind form after unbind:', await page.locator('[class*="bindInput"]').count())
  await page.screenshot({ path: dir + '/06-unbound.png' })
  await page.locator('[class*="bindInput"]').fill(KEY)
  await page.locator('[class*="bindButton"]').first().click()
  await page.waitForTimeout(7000)
  console.log('rebound:', await page.locator('[class*="bindOk"]').count())
  console.log('usage cells:', await page.locator('[class*="usageCell"]').count())
  await page.screenshot({ path: dir + '/07-rebound.png' })
}
console.log('ERRS:', errs.slice(0, 5))
await browser.close()
