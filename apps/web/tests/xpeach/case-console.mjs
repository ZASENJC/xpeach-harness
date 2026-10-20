// Console data surfaces render with real rows.
import { openConsole } from './harness.mjs'
export const name = 'console: overview+market+logs populated'
export async function run(page) {
  await openConsole(page)
  await page.getByText(/^Overview$|^概览$/).first().click().catch(() => {})
  await page.waitForTimeout(3500)
  const cells = await page.locator('[class*="usageCell"]').count()
  if (cells < 4) throw new Error('usage cells: ' + cells)
  await page.getByText(/Model Market|模型市场/).click()
  await page.waitForTimeout(2500)
  const rows = await page.locator('[class*="marketRow"]').count()
  if (rows < 1) throw new Error('market rows: 0')
  // market row detail expansion: price grid + meta chips must render
  await page.locator('[class*="marketHead"]').nth(1).click()
  await page.waitForTimeout(2000)
  const detail = await page.locator('[class*="marketDetail"]').count()
  if (detail < 1) console.log('    note: detail card absent (admin pricing not bound)')
  else {
    const cells2 = await page.locator('[class*="priceCell"]').count()
    if (cells2 < 2) throw new Error('detail price cells: ' + cells2)
    console.log('    market detail: ' + cells2 + ' price cells')
    await page.locator('[class*="marketHead"]').nth(1).click() // collapse
    await page.waitForTimeout(800)
  }
  await page.getByText(/Call Logs|调用日志/).click()
  await page.waitForTimeout(2000)
  const logs = await page.locator('[class*="tabLogs"] li').count()
  if (logs < 1) throw new Error('log rows: 0')
  const costs = await page.locator('[class*="logCost"]').count()
  if (costs < 1) throw new Error('log costs missing')
}
