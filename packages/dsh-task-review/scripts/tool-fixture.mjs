// 0.2.2 split tool execution into executor plugins and changed execute() to batches.
// Use the official native executor in tests only; deployments supply their own executor.
export async function prepareTools(ctx) {
  if (typeof ctx.tools.setExecutor === 'function') {
    await ctx.plugin(await import('@deepseek-ai/dsh-tool-executor-native'))
  }
}
export async function executeTool(ctx, input) {
  if (typeof ctx.tools.setExecutor !== 'function') return ctx.tools.execute(input)
  const batch = await ctx.tools.execute({
    agent: input.agent, signal: input.signal,
    calls: [{ type: 'tool-call', id: input.callId, name: input.name, arguments: JSON.stringify(input.arguments) }],
  })
  return batch.results[0].result
}
