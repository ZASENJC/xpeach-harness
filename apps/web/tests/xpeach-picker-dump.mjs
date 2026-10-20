import { createRequire } from 'node:module'
const require = createRequire('/Volumes/SN 770/Developer/deepseek-harness/apps/web/package.json')
const { chromium } = require('playwright')
const url = process.argv[2]
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto(url, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(9000)
// open composer + menu then the Model submenu
const chip = page.locator('button').filter({ hasText: 'swe-2-max' }).first()
await chip.click()
await page.waitForTimeout(1500)
await page.getByText(/^Model$/).last().click()
await page.waitForTimeout(2500)
await page.screenshot({ path: '/tmp/xpeach-shots/A7-submenu.png' })
const items = await page.locator('[role="menu"] *, [role="listbox"] *, [class*="menu"] *').allTextContents()
console.log('submenu items:', items.slice(0, 25))
await browser.close()
