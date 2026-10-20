// Effort pane + Guide card probe.
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
// model picker → effort pane
await page.locator('button:has-text("swe-2-max")').last().click()
await page.waitForTimeout(1200)
// effort row in picker (second list row)
const body = await page.evaluate(() => document.body.innerText)
await page.screenshot({ path: dir + '/50-model-menu.png' })
const effortRow = page.locator('[class*="effort"], [role="option"], [role="menuitem"]').locator('text=/Low|High|Max|Off|provider/i')
console.log('effort rows visible:', await effortRow.count())
// click effort sub-pane if present
const sub = page.locator('text=/^swe-2-max$/').last()
if (await sub.count()) { await sub.click(); await page.waitForTimeout(800); await page.screenshot({ path: dir + '/51-effort-pane.png' }) }
await page.keyboard.press('Escape')
// right sidebar guide tab — open via the + new tab affordance or existing guide tab
const guideBtn = page.locator('button:has-text("+"), [aria-label*="tab"], [class*="newTab"]').first()
if (await page.locator('[class*="footerBtn"]').count()) {
  // open console tab first (right pane exists), then look for guide chip
  await page.locator('[class*="footerBtn"]').first().click()
  await page.waitForTimeout(1500)
}
const guideChip = page.locator('text=Guide').first()
console.log('guide chip:', await guideChip.count())
if (await guideChip.count()) {
  await guideChip.click()
  await page.waitForTimeout(1200)
  await page.screenshot({ path: dir + '/52-guide.png' })
  console.log('xpeach card in guide:', await page.locator('text=XPeach').count())
}
console.log('ERRS:', errs.slice(0, 5))
await browser.close()
