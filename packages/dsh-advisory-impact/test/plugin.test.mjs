import test from 'node:test'
import assert from 'node:assert/strict'
import * as plugin from '../index.js'
import './fixture-http.mjs'

test('bundle exports plugin hooks and registers only an honest help command with cleanup', () => {
  assert.equal(plugin.name, 'advisory-impact')
  assert.deepEqual(plugin.inject, ['commands'])
  assert.ok(plugin.Config)
  assert.equal(typeof plugin.apply, 'function')
  let definition
  let disposed = false
  const ctx = {
    commands: { register(value) { definition = value; return () => { disposed = true } } },
    effect(callback) { this.dispose = callback() },
  }
  plugin.apply(ctx)
  assert.equal(definition.name, 'advisory-impact')
  const result = definition.handler({ rawInput: '' })
  assert.equal(result.kind, 'success')
  for (const text of ['开发中', '官方页面', '第二来源', 'suppressions', '自行填写', 'Kafka / Hadoop / Flink', '未填写运行版本，无法判断', '无需模型调用', '实验性', 'lockfile']) assert.ok(result.text.includes(text), text)
  ctx.dispose()
  assert.equal(disposed, true)
})
