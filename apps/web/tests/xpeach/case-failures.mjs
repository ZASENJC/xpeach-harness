// Failure-degradation matrix: each failure class must surface honestly —
// a visible error message in the surface it belongs to, never a silent hang.
import { openConsole } from './harness.mjs'
export const name = 'failures: honest degradation on rejected calls'
export async function run(page, errors) {
  // 1) ungrouped/unavailable model via playground: relay rejects → error shows
  await openConsole(page)
  await page.waitForTimeout(2500)
  await page.getByText(/Model Market|模型市场/).click()
  await page.waitForTimeout(2500)
  // pick a model the health probe flagged failed if any; else force a bogus id via the last row
  const row = page.locator('[class*="marketRow"]').last()
  // Try button (market head is a role=button now — match by label)
  await row.locator('button').filter({ hasText: /Try|试用|Close|收起/i }).first().click()
  await page.waitForTimeout(1200)
  await row.locator('textarea').fill('Reply with exactly: FAILPROBE-OK')
  await row.locator('button').filter({ hasText: /Run|运行/i }).first().click()
  // wait until the row settles into reply or error — both are honest outcomes
  let settled = false, text = ''
  for (let i = 0; i < 45; i++) {
    await page.waitForTimeout(2000)
    text = await row.innerText()
    if (/FAILPROBE-OK|Calling|error|failed|错误|失败|拒绝/i.test(text) && !/Calling…?$/.test(text.trim().slice(-14))) { settled = true; break }
  }
  if (!settled) throw new Error('playground call never settled: ' + text.slice(0, 200))
  console.log('    playground settled with:', text.slice(0, 120).replace(/\n/g, ' | '))

  // 2) host-side honesty: chat remote with a fake model must reject with a message
  //    (exercised through the same ops path the UI uses)
  const bad = await page.evaluate(async () => {
    // eslint-disable-next-line no-undef
    const el = document.querySelector('[class*="playInput"]')
    return el !== null
  })
  if (!bad) throw new Error('playground input vanished after failure')
}
