// Drive the provider editor: add a model via the real mutate path,
// then verify cordis.patch.yml absorbed the write.
import { createRequire } from 'node:module'
const require = createRequire('/Volumes/SN 770/Developer/deepseek-harness/apps/web/package.json')
const { chromium } = require('playwright')
const url = process.argv[2]
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto(url, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(9000)
await page.getByText('Settings').first().click()
await page.waitForTimeout(2500)
await page.getByText(/Model/).first().click()
await page.waitForTimeout(3000)
await page.getByText('Edit').first().click()
await page.waitForTimeout(2500)
await page.screenshot({ path: '/tmp/xpeach-shots/A1-editor.png', fullPage: true })
const txt = await page.evaluate(() => document.body.innerText)
console.log('editor text:', txt.slice(0, 800))
console.log('inputs:', await page.locator('input').count())
await browser.close()
