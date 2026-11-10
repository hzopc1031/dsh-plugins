import test from 'node:test'
import assert from 'node:assert/strict'
import { name, inject, Config, apply } from '../index.js'

function fixture(t) {
  const commands = new Map(), disposers = []
  apply({
    effect(fn) { const dispose = fn(); disposers.push(dispose); return dispose },
    commands: {
      register(definition) {
        assert.equal(commands.has(definition.name), false)
        commands.set(definition.name, definition)
        return () => commands.delete(definition.name)
      },
    },
  })
  const dispose = () => { for (const dispose of disposers) dispose() }
  t.after(dispose)
  const command = commands.get('invoice-gate')
  return {
    commands, command, dispose,
    call: (rawInput, signal = new AbortController().signal) => command.handler({ rawInput, signal }),
  }
}

test('module exports, empty Config and command registration dispose cleanly', t => {
  assert.equal(name, 'invoice-gate')
  assert.deepEqual(inject, ['commands'])
  assert.equal(typeof apply, 'function')
  assert.deepEqual(Config({}), {})
  const f = fixture(t)
  assert.deepEqual([...f.commands.keys()], ['invoice-gate'])
  assert.equal(f.command.definitionId, 'dsh-invoice-gate')
  assert.equal(f.command.recordInput, false)
  assert.deepEqual(f.command.input, { hint: 'help' })
  f.dispose()
  assert.equal(f.commands.size, 0)
})

test('help states current limits and model, upload and verification boundaries', async t => {
  const f = fixture(t)
  for (const input of ['', 'help', '  help\n']) {
    const result = await f.call(input)
    assert.equal(result.kind, 'success')
    for (const text of ['local verification gate', 'Scaffold only', 'not implemented', 'No OCR', '不做 OCR／税局验真',
      'never invent or change amounts, tax, totals or identifiers', 'No model calls or automatic uploads',
      'no outbound network', 'authenticity, payment or reimbursability', 'accounting-archive compliance']) {
      assert.ok(result.text.includes(text), text)
    }
  }
})

test('unsupported actions and cancellation return errors without reflecting input', async t => {
  const f = fixture(t)
  for (const input of ['ingest SAMPLE.json', 'check', 'export', 'rewrite amount SAMPLE-SECRET', 'help extra']) {
    const result = await f.call(input)
    assert.equal(result.kind, 'error')
    assert.match(result.text, /Not implemented/)
    assert.ok(!result.text.includes(input))
  }
  const cancelled = await f.call('help', AbortSignal.abort())
  assert.equal(cancelled.kind, 'error')
  assert.match(cancelled.text, /cancelled/)
})
