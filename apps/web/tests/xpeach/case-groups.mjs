// Group-picker regression: expand a market row → group chips render → pick a
// different group → the "你的组价 / Your group price" line updates with ×ratio.
import { openConsole } from './harness.mjs'
export const name = 'groups: market picker shows billed-group ratio'
export async function run(page) {
  await openConsole(page)
  await page.getByText(/模型市场|Model Market/).click()
  await page.locator('[class*="marketRow"]').first().waitFor({ timeout: 25000 })
  // find a claude row with ≥2 group candidates (fable); fall back to any claude row
  const rows = page.locator('[class*="marketRow"]').filter({ hasText: /claude-fable-5|claude-sonnet-4-6|claude-opus/i })
  const rowN = await rows.count()
  if (rowN === 0) throw new Error('no claude row in market')
  let row, chips, n = 0
  for (let i = 0; i < rowN && n < 2; i++) {
    row = rows.nth(i)
    await row.locator('[class*="marketHead"]').click()
    await page.waitForTimeout(1200)
    chips = row.locator('[class*="marketDetail"] [class*="groupPickRow"] button')
    n = await chips.count()
    if (n < 2) await row.locator('[class*="marketHead"]').click() // close and try next
  }
  if (n === 0) {
    // reopen for the single-group check below
    row = rows.nth(0)
    if (!await row.locator('[class*="marketDetail"]').count()) {
      await row.locator('[class*="marketHead"]').click()
      await page.waitForTimeout(1200)
    }
    chips = row.locator('[class*="marketDetail"] [class*="groupPickRow"] button')
    n = await chips.count()
  }
  if (n < 1) throw new Error('no group chips in detail')
  const detail = row.locator('[class*="marketDetail"]')
  const first = await chips.first().innerText()
  if (!/×\d/.test(first)) throw new Error('group chip missing ×ratio: ' + first)
  const yourPrice = detail.locator('[class*="effectivePrice"]')
  const before = await yourPrice.innerText().catch(() => '')
  // click the last chip (different group when >1)
  if (n > 1) {
    await chips.nth(n - 1).click()
    await page.waitForTimeout(1200)
    const after = await yourPrice.innerText()
    if (after === before) throw new Error('yourPrice unchanged after group pick')
    console.log('    group pick: ' + before.trim() + ' → ' + after.trim())
  } else {
    const note = await detail.locator('[class*="groupPickNote"]').innerText().catch(() => '')
    if (!/仅一个|single|auto/i.test(note)) throw new Error('single-group auto note missing')
    console.log('    single group auto-mounted: ' + first.trim())
  }
}
