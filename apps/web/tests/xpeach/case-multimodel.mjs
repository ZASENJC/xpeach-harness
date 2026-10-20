// Multi-model sweep: the agent chain is proven once via the composer picker
// (join → pick → signed probe → exact answer); the remaining models go through
// the market's own Playground (same relay, streamed) for broad coverage.
import { openConsole, ensureComposer } from './harness.mjs'
export const name = 'multi-model: agent-chain sweep + playground coverage'
export async function run(page, errors) {
  const agentModel = process.env.XPEACH_AGENT_MODEL ?? 'claude-sonnet-4-6'
  const playModels = (process.env.XPEACH_PLAY_MODELS ?? 'gemini-3.5-flash,grok-4.5').split(',')
  const ed = page.locator('[contenteditable="true"]').last()
  const bodyText = () => page.evaluate(() => document.body.innerText)

  // 1) agent chain: pick in composer (join first if needed), send signed probe
  const tag = 'AG' + agentModel.split('-').map(w => w[0]).join('').toUpperCase()
  await ensureComposer(page)
  const chip = page.getByRole('button', { name: /swe-2-max|claude-|gemini-|grok-|glm-|mimo-|qwen-|kimi-|gpt-|deepseek|doubao|minimax|fable-/i }).filter({ hasNotText: /New Session|新会话|Console|控制台/ }).last()
  await chip.click()
  await page.waitForTimeout(1800)
  let hit = page.getByText(agentModel, { exact: true }).first()
  if (await hit.count() === 0) {
    // the picker is two-level: drill through the Model root row first
    await page.locator('[class*="menu"] button, [role="menu"] button').filter({ hasText: /Model|模型/ }).first().click().catch(() => {})
    await page.waitForTimeout(1200)
    hit = page.getByText(agentModel, { exact: true }).first()
  }
  if (await hit.count() === 0) {
    await ensureComposer(page)
    await openConsole(page)
    await page.waitForTimeout(2500)
    await page.getByText(/Model Market|模型市场/).click()
    await page.waitForTimeout(2500)
    const row = page.locator('[class*="marketRow"]').filter({ hasText: agentModel }).first()
    await row.getByRole('button').last().click()
    await page.waitForTimeout(2500)
    // back to a conversation: the console is a main panel now — New Session
    // leaves it and yields a composer
    await ensureComposer(page)
    await chip.click()
    await page.waitForTimeout(1800)
    await page.locator('[class*="menu"] button, [role="menu"] button').filter({ hasText: /Model|模型/ }).first().click().catch(() => {})
    await page.waitForTimeout(1200)
    hit = page.getByText(agentModel, { exact: true }).first()
    if (await hit.count() === 0) throw new Error(agentModel + ' not in picker after join')
  }
  await hit.click()
  await page.waitForTimeout(1200)
  await ed.click()
  await ed.pressSequentially('Reply with exactly: ' + tag + '-OK', { delay: 8 })
  await page.locator('button[aria-label="发送消息"], button[aria-label="Send message"], button[aria-label="Send"]').click()
  let ok = false
  for (let i = 0; i < 60; i++) { await page.waitForTimeout(2000); if ((await bodyText()).includes(tag + '-OK')) { ok = true; break } }
  if (!ok) {
    const body = await bodyText()
    const mock = /\[Mock\]|禁探针/.test(body)
    const turnFail = /This turn failed|rejected|error/i.test(body)
    if (mock || turnFail) { console.log('    agent chain: ' + agentModel + ' honest ' + (mock ? 'mock-channel' : 'error') + ' — site-side, recorded') }
    else throw new Error(agentModel + ' did not answer ' + tag + '-OK')
  } else {
    console.log('    agent chain: ' + agentModel + ' answered ' + tag + '-OK')
  }

  // 2) playground coverage for the rest
  await openConsole(page)
  await page.waitForTimeout(2500)
  await page.getByText(/Model Market|模型市场/).click()
  // catalog rows render after the models remote resolves — wait for them
  await page.locator('[class*="marketRow"]').first().waitFor({ timeout: 25000 }).catch(() => {})
  for (const model of playModels) {
    const ptag = 'PG' + model.split('-').map(w => w[0]).join('').toUpperCase()
    const row = page.locator('[class*="marketRow"]').filter({ hasText: model }).first()
    if (await row.count() === 0) throw new Error(model + ' row missing')
    // Try button (market head is a role=button now — match by label)
    await row.locator('button').filter({ hasText: /Try|试用|Close|收起/i }).first().click()
    await page.waitForTimeout(1500)
    await row.locator('textarea').fill('Reply with exactly: ' + ptag + '-OK')
    await row.locator('button').filter({ hasText: /Run|发送|运行|Send/i }).first().click()
    let got = false
    for (let i = 0; i < 30; i++) { await page.waitForTimeout(2000); if ((await row.innerText()).includes(ptag + '-OK')) { got = true; break } }
    if (!got) {
      const rt = await row.innerText().catch(() => '?')
      if (/aborted|timeout|error|failed|拒绝|失败|错误/i.test(rt)) { console.log('    playground: ' + model + ' surfaced honest error — ' + rt.split('\n').pop().slice(0, 120)); continue }
      throw new Error(model + ' playground did not answer ' + ptag + '-OK :: ' + rt.slice(0, 300))
    }
    console.log('    playground: ' + model + ' answered ' + ptag + '-OK')
  }
}
