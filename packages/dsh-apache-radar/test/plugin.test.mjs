import assert from 'node:assert/strict'
import { test } from 'node:test'
import { apply, Config, inject, name } from '../index.js'
import './helpers.mjs'

test('bundle module exports its Cordis plugin contract and only registers honest help', () => {
  assert.equal(name, 'apache-radar')
  assert.deepEqual(inject, ['commands'])
  assert.equal(typeof Config, 'function')
  let command
  let disposed = false
  let dispose
  apply({
    commands: { register: value => { command = value; return () => { disposed = true } } },
    effect: setup => { dispose = setup() },
  })
  assert.equal(command.name, 'apache-radar')
  for (const rawInput of ['', ' help ']) {
    const result = command.handler({ rawInput })
    assert.equal(result.kind, 'success')
    for (const phrase of ['本地', '多来源', 'URL', 'Asia/Singapore', 'Kafka / Hadoop / Flink', 'reporter.apache.org', '无需模型']) assert.ok(result.text.includes(phrase))
  }
  assert.equal(command.handler({ rawInput: 'counts' }).kind, 'error')
  dispose()
  assert.equal(disposed, true)
})
