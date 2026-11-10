import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { JSDOM } from 'jsdom'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
const require = createRequire(import.meta.url)

async function setup(t) {
  const dom = new JSDOM('<div id="root"></div>'), saved = new Map(), calls = []
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, IS_REACT_ACT_ENVIRONMENT: true })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  let client
  window.__ModuleLoader__ = { load: row => {
    assert.equal(row.id, 'dsh-source-impact')
    client = row.factory(id => {
      if (id === '@deepseek-ai/dsh-client-ui-primitives') return { Modal: ({ open, children, onClose }) => open ? React.createElement('div', { role: 'dialog' }, children, React.createElement('button', { onClick: onClose }, '关闭')) : null }
      assert.ok(['react', 'react/jsx-runtime'].includes(id))
      return require(id)
    })
  } }
  vm.runInNewContext(readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8'), { window, document, FormData: dom.window.FormData })
  const root = createRoot(document.getElementById('root'))
  let reply
  const props = { sessionId: 's1', execute: async (...args) => {
    calls.push(args)
    if (reply) return reply(...args)
    return { ok: true, value: { result: { kind: 'success', text: '引用已登记；共 1 条。来源和报告未被改写。' } } }
  } }
  const render = async () => act(async () => { root.render(React.createElement(client.SourceImpactForm, props)) })
  const click = async text => act(async () => {
    const button = [...document.querySelectorAll('button')].find(b => b.textContent === text)
    assert.ok(button, text)
    button.click()
    await Promise.resolve()
  })
  const submit = async form => act(async () => {
    form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }))
    await Promise.resolve()
  })
  t.after(async () => {
    await act(async () => root.unmount())
    dom.window.close()
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
  })
  await render()
  return { client, props, calls, render, click, submit, reply: fn => { reply = fn } }
}

test('header action registers a citation and can accept a baseline bound to scanId', async t => {
  const f = await setup(t)
  let seat
  f.client.apply({ slots: { inject: (name, cb) => { seat = name; cb() }, register: options => { assert.equal(options.id, 'dsh-source-impact') } }, remote: { commands: { execute() {} } } })
  assert.equal(seat, 'conversation.session.header.actions')
  await f.click('资料引用登记')
  const form = document.querySelector('form')
  const values = { id: 'price-a', source: 'quotes.csv', keyColumn: 'item', keyValue: 'A', columns: 'price', conclusionId: 'buy', conclusion: '建议购买 A', outputPath: 'report.md', locator: '## 建议', label: '建议章节', recheck: '重算总价' }
  for (const [name, value] of Object.entries(values)) form.elements.namedItem(name).value = value
  await f.submit(form)
  const raw = f.calls[0][1]
  assert.ok(raw.startsWith('/impact register '))
  const registration = JSON.parse(raw.slice('/impact register '.length))
  assert.equal(registration.id, 'price-a')
  assert.deepEqual(registration.selector, { kind: 'csv-key', keyColumn: 'item', keyValue: 'A', columns: ['price'] })
  assert.match(document.body.textContent, /引用已登记/)
  const accept = [...document.querySelectorAll('form')][1]
  accept.elements.namedItem('scanId').value = 'a'.repeat(64)
  await f.submit(accept)
  assert.equal(f.calls[1][1], '/impact accept ' + 'a'.repeat(64))
})

test('late accept after session change does not populate the new session panel', async t => {
  const f = await setup(t), pending = Promise.withResolvers()
  await f.click('资料引用登记')
  f.reply(() => pending.promise)
  const accept = [...document.querySelectorAll('form')][1]
  accept.elements.namedItem('scanId').value = 'b'.repeat(64)
  await f.submit(accept)
  f.props.sessionId = 's2'
  await f.render()
  await act(async () => { pending.resolve({ ok: true, value: { result: { kind: 'success', text: '已原子接受新基线并保留上一版：price-a。模型侧仍只读。' } } }); await Promise.resolve() })
  assert.equal(document.querySelector('[role="dialog"]'), null)
  assert.doesNotMatch(document.body.textContent, /已原子接受新基线/)
})
