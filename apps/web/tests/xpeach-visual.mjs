// Real-browser visual probe for the xpeach profile face.
// Usage: node xpeach-visual.mjs <url> <shot-dir>
import { createRequire } from 'node:module'
const require = createRequire('/Volumes/SN 770/Developer/deepseek-harness/apps/web/package.json')
const { chromium } = require('playwright')

const url = process.argv[2]
const dir = process.argv[3] ?? '/tmp/xpeach-shots'
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errs = []
page.on('console', msg => { if (msg.type() === 'error') errs.push(msg.text().slice(0, 300)) })
page.on('pageerror', err => errs.push('PAGE-ERR: ' + String(err).slice(0, 300)))
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.waitForTimeout(8000)
await page.screenshot({ path: dir + '/01-full.png' })

console.log('DOM checks:')
console.log('  peach svg:', await page.locator('svg:has(path[fill="#6FA85A"])').count())
console.log('  wordmark:', await page.locator('text=XPeach·Code').count())
console.log('  pill:', await page.locator('[class*="pillRoot"] button').count())

const pill = page.locator('[class*="pillRoot"] button').first()
if (await pill.count()) {
  await pill.click()
  await page.waitForTimeout(900)
  await page.screenshot({ path: dir + '/02-pill-open.png' })
  console.log('  pill card:', await page.locator('[class*="pillCard"]').count())
  await page.mouse.click(700, 400)
}

// Settings: sidebar foot gear
const settingsBtn = page.locator('[class*="settings"] button, button[aria-label*="etting"], button[aria-label*="设置"]').first()
if (await settingsBtn.count()) {
  await settingsBtn.click()
  await page.waitForTimeout(1600)
  await page.screenshot({ path: dir + '/03-settings.png' })
  // scope into the settings overlay, match the exact nav row label
  const overlay = page.locator('[role="presentation"][class*="overlay"], [class*="settings"]').last()
  const xpNav = overlay.locator('nav >> text=XPeach, [class*="nav"] >> text=XPeach, [class*="list"] >> text=XPeach').first()
  let nav = xpNav
  if (!(await nav.count())) nav = overlay.locator('button:has-text("XPeach"), [role="tab"]:has-text("XPeach"), a:has-text("XPeach"), li:has-text("XPeach"), div:has-text("XPeach")').last()
  console.log('  XPeach nav count:', await overlay.locator('text=XPeach').count())
  if (await nav.count()) {
    await nav.click({ timeout: 8000 })
    await page.waitForTimeout(9000)
    await page.screenshot({ path: dir + '/04-xpeach-section.png' })
    console.log('  section card:', await page.locator('[class*="cardHead"]').count())
    console.log('  usage cells:', await page.locator('[class*="usageCell"]').count())
    console.log('  log rows:', await page.locator('[class*="logTable"] tbody tr').count())
  }
}
console.log('ERRS:', JSON.stringify(errs.slice(0, 6), null, 1))
await browser.close()
console.log('done')
