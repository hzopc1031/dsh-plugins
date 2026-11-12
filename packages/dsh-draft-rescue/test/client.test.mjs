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
const { Simulate } = require('react-dom/test-utils')
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
  assert.equal(registered, 'dsh-draft-rescue')
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
    render: async props => { await act(async () => root.render(React.createElement(client.DraftRescue, props))) },
    click: async label => {
      const button = [...document.querySelectorAll('button')].find(e => e.textContent === label)
      assert.ok(button, 'missing button ' + label)
      await act(async () => { button.click(); await Promise.resolve() })
    },
  }
}
const input = { draft: '当前', draftRev: 7, phase: 'plain', occurrences: [], attachmentIds: [], queue: [] }

test('预构建 factory 只注册独立会话 action，宿主入口可由真实 Cordis 加载', async t => {
  const f = await setup(t)
  let registration, component
  f.client.apply({ slots: {
    inject: (name, callback) => { assert.equal(name, 'conversation.session.header.actions'); callback() },
    register: (options, impl) => { registration = options; component = impl },
  } })
  assert.equal(registration.id, 'dsh-draft-rescue')
  assert.equal(component, f.client.DraftRescue)
  const ctx = new Context()
  const fiber = ctx.plugin(host)
  await fiber
  await fiber.dispose()
})
for (const version of ['0.2.1-rc.5', '0.2.2-rc.1', 'unknown']) test(version + ' 模拟新会话：隐藏旧草稿可预览、原文复制与末尾 insertText；存储保持原样', async t => {
  const f = await setup(t, version)
  const text = '  未发送的中文🙂\n第二行  '
  localStorageSet('hidden-old', text)
  localStorageSet('new-session', '')
  const before = JSON.stringify(window.localStorage)
  const inserted = []
  await f.render({ useInput: select => select(input), inputActions: { insertText: (...args) => { inserted.push(args); return true } } })
  await f.click('未发送草稿')
  assert.ok(document.body.textContent.includes('hidden-old'))
  assert.ok(!document.body.textContent.includes('new-session'))
  assert.equal(document.querySelector('pre'), null, '正文按需挂载')
  await f.click('预览原文')
  assert.equal(document.querySelector('pre').textContent, text)
  await f.click('复制原文')
  assert.deepEqual(f.copied, [text])
  await f.click('追加到当前输入框')
  assert.equal(inserted[0][0], '\n' + text)
  assert.deepEqual(JSON.parse(JSON.stringify(inserted[0][1])), { start: 2, end: 2, draftRev: 7 })
  assert.equal(JSON.stringify(window.localStorage), before)
  await f.click('关闭')
  assert.equal(document.querySelector('pre'), null)
})
function localStorageSet(id, text) { window.localStorage.setItem('dsh.conversation.' + id, JSON.stringify({ draft: { text, references: [] }, view: null, viewRequest: null })) }

test('large draft lists paginate, mount previews lazily and preserve latest draftRev after input edits',async t=>{
  const f=await setup(t), inserted=[], state={...input}
  for(let i=0;i<45;i++) localStorageSet('session-'+String(i).padStart(2,'0'),'body-'+i)
  const props={sessionId:'a',useInput:select=>select(state),inputActions:{insertText:(...args)=>{inserted.push(args);return true}}}
  await f.render(props);await f.click('未发送草稿')
  assert.equal(document.querySelectorAll('section').length,20)
  assert.equal(document.querySelectorAll('pre').length,0)
  await f.click('下一页');assert.equal(document.querySelectorAll('section').length,20)
  await f.click('下一页');assert.equal(document.querySelectorAll('section').length,5)
  state.draft='newer text';state.draftRev=99;await f.render(props)
  await f.click('追加到当前输入框')
  assert.equal(inserted[0][1].draftRev,99)
  assert.equal(inserted[0][1].start,state.draft.length)
  props.sessionId='b';await f.render(props)
  assert.equal(document.querySelector('[role="dialog"]'),null)
  assert.equal(document.querySelectorAll('pre').length,0)
})
test('未知版本且结构不符时 UI 显示拒绝信息，完全不读取 storage', async t => {
  const f = await setup(t, 'unknown')
  Object.defineProperty(window, 'localStorage', { get() { assert.fail('must not read storage') } })
  await f.render({ useInput: select => select({...input, draftRev: 'bad'}), inputActions: {} })
  await f.click('未发送草稿')
  assert.match(document.body.textContent, /已拒绝读取/)
  assert.equal(document.querySelector('pre'), null)
})
test('过期 revision 插入失败和剪贴板拒绝均显示失败，不误报成功', async t => {
  const f = await setup(t)
  localStorageSet('a', 'old')
  navigator.clipboard.writeText = async () => { throw new Error('denied') }
  await f.render({ useInput: select => select(input), inputActions: { insertText: () => false } })
  await f.click('未发送草稿')
  await f.click('复制原文')
  assert.match(document.body.textContent, /复制失败/)
  await f.click('追加到当前输入框')
  assert.match(document.body.textContent, /已变化、含无法定位的引用块或暂不可编辑/)
})

test('rc.1 malformed storage fails the entire scan and preserves original bytes', async t => {
  const f = await setup(t, '0.2.2-rc.1')
  localStorageSet('a', 'valid')
  window.localStorage.setItem('dsh.conversation.z', JSON.stringify({draft:{text:'future',references:[],unknown:1},view:null,viewRequest:null}))
  const before=JSON.stringify(window.localStorage)
  await f.render({useInput:select=>select(input), inputActions:{insertText(){assert.fail('no write')}}})
  await f.click('未发送草稿')
  assert.match(document.body.textContent,/无法识别草稿格式/)
  assert.equal(document.querySelectorAll('section').length,0)
  assert.equal(JSON.stringify(window.localStorage),before)
})

test('rc.1 target quotes remain untouched when the host rejects an out-of-bounds end span', async t => {
  const f=await setup(t,'0.2.2-rc.1')
  localStorageSet('source','recovered')
  const state={...input,draft:'> quote ',occurrences:[]}
  let writes=0
  await f.render({useInput:select=>select(state), inputActions:{insertText:(_text,span)=>{
    // Official rc.1 projection treats the quote as one character plus trailing space.
    if(span.end>2) return false
    writes++; return true
  }}})
  await f.click('未发送草稿'); await f.click('追加到当前输入框')
  assert.equal(writes,0)
  assert.equal(state.draft,'> quote ')
  assert.match(document.body.textContent,/含无法定位的引用块/)
  await f.click('复制原文'); assert.deepEqual(f.copied,['recovered'])
})

test('missing input hook or insertText refuses before obtaining storage',async t=>{
  const f=await setup(t,'unknown')
  Object.defineProperty(window,'localStorage',{get(){assert.fail('no storage access')}})
  await f.render({}); assert.match(document.body.textContent,/缺少 useInput/)
  await f.render({useInput:select=>select(input),inputActions:{}})
  await f.click('未发送草稿'); assert.match(document.body.textContent,/缺少 insertText/)
})

test('durable title and workspace come from session list or current projection; displayTitle is never used', async t => {
  const f = await setup(t)
  localStorageSet('hidden-old', '旧草稿正文')
  localStorageSet('session-now', '当前草稿正文')
  const byId = {
    'hidden-old': { title: '上周讨论', cwd: 'D:\\work\\alpha', displayTitle: 'hidden-old' },
    'session-now': { title: '', cwd: '', displayTitle: 'session-now' },
  }
  await f.render({
    sessionId: 'session-now',
    useInput: select => select(input),
    inputActions: { insertText: () => true },
    useSessions: select => select({ byId }),
    useProjection: key => {
      assert.notEqual(key, 'displayTitle')
      return key === 'title' ? '今日计划' : key === 'workingDirectory' ? 'D:\\work\\today' : null
    },
  })
  await f.click('未发送草稿')
  assert.match(document.body.textContent, /追加目标：当前会话 session-now/)
  assert.match(document.body.textContent, /标题：今日计划；工作区：D:\\work\\today/)
  assert.match(document.body.textContent, /当前会话草稿/)
  assert.match(document.body.textContent, /标题：上周讨论；工作区：D:\\work\\alpha/)
  assert.doesNotMatch(document.body.textContent, /displayTitle/)
  const box = document.querySelector('label input')
  assert.ok(box, 'missing filter input')
  await act(async () => { Simulate.change(box, { target: { value: '上周' } }) })
  assert.equal(document.querySelectorAll('section').length, 1)
  assert.match(document.body.textContent, /hidden-old/)
  assert.ok(!document.body.textContent.includes('当前草稿正文'))
})

for (const version of ['0.2.2-rc.1', 'unknown']) test(version + ' target quotes use persisted snapshot coordinates without a version gate', async t => {
  const f = await setup(t, version)
  localStorageSet('source', 'recovered')
  const state = { ...input, draft: '> quote ', occurrences: [] }, inserted = []
  let snapshot = { text: state.draft, references: [], quotes: [{ text: 'quote ', offset: 0, length: 8 }] }
  await f.render({ sessionId: 'target', useInput: select => select(state), inputActions: {
    persistDraft: () => window.localStorage.setItem('dsh.conversation.target', JSON.stringify({ draft: snapshot, view: null, viewRequest: null })),
    insertText: (...args) => { inserted.push(args); return true },
  } })
  await f.click('未发送草稿'); await f.click('追加到当前输入框')
  assert.deepEqual(JSON.parse(JSON.stringify(inserted)), [['\nrecovered', { start: 1, end: 1, draftRev: 7 }]])
  snapshot = { ...snapshot, text: 'stale' }
  await f.click('追加到当前输入框')
  assert.equal(inserted.length, 1)
  assert.match(document.body.textContent, /快照与输入框不一致/)
})
