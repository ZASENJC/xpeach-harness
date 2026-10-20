// Visible-text whitelabel scan across main page + console + settings.
import { openConsole, openSettings } from './harness.mjs'
export const name = 'whitelabel: no DeepSeek in visible surfaces'
export async function run(page) {
  const deep = /deepseek|whale|深度求索|DeepSeek/i
  const hits = []
  const scan = async (label) => {
    const body = await page.locator('body').innerText()
    for (const line of body.split('\n')) if (deep.test(line)) hits.push(label + ': ' + line.trim().slice(0, 80))
  }
  await scan('main')
  await openConsole(page)
  await page.waitForTimeout(2500)
  await scan('console')
  // 'Site' admin segment intentionally shows raw station data (operators see truth).
  for (const seg of ['Model Market', 'Call Logs', 'Overview']) {
    const b = page.getByText(new RegExp(seg, 'i')).first()
    if (await b.count()) { await b.click(); await page.waitForTimeout(1500); await scan(seg) }
  }
  if (await openSettings(page)) {
    const txt = await page.locator('[class*="overlay"]').first().innerText()
    for (const line of txt.split('\n')) if (deep.test(line)) hits.push('settings: ' + line.trim().slice(0, 80))
    await page.keyboard.press('Escape')
  }
  if (hits.length) throw new Error(hits.slice(0, 8).join(' || '))
}
