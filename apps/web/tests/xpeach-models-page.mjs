// Probe the Models settings page: provider card for xpeach + form fields.
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
await page.getByText(/Model/).first().click()
await page.waitForTimeout(3500)
await page.screenshot({ path: '/tmp/xpeach-shots/98-models-settings.png', fullPage: true })
const txt = await page.evaluate(() => document.body.innerText)
console.log('has xpeach card:', /xpeach/i.test(txt))
console.log('model ids seen:', (txt.match(/swe-2-max|peach|deepseek/gi) || []).slice(0, 10))
console.log('buttons:', await page.getByRole('button').allTextContents().then(a => a.slice(0, 30)))
await browser.close()
