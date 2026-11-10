// Integration against the real published rc.5 runtime packages: Cordis,
// dsh-session's SessionStore and dsh-commands' CommandRuntime.
import test, { mock } from 'node:test'
import assert from 'node:assert/strict'
import { Context } from '@deepseek-ai/cordis'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import CommandRuntime from '@deepseek-ai/dsh-commands'
import * as heartbeat from '../index.js'

async function mount(config) {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(CommandRuntime)
  const fiber = await ctx.plugin(heartbeat, config)
  const session = ctx.sessions.create(SessionId(`hb-${Math.random()}`))
  const agent = { id: session.id, session, status: 'running' }
  return { ctx, session, agent, fiber }
}
const cards = session => {
  const events = session.snapshotEvents()
  return events.filter(e => e.type === 'command/done').map(e => ({ kind: e.data.kind, text: e.data.text }))
}
const settle = () => new Promise(r => setImmediate(r))
const pump = async () => { for (let i = 0; i < 4; i++) { await settle(); mock.timers.tick(1) } }

test('real runtime: repeated tool calls produce a /heartbeat command card in the session log', async () => {
  const { ctx, session, agent, fiber } = await mount({})
  ctx.emit('agent/status', { agent, status: 'running' })
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
    ctx.emit('agent/status', { agent, status: 'running' })
    session.append('turn/start', { turn: 1 })
    for (let s = 0; s < 12 * 60; s += 15) { mock.timers.tick(15_000); await pump() }
    await pump()
    const texts = cards(session).map(c => c.text)
    assert.equal(texts.filter(t => t.startsWith('💓 任务心跳')).length, 2, texts.join('\n---\n'))
    assert.equal(texts.filter(t => /没有任何新活动/.test(t)).length, 1)
    ctx.emit('agent/status', { agent: { ...agent, status: 'idle' }, status: 'idle' })
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
