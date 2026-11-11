import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { runInNewContext } from 'node:vm'
import React from 'react'
import { act, create } from 'react-test-renderer'
import { renderToStaticMarkup } from 'react-dom/server'
import * as zod from 'zod'
import { Context, Service } from '@deepseek-ai/cordis'
import { SlotCore } from '@deepseek-ai/dsh-client-ui-slots'
import { remoteErrorOf } from '@deepseek-ai/dsh-typert-protocol'
import { harness } from './harness.mjs'

function clientModule() {
  let registration
  const events = new Map()
  const sandbox = {
    window: {
      __ModuleLoader__: { load: row => { registration = row } },
      addEventListener: (name, callback) => events.set(name, callback),
      removeEventListener: name => events.delete(name),
    },
    TextDecoder, atob, btoa, Uint8Array,
    FormData: class { constructor(form) { this.form = form } get(key) { return this.form.data[key] ?? null } },
  }
  runInNewContext(readFileSync(new URL('../dist/client.js', import.meta.url), 'utf8'), sandbox)
  assert.equal(registration.id, 'dsh-content-evidence')
  const requests = []
  const client = registration.factory(specifier => {
    requests.push(specifier)
    if (specifier === 'react') return React
    if (specifier === 'zod') return zod
    throw new Error(`Unexpected browser dependency: ${specifier}`)
  })
  assert.deepEqual(requests.sort(), ['react', 'zod'])
  return { client, events }
}

// Real Cordis lifecycle and SlotCore, with a descriptor-checked local Remote transport.
async function mount(t) {
  const host = await harness(t)
  const { client, events } = clientModule()
  const ctx = new Context()
  t.after(() => ctx.fiber.dispose())
  const core = new SlotCore()
  const calls = []
  const injections = []
  await ctx.plugin(inner => {
    class Slots extends Service {
      constructor() { super(inner, 'slots') }
      inject(key, callback) {
        assert.ok(core.spec(key), 'slot must already be declared by the shell')
        injections.push(key)
        return this.ctx.effect(callback)
      }
      register(options, component) { return this.ctx.effect(() => core.register(options, component)) }
    }
    new Slots()
    inner.effect(() => core.register({ name: 'root', children: {
      main: { kind: 'keyed', scope: 'root' },
      'sidebar.panellist': { kind: 'list', scope: 'root' },
    } }, () => null))
    class Remote extends Service {
      constructor() { super(inner, 'remote') }
      get contentEvidence() { return this.ctx.get('remote.contentEvidence') }
      async $mount(contribution) {
        assert.equal(contribution.package, 'dsh-content-evidence')
        const owner = this.ctx
        const effect = owner.effect(async () => {
          const fiber = await owner.plugin(namespaceCtx => {
            const namespace = new Service(namespaceCtx, 'remote.contentEvidence')
            for (const descriptor of contribution.descriptors) {
              const method = descriptor.method
              namespace[method] = async (...args) => {
                calls.push({ method, args })
                const input = Object.fromEntries(descriptor.parameters.map((item, i) => [item.wire, args[i]]))
                contribution.methods[`contentEvidence/${method}`].input({ strict: true }).create().parse(input)
                try {
                  const output = await host.ctx.contentEvidence[method](...args, host.signal)
                  return { ok: true, value: descriptor.result.create().parse(output) }
                } catch (error) {
                  assert.ok(remoteErrorOf(error), 'only declared Host errors belong on the Remote failure branch')
                  return { ok: false, error }
                }
              }
            }
          })
          return () => fiber.dispose()
        })
        await effect
        return () => effect()
      }
    }
    new Remote()
  })
  const fiber = await ctx.plugin(client)
  const [entry] = core.entries('main')
  assert.ok(entry)
  assert.deepEqual(injections, ['main', 'sidebar.panellist'])
  let view
  await act(async () => { view = create(React.createElement(entry.component, entry.inject())) })
  t.after(() => act(() => view.unmount()))
  const settle = async () => {
    for (let i = 0; i < 100; i++) {
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 5)) })
      if (view.root.findByProps({ role: 'status' }).children.join('') !== '正在处理…') return
    }
    assert.fail('UI operation did not settle')
  }
  await settle()
  const input = name => view.root.findByProps({ name })
  const button = text => view.root.findAllByType('button').find(node => node.children.join('') === text)
  const submit = async (name, data) => {
    const form = view.root.findAllByType('form').find(node => node.findAllByProps({ name }).length)
    assert.ok(form, 'missing form for ' + name)
    const target = { data, reset() {} }
    await act(async () => { form.props.onSubmit({ preventDefault() {}, currentTarget: target }) })
    await settle()
  }
  const click = async text => { assert.ok(button(text), 'missing button ' + text); await act(async () => { button(text).props.onClick() }); await settle() }
  await act(async () => { view.root.findAllByType('select')[0].props.onChange({ target: { value: host.topic.id } }) })
  await settle()
  assert.deepEqual(view.root.findAllByProps({ role: 'alert' }).map(node => node.children.join('')), [])
  return { ...host, ctx, client, core, calls, fiber, view, input, button, submit, click, events, settle }
}

test('compiled client exports the plugin contract, registers both slots and unmounts its Remote contribution', async t => {
  const ui = await mount(t)
  assert.equal(ui.client.name, 'content-evidence-client')
  assert.equal(typeof ui.client.apply, 'function')
  assert.deepEqual(Array.from(ui.client.inject), ['slots', 'remote'])
  assert.equal(ui.core.entries('main')[0].options.key, 'content-evidence')
  const sidebar = ui.core.entries('sidebar.panellist')[0]
  assert.equal(sidebar.options.id, 'content-evidence')
  assert.match(sidebar.options.label(), /Content evidence/)
  assert.match(renderToStaticMarkup(React.createElement(sidebar.component, { size: 20 })), /<svg/)
  await ui.fiber.dispose()
  assert.equal(ui.core.entries('main').length, 0)
  assert.equal(ui.core.entries('sidebar.panellist').length, 0)
  assert.equal(ui.ctx.get('remote.contentEvidence'), undefined)
})

test('model setup notice stays visible with or without a topic and makes no model or credential request', async t => {
  const ui = await mount(t)
  for (const selected of [true, false]) {
    if (!selected) {
      await act(async () => { ui.view.root.findAllByType('select')[0].props.onChange({ target: { value: '' } }) })
    }
    const notice = ui.view.root.findByProps({ 'aria-label': '模型改写前须知' })
    for (let node = notice; node; node = node.parent) {
      assert.notEqual(node.type, 'details')
      assert.ok(!node.props.hidden)
    }
    const copy = renderToStaticMarkup(React.createElement('aside', notice.props))
    for (const required of ['已有可用模型', '模型列表为空', '设置 → 模型', '登录账号', '提供商的 API Key', '空闲会话', '确认会话提示受限工作台已开启', '四个本地内容证据工具', 'X、小红书、抖音、视频号', 'AI 生成', '待核实', '不检查密钥值', '不从此界面调用模型', '此提示始终显示', '原生工具执行器']) assert.ok(copy.includes(required), required)
    assert.equal(notice.findByType('pre').children.join(''), `/content-evidence workbench ${selected ? ui.topic.id : '<topicId>'}`)
  }
  assert.ok(ui.calls.every(call => ['listTopics', 'readEvidence'].includes(call.method)))
})

test('UI creates topics, stores sources/experiments/claims and renders malicious material as inert text', async t => {
  const ui = await mount(t)
  await ui.submit('idea', { idea: 'UI fixture (not real evidence)' })
  const topic = (await ui.ctx.get('remote.contentEvidence').listTopics()).value.find(item => item.idea.startsWith('UI fixture'))
  await ui.submit('url', { url: 'https://example.com/ui-fixture', title: 'Fixture source' })
  await ui.submit('command', { command: 'echo fixture', output: 'fixture', versions: 'fixture-version', conditions: 'synthetic fixture' })
  let sheet = await uiHostRead(ui, topic.id)
  await ui.submit('claim', { claim: 'Fixture observation', reference: sheet.sources[0].id })
  const payload = '<script>globalThis.previewExecuted=true</script><img src=x onerror="alert(1)"><svg onload="alert(1)"/>'
  await ui.submit('file', {
    file: { name: 'fixture.html', type: 'text/html', size: Buffer.byteLength(payload), arrayBuffer: async () => new TextEncoder().encode(payload).buffer },
    sourceId: sheet.sources[0].id,
  })
  await ui.click('查看 fixture.html')
  const preview = ui.view.root.findByProps({ 'aria-label': '材料预览' })
  assert.equal(preview.findAllByType('script').length, 0)
  assert.equal(preview.findAllByType('iframe').length, 0)
  assert.equal(preview.findAllByType('img').length, 0)
  assert.equal(preview.findByType('pre').children.join(''), payload)
  const html = renderToStaticMarkup(React.createElement('div', preview.props))
  assert.ok(html.includes('&lt;script&gt;'))
  assert.ok(!html.includes('<script>'))
  sheet = await uiHostRead(ui, topic.id)
  assert.equal(sheet.claims[0].status, '有来源')
  assert.equal(sheet.experiments[0].output, 'fixture')
  assert.equal(sheet.materials.length, 1)
  assert.ok(ui.calls.every(call => !/publish|post|login|shell|browser|model/i.test(call.method)))
})

async function uiHostRead(ui, topicId = ui.topic.id) {
  return (await ui.ctx.get('remote.contentEvidence').readEvidence(topicId)).value
}

test('material previews only embed recognized raster bytes; SVG and spoofed image types stay text', () => {
  const { client } = clientModule()
  for (const mediaType of ['text/html', 'image/svg+xml', 'image/png', 'image/jpeg', 'image/gif', 'image/webp']) {
    const payload = '<svg onload="alert(1)"><script>alert(1)</script></svg>'
    const preview = client.materialPreview({ mediaType, base64: btoa(payload) })
    assert.equal(preview.image, null)
    assert.equal(preview.text, payload)
  }
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN9sAAAAASUVORK5CYII='
  assert.equal(client.materialPreview({ mediaType: 'image/png', base64: png }).image, 'data:image/png;base64,' + png)
})

test('UI saves four platform shapes, reviews current drafts and invalidates approval after editing', async t => {
  const ui = await mount(t)
  await ui.submit('url', { url: 'https://example.com/fixture', title: 'Fixture' })
  const sheet = await uiHostRead(ui)
  await ui.submit('claim', { claim: 'Fixture observation', reference: sheet.sources[0].id })
  await ui.click('四平台草稿')
  const change = async (label, content) => {
    const field = ui.view.root.findAllByType('label').find(node => node.children[0] === label)
    assert.ok(field, 'missing draft field ' + label)
    await act(async () => { field.findByType('textarea').props.onChange({ target: { value: content } }) })
  }
  for (const platform of ['x', 'xiaohongshu', 'douyin', 'weixin-video']) {
    const selector = ui.view.root.findAllByType('label').find(node => node.children[0] === '平台').findByType('select')
    await act(async () => { selector.props.onChange({ target: { value: platform } }) })
    if (platform === 'x') await change('单条正文', 'AI 生成：Fixture observation')
    else if (platform === 'xiaohongshu') {
      await change('标题', 'Fixture'); await change('正文', 'AI 生成：Fixture observation'); await change('卡片文案 · 1', 'Fixture card')
    } else {
      await change('口播脚本', 'AI 生成：Fixture observation'); await change('镜头 · 1', 'Fixture shot')
    }
    await act(async () => { ui.view.root.findByProps({ type: 'checkbox' }).props.onChange({ target: { checked: true } }) })
    assert.equal(selector.props.disabled, true)
    assert.ok(ui.events.has('beforeunload'))
    await act(async () => { ui.button('保存草稿').parent.props.onSubmit({ preventDefault() {} }) })
    await ui.settle()
    assert.equal(ui.events.has('beforeunload'), false)
    await ui.click('检查已保存草稿')
    assert.equal((await uiHostRead(ui)).drafts[platform].review.status, 'passed')
    await change(platform === 'x' ? '单条正文' : platform === 'xiaohongshu' ? '正文' : '口播脚本', 'AI 生成：Edited fixture')
    assert.equal(ui.button('检查已保存草稿').props.disabled, true)
    await act(async () => { ui.button('保存草稿').parent.props.onSubmit({ preventDefault() {} }) })
    await ui.settle()
    assert.equal((await uiHostRead(ui)).drafts[platform].review.status, 'pending')
    if (platform === 'x') {
      const format = ui.view.root.findAllByType('label').find(node => node.children[0] === 'X 格式').findByType('select')
      await act(async () => { format.props.onChange({ target: { value: 'x-thread' } }) })
      await ui.click('添加帖子')
      await change('帖子 · 2', 'Other fixture post')
      await act(async () => { ui.button('保存草稿').parent.props.onSubmit({ preventDefault() {} }) })
      await ui.settle()
      assert.deepEqual(Array.from((await uiHostRead(ui)).drafts.x.body.posts), ['AI 生成：Edited fixture', 'Other fixture post'])
    }
  }
})

test('a conflicting UI save preserves both the completed Host draft and the current editor text', async t => {
  const ui = await mount(t)
  await ui.click('四平台草稿')
  const textarea = ui.view.root.findAllByType('textarea').find(node => node.props.value !== undefined)
  await act(async () => { textarea.props.onChange({ target: { value: 'Local unsaved fixture' } }) })
  const sheet = await uiHostRead(ui)
  const saved = await ui.ctx.get('remote.contentEvidence').saveDraft(ui.topic.id, 'x', {
    body: { kind: 'x-single', post: 'Completed elsewhere' }, claimIds: [], expectedRevision: 0, evidenceHash: sheet.evidenceHash,
  })
  assert.equal(saved.ok, true)
  await act(async () => { ui.button('保存草稿').parent.props.onSubmit({ preventDefault() {} }) })
  await ui.settle()
  assert.match(ui.view.root.findByProps({ role: 'alert' }).children.join(''), /本次未覆盖/)
  assert.equal(textarea.props.value, 'Local unsaved fixture')
  assert.equal((await uiHostRead(ui)).drafts.x.body.post, 'Completed elsewhere')
  await ui.click('放弃草稿编辑并刷新')
  assert.equal(ui.view.root.findAllByType('textarea').find(node => node.props.value !== undefined).props.value, 'Completed elsewhere')
})

test('UI exports saved copy into a Host directory and backfills a URL without visiting it', async t => {
  const ui = await mount(t)
  const directory = await mkdtemp(join(tmpdir(), 'content-evidence-ui-export-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const sheet = await uiHostRead(ui)
  const result = await ui.ctx.get('remote.contentEvidence').saveDraft(ui.topic.id, 'x', {
    body: { kind: 'x-single', post: 'UI export fixture' }, claimIds: [], expectedRevision: 0, evidenceHash: sheet.evidenceHash,
  })
  assert.equal(result.ok, true)
  await ui.click('刷新')
  await ui.click('本地导出')
  await ui.submit('directory', { directory: '../escape', format: 'all' })
  assert.match(ui.view.root.findByProps({ role: 'alert' }).children.join(''), /invalid-input/)
  await ui.submit('directory', { directory, format: 'all' })
  const exported = (await uiHostRead(ui)).exports[0]
  assert.equal(exported.status, 'complete')
  assert.match(readFileSync(join(exported.directory, 'draft.txt'), 'utf8'), /UI export fixture/)
  const url = 'https://example.com/manually-published-fixture'
  await ui.submit('publishedUrl', { publishedUrl: url })
  assert.equal((await uiHostRead(ui)).publishedLinks[0].url, url)
  assert.equal(ui.calls.filter(call => call.method === 'backfillPublishedLink').length, 1)
  assert.ok(ui.calls.every(call => !/publish|post|login|shell|browser|model/i.test(call.method.replace('backfillPublishedLink', ''))))
})

test('an evidence reload refreshes editor content together with an externally saved revision', async t => {
  const ui = await mount(t)
  const sheet = await uiHostRead(ui)
  const saved = await ui.ctx.get('remote.contentEvidence').saveDraft(ui.topic.id, 'x', {
    body: { kind: 'x-single', post: 'New completed copy' }, claimIds: [], expectedRevision: 0, evidenceHash: sheet.evidenceHash,
  })
  assert.equal(saved.ok, true)
  await ui.submit('url', { url: 'https://example.com/fixture', title: 'Fixture' })
  assert.equal(ui.view.root.findAllByType('textarea').find(node => node.props.value !== undefined).props.value, 'New completed copy')
})
