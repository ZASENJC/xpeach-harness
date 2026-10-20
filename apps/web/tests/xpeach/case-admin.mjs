// Site-admin segment: stat strip + all four subviews populated.
import { openConsole } from './harness.mjs'
export const name = 'admin: overview strip + users/tokens/pricing/logs'
export async function run(page) {
  await openConsole(page)
  await page.waitForTimeout(3000)
  const site = page.locator('[class*="segRow"] button').last()
  if (!/site|站点/i.test(await site.innerText())) throw new Error('Site segment missing (adminBound false?)')
  await site.click()
  let stats = []
  for (let i = 0; i < 15; i++) {
    await page.waitForTimeout(1000)
    stats = await page.locator('[class*="adminStat"]').allInnerTexts()
    if (stats.length >= 3) break
  }
  if (stats.length < 3) throw new Error('stat strip: ' + stats.join(','))
  if (!/K|M/.test(stats.join(' '))) throw new Error('no totals in strip: ' + stats.join('|'))
  for (const [sub, minRows] of [['Users|用户', 10], ['Tokens|令牌', 1], ['Pricing|定价', 30], ['Site logs|全站日志', 5]]) {
    const btn = page.locator('[class*="segRow"]').nth(1).locator('button').filter({ hasText: new RegExp(sub, 'i') }).first()
    await btn.click()
    let rows = 0
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(1200)
      rows = await page.locator('[class*="adminRow"]').count()
      if (rows >= minRows) break
    }
    if (rows < minRows) throw new Error(sub + ' rows: ' + rows)
  }
}
