// Integration against the real published rc.5 runtime packages: Cordis,
// dsh-session's SessionStore and dsh-commands' CommandRuntime.
import test, { mock } from 'node:test'
import assert from 'node:assert/strict'
import { Context } from '@deepseek-ai/cordis'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import CommandRuntime from '@deepseek-ai/dsh-commands'
import AgentRegistry, { agentEvents } from '@deepseek-ai/dsh-agent'
import { createScope } from '@deepseek-ai/dsh-scope'
import * as heartbeat from '../index.js'

async function scopedAgent(ctx, id, status = 'running', origin) {
  const agent = { id: SessionId(id), status }
  await ctx.plugin({ inject: ['sessions'], apply(owner) {
    const scope = createScope(owner, agent)
    agent.ctx = scope.ctx
    agent.session = scope.ctx.sessions.create(agent.id, { meta: { origin } })
  } })
  return agent
}

async function mount(config) {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(CommandRuntime)
  const fiber = await ctx.plugin(heartbeat, config)
  const agent = await scopedAgent(ctx, `hb-${Math.random()}`)
  return { ctx, session: agent.session, agent, fiber }
}
const cards = session => {
  const events = session.snapshotEvents()
  return events.filter(e => e.type === 'command/done').map(e => ({ kind: e.data.kind, text: e.data.text }))
}
const settle = () => new Promise(r => setImmediate(r))
const pump = async () => { for (let i = 0; i < 4; i++) { await settle(); mock.timers.tick(1) } }

test('real registry: loading/reloading during a silent run adopts existing agents without another status event', async () => {
  mock.timers.enable({ apis: ['setInterval', 'setTimeout', 'Date'], now: 0 })
  const ctx = new Context()
  try {
    await ctx.plugin(SessionStore)
    await ctx.plugin(CommandRuntime)
    await ctx.plugin(AgentRegistry)
    const agent = await scopedAgent(ctx, 'already-running')
    await ctx.agents.register(agent)
    agentEvents(ctx, agent).emit('agent/status', { status: 'running' })
    agent.session.append('turn/start', { turn: 1 })
    agent.session.append('step/start', { turn: 1, step: 1 })
    // The only running edge preceded apply; a stalled request publishes nothing else.
    let fiber = await ctx.plugin(heartbeat, {})
    for (let i = 0; i < 26 * 4; i++) { mock.timers.tick(15_000); await pump() }
    assert.equal(cards(agent.session).filter(c => c.text.startsWith('💓 任务心跳')).length, 5)
    assert.equal(cards(agent.session).filter(c => /没有任何新活动/.test(c.text)).length, 2)
    await fiber.dispose()
    const count = cards(agent.session).length
    fiber = await ctx.plugin(heartbeat, {})
    for (let i = 0; i < 5 * 4; i++) { mock.timers.tick(15_000); await pump() }
    assert.equal(cards(agent.session).length, count + 1, 'reload also adopts the live run')
    agent.status = 'idle'
    agentEvents(ctx, agent).emit('agent/status', { status: 'idle' })
    await pump()
    assert.match(cards(agent.session).at(-1).text, /本轮结束/)
  } finally {
    await ctx.fiber.dispose()
    mock.timers.reset()
  }
})

test('real registry: late registry availability adopts live work and disposal stops its timer', async () => {
  mock.timers.enable({ apis: ['setInterval', 'setTimeout', 'Date'], now: 0 })
  const ctx = new Context()
  try {
    await ctx.plugin(SessionStore)
    await ctx.plugin(CommandRuntime)
    const agent = await scopedAgent(ctx, 'late-registry')
    await ctx.plugin(heartbeat, {})
    // The service becomes available with an already-entered running agent.
    await ctx.plugin({ apply(owner) {
      const registry = new AgentRegistry(owner)
      registry.enter(agent)
    } })
    for (let i = 0; i < 5 * 4; i++) { mock.timers.tick(15_000); await pump() }
    assert.equal(cards(agent.session).length, 1)
    await ctx.fiber.dispose()
    const count = cards(agent.session).length
    for (let i = 0; i < 10 * 4; i++) { mock.timers.tick(15_000); await pump() }
    assert.equal(cards(agent.session).length, count)
  } finally {
    await ctx.fiber.dispose()
    mock.timers.reset()
  }
})

for (const [label, config, status, origin, expected] of [
  ['idle', {}, 'idle', undefined, 0],
  ['disabled', { enabled: false }, 'running', undefined, 0],
  ['subagent excluded', {}, 'running', 'subagent', 0],
  ['subagent included', { includeSubagents: true }, 'running', 'subagent', 1],
]) {
  test(`real registry: adoption respects ${label}`, async () => {
    mock.timers.enable({ apis: ['setInterval', 'setTimeout', 'Date'], now: 0 })
    const ctx = new Context()
    try {
      await ctx.plugin(SessionStore)
      await ctx.plugin(CommandRuntime)
      await ctx.plugin(AgentRegistry)
      const agent = await scopedAgent(ctx, label, status, origin)
      await ctx.agents.register(agent)
      await ctx.plugin(heartbeat, config)
      for (let i = 0; i < 5 * 4; i++) { mock.timers.tick(15_000); await pump() }
      assert.equal(cards(agent.session).length, expected)
    } finally {
      await ctx.fiber.dispose()
      mock.timers.reset()
    }
  })
}

test('real runtime: repeated tool calls produce a /heartbeat command card in the session log', async () => {
  const { ctx, session, agent, fiber } = await mount({})
  agentEvents(ctx, agent).emit('agent/status', { status: 'running' })
  session.append('turn/start', { turn: 1 })
  for (const id of ['a', 'b', 'c']) session.append('tool/call', { turn: 1, step: 1, callId: id, name: 'bash', arguments: '{"cmd":"npm test"}' })
  for (let i = 0; i < 200 && cards(session).length === 0; i++) await new Promise(r => setTimeout(r, 5))
  const run = session.snapshotEvents().find(e => e.type === 'command/run')
  assert.equal(run.data.name, 'heartbeat')
  assert.equal(run.data.args, undefined, 'recordInput:false keeps the internal token out of the log')
  const [card] = cards(session)
  assert.equal(card.kind, 'error')
  assert.match(card.text, /同一工具连续调用 3 次/)
  await fiber.dispose()
})

test('real runtime: fake clock drives progress cards, silence warning, and stops after idle', async () => {
  mock.timers.enable({ apis: ['setInterval', 'setTimeout', 'Date'], now: 0 })
  try {
    const { ctx, session, agent, fiber } = await mount({ intervalMinutes: 5, silenceMinutes: 10 })
    agentEvents(ctx, agent).emit('agent/status', { status: 'running' })
    session.append('turn/start', { turn: 1 })
    for (let s = 0; s < 12 * 60; s += 15) { mock.timers.tick(15_000); await pump() }
    await pump()
    const texts = cards(session).map(c => c.text)
    assert.equal(texts.filter(t => t.startsWith('💓 任务心跳')).length, 2, texts.join('\n---\n'))
    assert.equal(texts.filter(t => /没有任何新活动/.test(t)).length, 1)
    agent.status = 'idle'
    agentEvents(ctx, agent).emit('agent/status', { status: 'idle' })
    await pump()
    assert.match(cards(session).at(-1).text, /本轮结束/)
    const count = cards(session).length
    for (let i = 0; i < 40; i++) { mock.timers.tick(15_000); await settle() }
    assert.equal(cards(session).length, count, 'no cards after the run ended')
    await fiber.dispose()
  } finally {
    mock.timers.reset()
  }
})
