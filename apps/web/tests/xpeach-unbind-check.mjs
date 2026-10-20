import { createRequire } from 'node:module'
const require = createRequire('/Volumes/SN 770/Developer/deepseek-harness/apps/web/package.json')
const { chromium } = require('playwright')
const url = process.argv[2]
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto(url, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(9000)
if (!await page.locator('[class*="segRow"]').count()) { await page.locator('[class*="footerBtn"]').first().click(); await page.waitForTimeout(4500) }
const txt = await page.evaluate(() => document.querySelector('[class*="tabRoot"]')?.innerText ?? '')
console.log('CONSOLE unbound:', txt.slice(0, 500))
await page.screenshot({ path: '/tmp/xpeach-shots/B4-console-unbound.png' })
await browser.close()
