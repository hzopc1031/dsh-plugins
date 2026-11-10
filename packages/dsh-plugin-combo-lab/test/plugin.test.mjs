import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { Context } from '@deepseek-ai/cordis'
import Sessions, { SessionId } from '@deepseek-ai/dsh-session'
import Commands from '@deepseek-ai/dsh-commands'
import * as plugin from '../index.js'
import { Store } from '../lib/store.js'
import { planInput } from './fixtures.mjs'

async function harness(fn) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'combo-plugin-'))
  const ctx = new Context()
  try {
    await ctx.plugin(Sessions)
    await ctx.plugin(Commands)
    const fiber = await ctx.plugin(plugin)
    const session = ctx.sessions.create(SessionId('combo-test'), { meta: { cwd: root } })
    const agent = { id: session.id, session, status: 'idle', ctx }
    const execute = (raw = '', signal = new AbortController().signal) => ctx.commands.execute(agent, '/combo-lab ' + raw, [], signal)
    const run = async (raw = '') => {
      const result = (await execute(raw)).result
      assert.equal(result.kind, 'success', result.text)
      return result.text
    }
    const plan = async (input = planInput) => {
      const output = await run('plan ' + JSON.stringify(input))
      return /计划：([0-9a-f-]{36})/.exec(output)[1]
    }
    await fn({ ctx, fiber, root, session, agent, execute, run, plan, store: new Store(path.join(root, '.dsh/combo-lab')) })
  } finally { await ctx.fiber.dispose(); await rm(root, { recursive: true, force: true }) }
}

test('真实 Cordis 挂载、官方命令发现与 effect 卸载', () => harness(async h => {
  assert.equal(plugin.name, 'plugin-combo-lab')
  assert.deepEqual(plugin.inject, ['commands'])
  assert.equal(plugin.Config({}).reportDir, '.dsh/combo-lab')
  assert.ok(h.ctx.commands.list(h.agent).some(c => c.name === 'combo-lab'))
  assert.match(await h.run(), /不会安装、启停/)
  await h.fiber.dispose()
  assert.equal(h.ctx.commands.list(h.agent).some(c => c.name === 'combo-lab'), false)
}))
test('完整工作流：计划→模板→记录→升级前后快照→对照', () => harness(async h => {
  const id = await h.plan()
  assert.match(await h.run('show ' + id), /待桌面验证/)
  const template = await h.run('template ' + id + ' ab:input.commands')
  const observation = JSON.parse(template.slice(template.indexOf('{"stepId"')))
  observation.outcome = 'pass'; observation.observer = 'fixture'; observation.evidence = '测试夹具：人工核对动作成功'
  await h.run('record ' + id + ' ' + JSON.stringify(observation))
  const beforeText = await h.run('snapshot ' + id + ' 升级前')
  const before = /快照：([0-9a-f-]{36})/.exec(beforeText)[1]
  const upgraded = structuredClone(planInput); upgraded.plugins[0].version = '1.1.0'
  const afterId = await h.plan(upgraded)
  const newer = await h.store.load(afterId)
  const nextTemplate = JSON.parse((await h.run('template ' + afterId + ' ab:input.commands')).split('/combo-lab record ')[1].slice(afterId.length + 1))
  await h.run('record ' + afterId + ' ' + JSON.stringify({ ...nextTemplate, outcome: 'fail', observer: 'fixture', evidence: '测试夹具：组合失败' }))
  const after = /快照：([0-9a-f-]{36})/.exec(await h.run('snapshot ' + afterId + ' 升级后'))[1]
  const output = await h.run('compare ' + before + ' ' + after)
  assert.match(output, /regression/)
  assert.match(output, /comparison-[0-9a-f-]+\.json/)
  assert.ok((await readdir(h.store.directory)).some(f => f.startsWith('comparison-')))
  assert.match(output, /1\.1\.0/)
  assert.match(output, /inconclusive/)
  assert.equal(newer.observations.length, 0)
  const events = h.session.snapshotEvents()
  assert.ok(events.some(e => e.type === 'command/done'))
  assert.ok(!events.some(e => e.type === 'user/message'), '命令不应提交模型消息')
  assert.ok(events.filter(e => e.type === 'command/run').every(e => !e.data.rawInput), '命令输入不重复记录')
}))
test('并发记录排队，防止丢失证据', () => harness(async h => {
  const id = await h.plan()
  const parse = text => JSON.parse(text.slice(text.indexOf('{"stepId"')))
  const a = parse(await h.run('template ' + id + ' a:input.commands')), b = parse(await h.run('template ' + id + ' b:input.commands'))
  await Promise.all([h.run('record ' + id + ' ' + JSON.stringify(a)), h.run('record ' + id + ' ' + JSON.stringify(b))])
  assert.equal((await h.store.load(id)).observations.length, 2)
}))
test('畸形输入、路径穿越与缺失存档给出错误；现有计划不受影响', () => harness(async h => {
  const id = await h.plan()
  for (const raw of ['plan {bad', 'show ../escape', 'record ' + id + ' null', 'record ' + id + ' {}', 'snapshot ' + id, 'compare a b', 'unknown', 'template ' + id + ' missing']) {
    assert.equal((await h.execute(raw)).result.kind, 'error', raw)
  }
  assert.equal((await h.store.load(id)).observations.length, 0)
  assert.equal((await readdir(h.store.directory)).length, 1)
}))
test('没有工作区时拒绝相对路径写入；help 仍可用', () => harness(async h => {
  const s = h.ctx.sessions.create(SessionId('no-cwd'))
  const a = { id: s.id, session: s, status: 'idle', ctx: h.ctx }
  const call = raw => h.ctx.commands.execute(a, '/combo-lab ' + raw, [], new AbortController().signal)
  assert.equal((await call('help')).result.kind, 'success')
  assert.equal((await call('plan ' + JSON.stringify(planInput))).result.kind, 'error')
}))
test('命令不调用进程、桌面自动化或插件管理服务，只有计划与本地存档', () => harness(async h => {
  const id = await h.plan()
  assert.equal((await h.store.load(id)).observations.length, 0)
  assert.deepEqual(plugin.inject, ['commands'])
  assert.equal(h.ctx.commands.find(h.agent, 'combo-lab').input.attachments, undefined)
}))