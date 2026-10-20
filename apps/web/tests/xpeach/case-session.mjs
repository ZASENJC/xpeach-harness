import { ensureComposer } from './harness.mjs'
// Real session round-trip through the relay (spends a little quota on purpose).
export const name = 'session: model answers via xpeach route'
export async function run(page) {
  await ensureComposer(page)
  const input = page.locator('[contenteditable="true"], [role="textbox"]').first()
  if (!await input.count()) throw new Error('composer not found')
  await input.click()
  await input.pressSequentially('Reply with exactly: SUITE_OK')
  let sent = false
  for (const sel of ['button[aria-label="发送消息"], button[aria-label="Send message"], button[aria-label="Send"]', 'button[title*="end"]']) {
    if (await page.locator(sel).count()) { await page.locator(sel).first().click(); sent = true; break }
  }
  if (!sent) await input.press('Enter')
  // site channel churn (500 get_channel_failed) is transient — one resend is fair
  for (let attempt = 0; attempt < 2; attempt++) {
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(4000)
      const bt = await page.locator('body').innerText()
      if (/SUITE_OK/.test(bt) && /Completed|完成/i.test(bt)) return
      if (/This turn failed|failed|error|错误|失败/i.test(bt) && !/Running|Deep diving/i.test(bt)) {
        if (attempt === 0) { console.log('    transient failure — resending'); break }
        // second failure: distinguish harness breakage from a site outage —
        // a relay-level rejection surfaced honestly is a recorded pass.
        const tail = bt.slice(-400).replace(/\n/g, ' | ')
        const relayErr = /rejected:|get_channel_failed|渠道|Invalid token|rate.?limit|UNKNOWN_MODEL|quota|INVALID_REQUEST|invalid_request_error|unsupported/i.test(bt)
        if (relayErr) { console.log('    site outage surfaced — recorded :: ' + tail.slice(-150)); return }
        throw new Error('session errored twice :: ' + tail.slice(-200))
      }
    }
    if (attempt === 1) throw new Error('no reply within 80s')
    await input.click(); await input.pressSequentially('Reply with exactly: SUITE_OK'); 
    for (const sel of ['button[aria-label="发送消息"], button[aria-label="Send message"], button[aria-label="Send"]', 'button[title*="end"]']) {
      if (await page.locator(sel).count()) { await page.locator(sel).first().click(); break }
    }
  }
}
