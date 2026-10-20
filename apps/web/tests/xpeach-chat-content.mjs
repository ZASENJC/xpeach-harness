// Chat with content capture — distinguish real reply from error card.
import { createRequire } from 'node:module'
const require = createRequire('/Volumes/SN 770/Developer/deepseek-harness/apps/web/package.json')
const { chromium } = require('playwright')
const url = process.argv[2]
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto(url, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(9000)
const composer = page.locator('textarea, [contenteditable="true"]').first()
await composer.fill('Reply with exactly: PONG')
await page.keyboard.press('Enter')
await page.waitForTimeout(15000)
await page.screenshot({ path: '/tmp/xpeach-shots/A0-chat-result.png' })
const txt = await page.evaluate(() => document.body.innerText)
const m = txt.match(/PONG|failed|error|invalid|MISSING_CREDENTIAL|API key/i)
console.log('reply content:', m ? m[0] : txt.slice(-300))
await browser.close()
