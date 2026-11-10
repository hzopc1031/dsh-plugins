import test from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { abortable, requireDesktop, shotUrl, fileInputFor, injectFile, FALLBACK } from '../lib/intake.js'

const require = createRequire(import.meta.url)
const url = 'http://127.0.0.1:12345/shot/31234567-1234-4123-8123-123456789abc'
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
const boot = { release: { version: '0.2.1-rc.5' } }
test('RPC watchdog aborts an unsettled call and safely handles late rejection', async () => {
  const pending = Promise.withResolvers(), c = new AbortController()
  const result = abortable(pending.promise, c.signal)
  c.abort(); await assert.rejects(result, /已结束/)
  pending.reject(new Error('late transport rejection'))
  await wait(0)
})
test('abortable preserves successful and failed RPC results', async () => {
  assert.equal(await abortable(Promise.resolve(42), new AbortController().signal), 42)
  await assert.rejects(abortable(Promise.reject(new Error('transport')), new AbortController().signal), /transport/)
})
test('version and desktop origin fail closed', () => {
  requireDesktop(boot, { protocol: 'dsh-app:', hostname: 'app' })
  for (const data of [undefined, {}, { release: { version: '0.2.2-rc.1' } }]) assert.throws(() => requireDesktop(data, { protocol: 'dsh-app:', hostname: 'app' }))
  for (const location of [{ protocol: 'https:', hostname: 'app' }, { protocol: 'dsh-app:', hostname: 'shell' }]) assert.throws(() => requireDesktop(boot, location))
})
test('server URL parser accepts only exact IPv4 loopback, valid port and UUID', () => {
  assert.equal(shotUrl('截图就绪 ' + url), url)
  for (const value of [undefined, url, '截图就绪 ' + url + '?file=x', '截图就绪 ' + url.replace('127.0.0.1', 'evil.example'), '截图就绪 ' + url.replace('12345', '99999'), '截图就绪 ' + url.replace('12345', '0')]) assert.throws(() => shotUrl(value))
})

async function setup(t) {
  const dom = new JSDOM('<div data-composer-card><input type="file" multiple hidden><div id="root"></div></div><input id="unrelated" type="file" multiple hidden>', { url: 'dsh-app://app/' })
  const saved = new Map()
  function set(key, value) { saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { configurable: true, writable: true, value }) }
  set('window', dom.window); set('document', dom.window.document); set('navigator', dom.window.navigator)
  set('File', dom.window.File); set('IS_REACT_ACT_ENVIRONMENT', true)
  let response = { status: 200, headers: { get: () => 'image/png' }, blob: async () => new dom.window.Blob(['png'], { type: 'image/png' }) }
  let fetches = 0, calls = [], refused = false, command, delay=0, intakeTimer
  set('fetch', async (address, opts) => {
    fetches++; assert.equal(address, url); assert.equal(opts.credentials, 'omit'); assert.equal(opts.redirect, 'error')
    return response
  })
  window.__DSH_BOOT__ = boot
  window.DataTransfer = class {
    constructor() {
      const files = []
      this.items = { add: file => files.push(file) }
      this.files = files
    }
  }
  const input = document.querySelector('input')
  let transferred
  Object.defineProperty(input, 'files', { get: () => transferred, set: value => { transferred = value } })
  let state = { phase: 'plain', attachmentIds: [] }
  let session = { removed: false, subagent: null }
  const root = createRoot(document.getElementById('root'))
  let exports, id
  window.__ModuleLoader__ = { load: row => { id = row.id; exports = row.factory(name => {
    assert.ok(['react', 'react/jsx-runtime'].includes(name)); return require(name)
  }) } }
  vm.runInNewContext(readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8'), {
    window, document, navigator, File, fetch: globalThis.fetch, AbortController, setTimeout, clearTimeout,
  })
  assert.equal(id, 'dsh-snip-attach')
  const props = { sessionId: 'session-A', useInput: select => select(state), useSession: select => select(session), execute: async (...args) => {
    calls.push(args)
    return command ?? { ok: true, value: { commandId: '1', result: { kind: 'success', text: '截图就绪 ' + url } } }
  } }
  const render = () => root.render(React.createElement(exports.SnipButton, props))
  const renderAsync = async () => { await act(async () => render()) }
  input.addEventListener('change', () => {
    if (refused) return
    const accept=()=>{state = { ...state, attachmentIds: [...state.attachmentIds, 'new-image'] }; render()}
    if(delay) intakeTimer=setTimeout(accept,delay); else accept()
  })
  t.after(async () => {
    clearTimeout(intakeTimer)
    await act(async () => root.unmount()); dom.window.close()
    for (const [key, d] of saved) { if (d) Object.defineProperty(globalThis, key, d); else delete globalThis[key] }
  })
  await renderAsync()
  return {
    exports, input, props, calls,
    transferred: () => transferred, fetches: () => fetches,
    response: value => { response = value }, command: value => { command = value }, refuse: () => { refused = true },
    delay: value => {delay=value},
    state: async value => { state = { ...state, ...value }; await renderAsync() },
    session: async value => { session = { ...session, ...value }; await renderAsync() },
    render: renderAsync,
    click: async (ms = 140) => {
      await act(async () => { document.querySelector('button').click() })
      for(let elapsed=0;elapsed<ms;elapsed+=50) await act(async () => { await wait(Math.min(50,ms-elapsed)) })
    },
    press: async (label, ms = 140) => {
      const button = [...document.querySelectorAll('button')].find(e => e.textContent === label)
      assert.ok(button, 'missing button ' + label)
      await act(async () => { button.click() })
      for(let elapsed=0;elapsed<ms;elapsed+=50) await act(async () => { await wait(Math.min(50,ms-elapsed)) })
    },
  }
}
test('factory registers only left input slot and retains RPC context', async t => {
  const f = await setup(t)
  let options, component
  f.exports.apply({ slots: {
    inject: (slot, cb) => { assert.equal(slot, 'conversation.input.left'); cb() },
    register: (o, c) => { options = o; component = c },
  }, remote: { commands: { execute() {} } } })
  assert.equal(options.id, 'dsh-snip-attach'); assert.equal(typeof component, 'function')
})

test('slow file intake gets a bounded wait and an honest verification notice',async t=>{
  const f=await setup(t); f.delay(400)
  await f.click()
  assert.equal(f.transferred(), undefined)
  assert.match(document.body.textContent,/请确认后再加入待发送附件/)
  await f.press('确认加入', 650)
  assert.match(document.body.textContent,/请核对待发送图片/)
  assert.doesNotMatch(document.body.textContent,/截图已加入/)
})

test('unrelated attachment growth is never reported as confirmed screenshot success',async t=>{
  const f=await setup(t);f.refuse()
  await f.click()
  assert.equal(f.transferred(), undefined)
  await f.press('确认加入', 2200)
  await f.state({attachmentIds:['unrelated-image']})
  await act(async()=>{await wait(100)})
  assert.doesNotMatch(document.body.textContent,/截图已加入/)
  assert.match(document.body.textContent,/图片已在剪贴板，可按 Ctrl\+V/)
})
test('camera executes scoped command, blob becomes PNG File, correct composer receives change and success toast', async t => {
  const f = await setup(t)
  await f.click()
  assert.deepEqual(JSON.parse(JSON.stringify(f.calls)), [['session-A', '/screenshot', []]])
  assert.equal(f.fetches(), 1)
  assert.equal(f.transferred(), undefined, 'preview must not inject yet')
  assert.match(document.body.textContent, /请确认后再加入待发送附件/)
  await f.press('确认加入')
  assert.equal(f.transferred()[0].type, 'image/png'); assert.match(f.transferred()[0].name, /^screenshot-\d+\.png$/)
  assert.match(document.body.textContent, /已提交截图，请核对待发送图片/)
  assert.doesNotMatch(document.body.textContent, /截图已加入待发送消息/)
  assert.equal(document.getElementById('unrelated').files.length, 0)
})
test('busy, claimed, removed and subagent inputs disable capture', async t => {
  const f = await setup(t)
  for (const phase of ['adjudicating', 'claimed', 'submitting']) {
    await f.state({ phase }); await f.click(0); assert.equal(f.calls.length, 0)
  }
  await f.state({ phase: 'plain' }); await f.session({ removed: true }); await f.click(0); assert.equal(f.calls.length, 0)
  await f.session({ removed: false, subagent: {} }); await f.click(0); assert.equal(f.calls.length, 0)
})
test('unsupported version and browser origin disable capture', async t => {
  const f = await setup(t)
  window.__DSH_BOOT__ = { release: { version: '0.2.2' } }; await f.render(); await f.click(0)
  assert.equal(f.calls.length, 0)
})
test('204 cancellation adds nothing and shows cancellation notice', async t => {
  const f = await setup(t); f.response({ status: 204 })
  await f.click(); assert.equal(f.transferred(), undefined); assert.match(document.body.textContent, /已取消或未完成/)
})
test('RPC transport and command failures are handled without fetch', async t => {
  const f = await setup(t)
  for (const command of [{ ok: false }, { ok: true, value: undefined }, { ok: true, value: { result: { kind: 'error', text: '已有截图' } } }]) {
    f.command(command); await f.click(0); assert.equal(f.fetches(), 0)
  }
  assert.match(document.body.textContent, /已有截图/)
})
test('HTTP failure, wrong MIME and malformed URL cannot inject files', async t => {
  const f = await setup(t)
  for (const response of [{ status: 404 }, { status: 200, headers: { get: () => 'text/html' } }]) {
    f.response(response); await f.click(0); assert.equal(f.transferred(), undefined)
  }
  f.command({ ok: true, value: { result: { kind: 'success', text: '截图就绪 https://evil.example/' } } })
  await f.click(0); assert.equal(f.fetches(), 2)
})
test('DataTransfer failure and intake rejection both show Ctrl+V fallback without false success', async t => {
  const f = await setup(t)
  const transfer = window.DataTransfer
  window.DataTransfer = undefined
  await f.click()
  assert.equal(f.transferred(), undefined)
  await f.press('确认加入')
  assert.match(document.body.textContent, /图片已在剪贴板，可按 Ctrl\+V/)
  window.DataTransfer = transfer; f.refuse(); await f.click(); await f.press('确认加入', 2200)
  assert.match(document.body.textContent, /图片已在剪贴板，可按 Ctrl\+V/)
  assert.doesNotMatch(document.body.textContent, /截图已加入/)
})
test('selector is scoped to unique hidden multiple input; missing/disabled/ambiguous input fails', async t => {
  const f = await setup(t), button = document.querySelector('button')
  assert.equal(fileInputFor(button), f.input)
  f.input.disabled = true; assert.throws(() => fileInputFor(button), /Ctrl\+V/)
  f.input.disabled = false
  f.input.parentElement.append(f.input.cloneNode()); assert.throws(() => fileInputFor(button), /Ctrl\+V/)
  f.input.parentElement.querySelectorAll('input').forEach(i => i.remove())
  assert.throws(() => fileInputFor(button), /Ctrl\+V/)
  assert.throws(() => injectFile(f.input, new File(['x'], 'x.png')), /Ctrl\+V/)
})
test('session changes while fetching never inject into the new composer', async t => {
  const f = await setup(t), pending = Promise.withResolvers()
  f.response({ status: 200, headers: { get: () => 'image/png' }, blob: () => pending.promise })
  await f.click(0)
  f.props.sessionId = 'session-B'; await f.render()
  await act(async () => { pending.resolve(new window.Blob(['png'])); await wait(120) })
  assert.equal(f.transferred(), undefined)
  assert.equal(document.querySelector('button').disabled, false)
})

test('cancelling preview does not inject the screenshot', async t => {
  const f = await setup(t)
  await f.click()
  assert.match(document.body.textContent, /请确认后再加入待发送附件/)
  await f.press('取消')
  assert.equal(f.transferred(), undefined)
  assert.match(document.body.textContent, /已取消加入附件/)
  assert.equal([...document.querySelectorAll('button')].some(b => b.textContent === '确认加入'), false)
})

test('session change after preview clears the confirmation UI and never injects', async t => {
  const f = await setup(t)
  await f.click()
  assert.ok([...document.querySelectorAll('button')].some(b => b.textContent === '确认加入'))
  f.props.sessionId = 'session-B'; await f.render()
  assert.equal(f.transferred(), undefined)
  assert.equal([...document.querySelectorAll('button')].some(b => b.textContent === '确认加入'), false)
})
