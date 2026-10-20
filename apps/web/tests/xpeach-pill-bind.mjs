// Pill-level semi-login E2E: unbind via settings → pill shows unbound →
// bind through the pill's inline form → pill recovers with live data.
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
await page.waitForTimeout(9000)

// 1. unbind through settings section
await page.getByText('Settings', { exact: true }).first().click()
await page.waitForTimeout(1600)
await page.locator('[role="presentation"]').last().locator('text=XPeach').first().click({ timeout: 8000 })
await page.waitForTimeout(7000)
if (await page.locator('[class*="bindOk"]').count()) {
  await page.locator('[class*="bindGhost"]').first().click()
  await page.waitForTimeout(2500)
}
await page.keyboard.press('Escape')
await page.waitForTimeout(1500)
await page.screenshot({ path: dir + '/30-unbound-main.png' })
console.log('pill unbound text:', await page.locator('text=not bound, text=未绑定').count())

// 2. pill click → inline bind form
await page.locator('[class*="pillRoot"] button').first().click()
await page.waitForTimeout(1200)
await page.screenshot({ path: dir + '/31-pill-bind.png' })
console.log('pill bind input:', await page.locator('[class*="pillCard"] [class*="bindInput"]').count())

// 3. bind via pill
await page.locator('[class*="pillCard"] [class*="bindInput"]').fill(KEY)
await page.locator('[class*="pillCard"] [class*="bindButton"]').first().click()
await page.waitForTimeout(6000)
await page.screenshot({ path: dir + '/32-pill-bound.png' })
console.log('pill recovered (usage in card):', await page.locator('[class*="pillGrid"]').count())
console.log('ERRS:', errs.slice(0, 5))
await browser.close()
