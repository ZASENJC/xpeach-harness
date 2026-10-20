// Probe v2: body inline vars, accent consumers, plugin activation state.
import { createRequire } from 'node:module'
const require = createRequire('/Volumes/SN 770/Developer/deepseek-harness/apps/web/package.json')
const { chromium } = require('playwright')
const url = process.argv[2]
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
const errs = []
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text().slice(0, 240)) })
page.on('pageerror', e => errs.push('PAGE-ERR: ' + String(e).slice(0, 240)))
await page.goto(url, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(9000)
const report = await page.evaluate(() => {
  const body = document.body
  const inlineVars = {}
  for (const name of body.style) if (name.startsWith('--')) inlineVars[name] = body.style.getPropertyValue(name)
  const bodyCss = getComputedStyle(body)
  const tokens = {}
  for (const t of ['--dsw-alias-brand-primary', '--dsw-alias-brand-primary-new-colorprimary-new-color', '--dsw-static-deepseek-450', '--dsw-alias-button-primary-fill'])
    tokens[t] = bodyCss.getPropertyValue(t).trim()
  const blueish = []
  for (const el of document.querySelectorAll('button, span, svg, a')) {
    const cs = getComputedStyle(el)
    for (const prop of ['background-color', 'color', 'fill']) {
      const v = cs[prop]
      if (v.includes('65, 118, 230') || v.includes('86, 134, 254')) {
        blueish.push({ tag: el.tagName, cls: String(el.className).slice(0, 70), prop, v })
        break
      }
    }
  }
  return { inlineVarCount: Object.keys(inlineVars).length,
    xpeachVars: Object.fromEntries(Object.entries(inlineVars).filter(([k]) => k.includes('brand') || k.includes('deepseek'))),
    tokens, blueElements: blueish.slice(0, 10),
    pill: !!document.querySelector('[class*="pillRoot"]'),
    wordmark: document.querySelector('[class*="wordmark"]')?.textContent ?? null }
})
console.log(JSON.stringify(report, null, 1))
console.log('ERRS:', JSON.stringify(errs.slice(0, 8), null, 1))
await browser.close()
