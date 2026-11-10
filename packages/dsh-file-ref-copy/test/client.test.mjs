import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { JSDOM } from 'jsdom'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Context } from '@deepseek-ai/cordis'
import * as host from '../index.js'

const require = createRequire(import.meta.url)
async function setup(t, version = '0.2.1-rc.5') {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://dsh.test/' })
  const saved = new Map()
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, IS_REACT_ACT_ENVIRONMENT: true })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  window.__DSH_BOOT__ = { release: { version } }
  const copied = []
  navigator.clipboard = { writeText: async text => { copied.push(text) } }
  let registered, factory
  window.__ModuleLoader__ = { load: row => { registered = row.id; factory = row.factory } }
  vm.runInNewContext(readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8'), { window, document, navigator })
  assert.equal(registered, 'dsh-file-ref-copy')
  const client = factory(id => {
    if (id === '@deepseek-ai/dsh-client-ui-primitives') return { Modal: ({ open, title, onClose, children }) => open ? React.createElement('div', { role: 'dialog', 'aria-label': title }, children, React.createElement('button', { onClick: onClose }, '关闭')) : null }
    assert.ok(['react', 'react/jsx-runtime'].includes(id), 'all non-platform dependencies must be bundled')
    return require(id)
  })
  const root = createRoot(document.getElementById('root'))
  t.after(async () => {
    await act(async () => root.unmount())
    dom.window.close()
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
  })
  return {
    client, copied,
    render: async props => { await act(async () => root.render(React.createElement(client.FileRefCopy, props))) },
    click: async label => {
      const button = [...document.querySelectorAll('button')].find(e => e.textContent === label)
      assert.ok(button, 'missing button ' + label)
      await act(async () => { button.click(); await Promise.resolve() })
    },
  }
}
const props = (nodes, id = 'current') => ({
  messageId: id, sessionId: 'session',
  useChat: select => select({ legacy: { nodes } }),
  useSessions: select => select({ byId: { session: { cwd: 'C:\\项目 空格' } } }),
})
const node = (id, text, extras = {}) => ({ kind: 'assistant', messageId: id, blocks: [{ kind: 'text', text }], ...extras })

test('预构建 factory 只注册独立 assistant-actions，真实 Cordis 可加载宿主入口', async t => {
  const f = await setup(t)
  let registration, component
  f.client.apply({ slots: {
    inject: (name, callback) => { assert.equal(name, 'conversation.chat.assistant-actions'); callback() },
    register: (options, impl) => { registration = options; component = impl },
  } })
  assert.equal(registration.id, 'dsh-file-ref-copy')
  assert.equal(component, f.client.FileRefCopy)
  const ctx = new Context()
  const fiber = ctx.plugin(host)
  await fiber
  await fiber.dispose()
})
test('从当前回答原始 Markdown 列出中文空格文件，三种按钮复制实际路径', async t => {
  const f = await setup(t)
  await f.render(props([
    node('other', '[不该出现](wrong/file.ts)'),
    node('current', '[无路径的名称](docs/%E4%B8%AD%E6%96%87%20Notes.md#L2-L5)'),
  ]))
  await f.click('复制文件路径')
  assert.ok(document.body.textContent.includes('docs/中文 Notes.md'))
  assert.ok(!document.body.textContent.includes('wrong/file'))
  await f.click('复制绝对路径')
  await f.click('复制相对路径')
  await f.click('复制带行号路径')
  assert.deepEqual(f.copied, ['C:/项目 空格/docs/中文 Notes.md', 'docs/中文 Notes.md', 'C:/项目 空格/docs/中文 Notes.md#L2-L5'])
  await f.click('关闭')
  assert.equal(document.querySelector('pre'), null)
})
test('未加载、流式与被中断回答无入口，不读取历史', async t => {
  const f = await setup(t)
  for (const nodes of [[], [node('other', '[x](a)')], [node('current', '[x](a)', { interrupted: true })]]) {
    await f.render(props(nodes))
    assert.equal(document.querySelector('button'), null)
  }
})
test('无工作区时禁用绝对路径复制，剪贴板拒绝显示失败', async t => {
  const f = await setup(t)
  navigator.clipboard.writeText = async () => { throw new Error('denied') }
  const p = props([node('current', '[x](src/a.ts)')])
  p.useSessions = select => select({ byId: {} })
  await f.render(p)
  await f.click('复制文件路径')
  const buttons = [...document.querySelectorAll('button')]
  assert.equal(buttons.find(b => b.textContent === '复制绝对路径').disabled, true)
  assert.equal(buttons.find(b => b.textContent === '复制带行号路径').disabled, true)
  await f.click('复制相对路径')
  assert.match(document.body.textContent, /复制失败/)
})
