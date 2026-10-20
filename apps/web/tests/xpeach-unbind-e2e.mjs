import { createRequire } from 'node:module'
const require = createRequire('/Volumes/SN 770/Developer/deepseek-harness/apps/web/package.json')
const { chromium } = require('playwright')
const url = process.argv[2]
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto(url, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(9000)
await page.getByText('Settings').first().click()
await page.waitForTimeout(3000)
// settings modal's own nav items — the overlay contains the section list
const overlay = page.locator('[class*="overlay"]').last()
await overlay.getByText('XPeach').first().click()
await page.waitForTimeout(3500)
await page.screenshot({ path: '/tmp/xpeach-shots/B2-section.png' })
const txt = await overlay.evaluate(e => e.innerText)
console.log('SECTION:', txt.slice(0, 1200))
await browser.close()
