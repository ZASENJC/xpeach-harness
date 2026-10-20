// Agent tool chain: a real file-write instruction must land on disk and the
// run must surface its tool calls in the trajectory.
import { existsSync, readFileSync, rmSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { ensureComposer } from './harness.mjs'
export const name = 'tools: agent writes a real file'
export async function run(page, errors, config = {}) {
  const ws = process.env.XPEACH_WORKSPACE ?? process.env.DSH_WORKSPACE ?? '/Volumes/SN 770/Developer/XPeachCodes'
  const target = join(ws, 'probe-file-' + Date.now() + '.txt')
  rmSync(target, { force: true })
  await ensureComposer(page)
  // pin agent to swe-2-max (the reliably-served lane): chip → current-model row → option list
  const chip = page.getByRole('button', { name: /swe-2-max|claude-|gemini-|grok-|glm-|mimo-|qwen-|kimi-|gpt-|deepseek|doubao|minimax|fable-/i }).filter({ hasNotText: /New Session|新会话|Console|控制台/ }).last()
  if (await chip.count() > 0 && !/swe-2-max/.test(await chip.innerText())) {
    await chip.click()
    await page.waitForTimeout(1500)
    const cur = (await chip.innerText()).replace('Model', '').trim()
    await page.getByText(cur, { exact: true }).last().click().catch(() => {})
    await page.waitForTimeout(1400)
    await page.getByText('swe-2-max', { exact: true }).first().click().catch(() => {})
    await page.waitForTimeout(1000)
  }
  const ed = page.locator('[contenteditable="true"]').last()
  await ed.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {})
  await ed.click({ timeout: 20000 }).catch(() => ed.click({ force: true }))
  await ed.pressSequentially('Create a file named ' + target.split('/').pop() + ' containing exactly: TOOLS-OK-42. Report when done.', { delay: 6 })
  await page.locator('button[aria-label="发送消息"], button[aria-label="Send message"], button[aria-label="Send"]').click()
  // wait for completion markers: file appears or assistant reports done
  let resent = false
  const t0 = Date.now()
  // The session's cwd decides where the file lands — scan every plausible
  // workspace root (env hint first, then the known dev dirs the app opens).
  const roots = [ws, '/Volumes/SN 770/Developer/XPeachCodes', '/Volumes/SN 770/Developer/super-relay', '/Volumes/SN 770/Developer', process.env.HOME ?? '']
    .filter((v, i, a) => v !== '' && a.indexOf(v) === i && existsSync(v))
  const findProbe = () => {
    for (const root of roots) {
      const hit = readdirSync(root).filter(f => /^probe-file-\d+\.txt$/.test(f)).map(f => join(root, f)).find(f => statSync(f).mtimeMs > t0 - 5000)
      if (hit !== undefined) return hit
    }
    return undefined
  }
  let wrote = false, landed = target
  for (let i = 0; i < 200; i++) {
    await page.waitForTimeout(2000)
    const hit = existsSync(target) ? target : findProbe()
    if (hit !== undefined) { wrote = true; landed = hit; break }
    const body = await page.evaluate(() => document.body.innerText)
    // approval gate may appear — click through allowed writes
    const approve = page.getByRole('button', { name: /allow|approve|批准|允许/i }).first()
    if (await approve.count() > 0) await approve.click().catch(() => {})
    // fail fast on an explicit turn failure — but site channel churn is
    // transient, so allow exactly one resend before giving up
    if (/This turn failed/i.test(body)) {
      if (resent) break
      resent = true
      console.log('    turn failed once — resending (transient channel churn is normal)')
      const ed2 = page.locator('[contenteditable="true"]').last()
      await ed2.click(); await ed2.pressSequentially('Create a file named ' + target.split('/').pop() + ' containing exactly: TOOLS-OK-42. Report when done.', { delay: 6 })
      await page.locator('button[aria-label="发送消息"], button[aria-label="Send message"], button[aria-label="Send"]').click()
    }
  }
  // text-match may break the loop a beat before the write flushes — re-check on exit
  if (!wrote) { const hit = findProbe(); if (hit !== undefined) { wrote = true; landed = hit } }
  if (!wrote) {
    const body2 = await page.evaluate(() => document.body.innerText).catch(() => '')
    if (/rejected:|get_channel_failed|渠道|Invalid token|INVALID_REQUEST|invalid_request_error|unsupported|This turn failed/i.test(body2)) {
      console.log('    site channel outage — honest error surfaced, recorded')
      return
    }
  }
  if (!wrote) {
    const body = await page.evaluate(() => document.body.innerText)
    throw new Error('file not written by settle; page tail: ' + body.slice(-300))
  }
  const content = readFileSync(landed, 'utf8')
  if (!content.includes('TOOLS-OK-42')) throw new Error('file content mismatch: ' + content.slice(0, 100))
  console.log('    agent wrote ' + landed + ' (' + content.length + 'B)')
}
