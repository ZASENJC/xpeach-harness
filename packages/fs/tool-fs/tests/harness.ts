import { Context } from '@xpeach/xph-cordis'
import WorkingDirectory from '@xpeach/xph-working-directory'
import type { Agent } from '@xpeach/xph-agent'
import AgentLoop from '@xpeach/xph-agent-loop'
import { mountAgentLoopTestDependencies } from '@xpeach/xph-agent-loop-testkit'
import LocalFileSystem from '@xpeach/xph-fs-local'
import * as FsPolicy from '@xpeach/xph-fs-observation-policy'
import * as ToolFs from '@xpeach/xph-tool-fs'
import * as LlmDeepSeek from '@xpeach/xph-llm-deepseek-api-key'

/**
 * Build the real fs-tool stack for with-key e2e tests. Agents have no session
 * cwd, so `fsCwd` is their workspace; `persona` configures the deployment prompt.
 * This helper lives outside the e2e glob so imports do not register tests.
 */
export async function fsHarness(fsCwd: string, persona = ''): Promise<Context> {
  const ctx = new Context()
  await mountAgentLoopTestDependencies(ctx, { systemPrompt: { personaPrefix: persona } })
  await ctx.plugin(AgentLoop, { agents: [] })
  await ctx.plugin(LlmDeepSeek)
  await ctx.plugin(LocalFileSystem, { cwd: fsCwd })
  await ctx.plugin(WorkingDirectory, { defaultDirectory: fsCwd })
  await ctx.plugin(FsPolicy)
  await ctx.plugin(ToolFs)
  return ctx
}

export function waitForIdle(ctx: Context, agent: Agent): Promise<void> {
  return new Promise((resolve) => {
    const dispose = ctx.on('agent/status', ({ agent: subject, status }) => {
      if (subject === agent && status === 'idle') {
        dispose()
        resolve()
      }
    })
  })
}
