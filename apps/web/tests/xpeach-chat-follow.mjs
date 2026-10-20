import { createRequire } from 'node:module'
const require = createRequire('/Volumes/SN 770/Developer/deepseek-harness/apps/web/package.json')
const { chromium } = require('playwright')
const url = process.argv[2]
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto(url, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(9000)
// click the session row in the sidebar list
const row = page.locator('text=Ping Pong Test').first()
console.log('session row:', await row.count())
await row.click()
await page.waitForTimeout(6000)
await page.screenshot({ path: '/tmp/xpeach-shots/14-final.png' })
const text = await page.evaluate(() => document.body.innerText)
const idx = text.lastIndexOf('Reply with exactly')
console.log('BODY TAIL:', JSON.stringify(text.slice(idx, idx + 800)))
await browser.close()
