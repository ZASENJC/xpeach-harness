// Shared Playwright harness for the xpeach regression suite.
import { createRequire } from 'node:module'
const require = createRequire('/Volumes/SN 770/Developer/deepseek-harness/apps/web/package.json')
const { chromium } = require('playwright')

export const url = process.env.XPEACH_URL || process.argv[2]
if (!url) { console.error('usage: XPEACH_URL=<url> node suite.mjs'); process.exit(2) }

export async function boot() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errors = []
  page.on('pageerror', e => errors.push(String(e).slice(0, 160)))
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(11000)
  return { browser, page, errors }
}

export async function openConsole(page) {
  // the console is a left-nav main panel now: click its nav row and wait for
  // the segment row to mount inside the central page
  if (!await page.locator('[class*="segRow"]').count()) {
    await page.getByRole('button', { name: /XPeach (?:Console|控制台)/ }).first().click()
    await page.waitForTimeout(4500)
  }
}

export async function openSettings(page) {
  const btns = page.locator('button[title*="ett"], button[aria-label*="ett"]')
  for (let i = 0; i < await btns.count(); i++) {
    await btns.nth(i).click()
    await page.waitForTimeout(2500)
    if (await page.locator('[class*="overlay"]').count()) return true
  }
  return false
}

/**
 * Guarantee a composable composer: leave the xpeach main panel (its own segRow
 * confuses overlay checks), close the right-pane console if open, then confirm
 * the contenteditable is actually visible.
 */
export async function ensureComposer(page) {
  const ed = page.locator('[contenteditable="true"]').last()
  for (let i = 0; i < 4; i++) {
    // playwright's own actionability check is the truth: try a click — a
    // covered/hidden composer throws within the timeout.
    try { await ed.click({ timeout: 4000 }); await page.keyboard.press('Escape').catch(() => {}); return }
    catch { /* covered or absent */ }
    await page.locator('[class*="topStrip"] button, button').filter({ hasText: /New Session|新会话/ }).first().click().catch(() => {})
    await page.waitForTimeout(1800)
  }
}

