import { Context } from '@xpeach/xph-cordis'
import Sandbox from '@xpeach/xph-sandbox-local'
import SandboxPolicy from '@xpeach/xph-sandbox-policy'
import SessionProjections from '@xpeach/xph-session-projection'
import { onTestFinished } from 'vitest'
import type { SandboxMode } from '@xpeach/xph-sandbox'

/** Mount the Python runtime's policy and confinement providers with owned teardown. */
export async function createRuntimeContext(policy: { mode?: SandboxMode; workspaceRoot?: string } = {}): Promise<Context> {
  const ctx = new Context()
  onTestFinished(async () => { await ctx.fiber.dispose() })
  await ctx.plugin(Sandbox, {})
  await ctx.plugin(SessionProjections)
  await ctx.plugin(SandboxPolicy, { mode: 'danger-full-access', ...policy })
  return ctx
}
