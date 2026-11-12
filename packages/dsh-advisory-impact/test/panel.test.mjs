import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFile, symlink } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { EventEmitter } from 'node:events'
import path from 'node:path'
import * as React from 'react'
import { create, act } from 'react-test-renderer'
import { AdvisoryService, createViewModel, evaluatePins } from '../index.js'
import { panelOverview, sourceExpired } from '../lib/panel-model.js'
import { panelRequest, registerPanel, PANEL_PATH } from '../lib/panel-host.js'
import { setup, config } from './surface-fixtures.mjs'
import { AT } from './fixture-http.mjs'

async function bundle(
  document = {
    createElement: () => ({
      dataset: {},
      remove() {
        this.removed = true
      }
    }),
    head: { appendChild() {} }
  }
) {
  let entry
  vm.runInNewContext(await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'), {
    window: {
      __ModuleLoader__: {
        load(value) {
          entry = value
        }
      }
    },
    URL,
    Date,
    setInterval,
    clearInterval,
    fetch: (...args) => globalThis.fetch(...args),
    navigator: { clipboard: { writeText: async () => {} } },
    document
  })
  assert.equal(entry.id, 'dsh-advisory-impact')
  return entry.factory(id => {
    assert.equal(id, 'react', 'only React may escape the bundle')
    return React
  })
}

function routeHarness(service) {
  let route,
    rejection,
    authCalls = 0
  registerPanel(
    {
      inject(dependencies, callback) {
        assert.deepEqual(dependencies, ['webServer', 'connection'])
        callback({
          effect(callback) {
            this.dispose = callback()
          },
          webServer: {
            register(value) {
              route = value
              return () => {}
            }
          },
          connection: {
            requestRejection() {
              authCalls++
              return rejection
            }
          }
        })
      }
    },
    service
  )
  assert.equal(route.path, PANEL_PATH)
  assert.equal(route.kind, 'exact')
  return {
    setRejection: value => {
      rejection = value
    },
    get authCalls() {
      return authCalls
    },
    async request(value, options = {}) {
      const req = Readable.from([Buffer.from(options.raw ?? JSON.stringify(value))])
      req.method = options.method ?? 'POST'
      req.headers = { 'content-type': options.contentType ?? 'application/json' }
      const res = Object.assign(new EventEmitter(), {
        headers: {},
        statusCode: 0,
        writableEnded: false,
        setHeader(key, value) {
          this.headers[key] = value
        },
        end(value) {
          this.body = JSON.parse(value)
          this.writableEnded = true
        }
      })
      await route.handler(req, res)
      return res
    }
  }
}

const textOf = node => (typeof node === 'string' ? node : (node.children ?? []).map(textOf).join(''))
const buttons = tree => tree.root.findAllByType('button')
const button = (tree, text) => buttons(tree).find(b => textOf(b).includes(text))
async function interaction(tree, callback) {
  await act(async () => {
    callback()
    for (let i = 0; i < 500; i++) {
      await new Promise(resolve => setTimeout(resolve, 2))
      if (!tree.root.findByProps({ className: 'ai-root' }).props['aria-busy']) return
    }
    throw new Error('UI operation did not settle')
  })
}

async function mount(t, options) {
  const f = await setup(t),
    service = new AdvisoryService({ ...f, config: options ?? config })
  const route = routeHarness(service),
    actions = []
  let hold,
    fail = false
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(url, 'advisory-impact/api', 'browser can only call the local host route')
    assert.equal(init.credentials, 'same-origin')
    const input = JSON.parse(init.body)
    actions.push(input.action)
    if (hold) await hold
    if (fail) throw new Error('fixture browser disconnected')
    const res = await route.request(input)
    return { ok: res.statusCode === 200, json: async () => res.body }
  })
  const client = await bundle()
  let tree
  await act(async () => {
    tree = create(React.createElement(client.Panel))
  })
  t.after(async () => {
    await act(async () => tree.unmount())
  })
  const input = tree.root.findByProps({ placeholder: '填写本机已有项目目录' })
  act(() => input.props.onChange({ target: { value: f.root } }))
  await interaction(tree, () => tree.root.findByProps({ className: 'ai-card ai-setup' }).findAllByType('form')[0].props.onSubmit({ preventDefault() {} }))
  return {
    f,
    service,
    route,
    actions,
    tree,
    disconnect: () => {
      fail = true
    },
    hold: promise => {
      hold = promise
    }
  }
}

test('client factory registers native keyed main and sidebar seats, materializes only host React and cleans styles', async () => {
  const styles = []
  const client = await bundle({
      createElement: () => ({
        dataset: {},
        remove() {
          this.removed = true
        }
      }),
      head: {
        appendChild(style) {
          styles.push(style)
        }
      }
    }),
    registrations = [],
    cleanups = []
  assert.equal(client.name, 'advisory-impact')
  assert.deepEqual([...client.inject], ['slots'])
  // Same structural slot harness used by the reference; this is not a live DSH browser.
  client.apply({
    effect(callback) {
      cleanups.push(callback())
    },
    slots: {
      inject(name, callback) {
        cleanups.push(callback())
      },
      register(options, render) {
        registrations.push({ options, render })
        return () => registrations.pop()
      }
    }
  })
  assert.equal(registrations[0].options.name, 'main')
  assert.equal(registrations[0].options.key, 'advisory-impact')
  assert.equal(registrations[1].options.name, 'sidebar.panellist')
  assert.equal(registrations[1].options.id, 'advisory-impact')
  assert.equal(registrations[1].options.label, '公告影响')
  assert.equal(registrations[2].options.key, 'dsh-advisory-impact#advisory-impact')
  assert.equal(registrations[0].render({}).type, client.Panel)
  assert.equal(styles.length, 1)
  assert.ok(styles[0].textContent.includes('--dsw-alias-state-error-primary'))
  for (const cleanup of cleanups.reverse()) cleanup()
  assert.equal(styles[0].removed, true)
  assert.equal(registrations.length, 0)
  const css = await readFile(new URL('../src/panel.css', import.meta.url), 'utf8')
  for (const token of [
    'label-primary',
    'bg-layer-1',
    'state-error-primary',
    'state-success-primary',
    'state-warn-label'
  ])
    assert.ok(css.includes('--dsw-alias-' + token))
  assert.match(css, /focus-visible/)
  assert.match(css, /@container/)
})

test('panel overview preserves semantic counts, source times, null inventory and distinct nonofficial groups', async t => {
  const f = await setup(t),
    evaluation = await evaluatePins({ ...f, config })
  const view = createViewModel(evaluation),
    model = panelOverview(view, Date.parse(AT))
  assert.deepEqual(
    model.cards.slice(0, 3).map(c => c.value),
    ['affected', 'not_affected', 'unknown'].map(k => view.counts[k])
  )
  assert.equal(model.cards[3].value, view.suppressions.items.length)
  assert.equal(model.cards[4].value, view.projects[0].osvOnly.items.length)
  assert.ok(model.cards.every(c => c.sources.length && c.oldestFetchTime.includes('UTC+8')))
  assert.ok(view.projects[0].osvOnly.items.every(i => !('verdict' in i)))
  assert.ok(!sourceExpired(view.projects[0].source, 1000, Date.parse(AT) + 999))
  assert.ok(sourceExpired(view.projects[0].source, 1000, Date.parse(AT) + 1000))
  assert.ok(panelOverview(view, Date.parse(AT) + 1000).stale)
  const partial = createViewModel(
    await evaluatePins({ ...f, config: { ...config, watch: ['kafka', 'custom-project'] } })
  )
  assert.equal(panelOverview(partial, Date.parse(AT)).cards[0].partial, true)
  assert.notEqual(panelOverview(partial, Date.parse(AT)).cards[0].value, null)
  const missing = createViewModel(await evaluatePins({ ...f, config: { watch: ['custom-project'] } }))
  assert.ok(panelOverview(missing, Date.parse(AT)).cards.every(c => c.value === null))
  assert.equal(panelOverview(missing, Date.parse(AT)).failed, true)
  const noQuery = createViewModel(await evaluatePins({ ...f, config: { watch: ['kafka'] } }))
  assert.equal(panelOverview(noQuery, Date.parse(AT)).cards[4].value, null)
  f.tick(1001)
  f.failAll()
  const fallback = createViewModel(await evaluatePins({ ...f, config, force: true }))
  const fallbackModel = panelOverview(fallback, Date.parse(AT) + 1001)
  assert.equal(fallbackModel.stale, true)
  assert.equal(fallbackModel.failed, true)
  assert.equal(fallbackModel.cards[0].oldestFetchTime, model.cards[0].oldestFetchTime)
  assert.equal(fallback.projects[0].source.state, 'stale')
})

test('host route authenticates every request, rejects unsafe inputs and uses existing confined service', async t => {
  const f = await setup(t),
    service = new AdvisoryService({ ...f, config }),
    h = routeHarness(service)
  const valid = { directory: f.root, action: 'pin' }
  for (const code of [401, 403]) {
    h.setRejection(code)
    assert.equal((await h.request(valid)).statusCode, code)
  }
  assert.equal(f.calls.length, 0)
  h.setRejection(undefined)
  assert.equal((await h.request(valid, { method: 'GET' })).statusCode, 405)
  assert.equal((await h.request(valid, { contentType: 'text/plain' })).statusCode, 415)
  assert.equal((await h.request(valid, { raw: '{' })).statusCode, 400)
  assert.equal((await h.request(valid, { raw: 'x'.repeat(65537) })).statusCode, 413)
  const bad = [
    null,
    [],
    { ...valid, directory: '../escape' },
    { ...valid, directory: `${f.root}/../escape` },
    { ...valid, path: '/elsewhere' },
    { ...valid, action: 'lookup' },
    { ...valid, action: 'pin', args: { project: 'kafka', version: 123 } },
    { ...valid, args: { project: 'kafka', remove: 'yes' } },
    { ...valid, args: { project: 'kafka', remove: true, version: '3.7.0' } },
    { ...valid, action: 'report', args: { save: true } },
    { ...valid, action: 'refresh', args: { url: 'https://elsewhere/' } },
    { ...valid, action: 'watch', args: { watch: ['kafka', 'kafka'] } }
  ]
  for (const value of bad) {
    assert.throws(() => panelRequest(value))
    assert.equal((await h.request(value)).statusCode, 400)
  }
  const link = path.join(f.root, 'link')
  await symlink(f.root, link)
  assert.equal((await h.request({ ...valid, directory: link })).statusCode, 400)
  const pins = await h.request(valid)
  assert.equal(pins.statusCode, 200)
  assert.equal(pins.headers['cache-control'], 'no-store')
  assert.equal(f.calls.length, 0, 'reading settings never fetches advisories')
  const result = await h.request({ ...valid, action: 'view' })
  assert.equal(result.statusCode, 200)
  assert.ok(result.body.view.projects[0].advisories.length)
  assert.ok(!JSON.stringify(result.body).includes('<html'))
  assert.ok(h.authCalls > bad.length)
})

test('native panel runs without chat/model, shows evidence, OSV 404, groups, report and refresh fallback', async t => {
  const h = await mount(t),
    { tree } = h
  assert.deepEqual(h.actions, ['pin'])
  assert.equal(h.f.calls.length, 0)
  await interaction(tree, () => button(tree, '核对 / 刷新').props.onClick())
  let output = textOf(tree.toJSON())
  for (const copy of [
    '受影响',
    '无法判断',
    '官方修复版本',
    '3.7.1',
    'HTTP 404',
    '官方不适用说明 · suppressions',
    '仅见 OSV，未见官方公告',
    'UTC+8'
  ])
    assert.ok(output.includes(copy), copy)
  const verdicts = tree.root.findAll(n => n.type === 'article' && n.props.className?.includes('ai-verdict'))
  assert.ok(verdicts.length)
  for (const card of verdicts) {
    assert.ok(card.findAllByType('a').some(a => a.props.href.startsWith('https://kafka.apache.org/')))
    assert.ok(textOf(card).includes('抓取'))
  }
  assert.ok(tree.root.findAllByType('a').some(a => a.props.href.includes('dependencycheck-suppressions.xml')))
  await interaction(tree, () => button(tree, '查看报告').props.onClick())
  assert.match(
    tree.root.findByProps({ 'aria-label': '中文 Markdown 报告' }).props.value,
    /# 官方公告影响核对/
  )
  const beforeTime = tree.root
    .findAllByType('span')
    .map(textOf)
    .find(s => s.includes('抓取') && s.includes('UTC+8'))
  h.f.tick(1001)
  h.f.failAll()
  await interaction(tree, () => button(tree, '刷新来源').props.onClick())
  output = textOf(tree.toJSON())
  assert.ok(output.includes('最后成功'))
  assert.ok(output.includes('最后成功缓存'))
  assert.ok(output.includes(beforeTime))
  h.disconnect()
  await interaction(tree, () => button(tree, '刷新来源').props.onClick())
  assert.ok(textOf(tree.toJSON()).includes('下方保留上次结果'))
  assert.ok(tree.root.findAll(n => n.type === 'article' && n.props.className?.includes('ai-verdict')).length)
})

test('project selector, show more, unavailable custom projects, version editing and visible loading work', async t => {
  const h = await mount(t, { watch: ['kafka', 'hadoop', 'flink', 'custom-project'] }),
    { tree } = h
  let release
  h.hold(
    new Promise(resolve => {
      release = resolve
    })
  )
  act(() => button(tree, '核对 / 刷新').props.onClick())
  assert.equal(tree.root.findByProps({ className: 'ai-root' }).props['aria-busy'], true)
  assert.ok(button(tree, '处理中').props.disabled)
  await interaction(tree, () => {
    release()
    h.hold(null)
  })
  assert.ok(textOf(tree.toJSON()).includes('未填写运行版本，无法判断'))
  act(() => button(tree, 'Hadoop').props.onClick())
  const count = () =>
    tree.root.findAll(n => n.type === 'article' && n.props.className?.includes('ai-verdict')).length
  assert.equal(count(), 6)
  act(() => button(tree, '显示更多').props.onClick())
  assert.ok(count() > 6)
  act(() => button(tree, 'Flink').props.onClick())
  assert.match(textOf(tree.toJSON()), /实验性列表/)
  act(() => button(tree, 'custom-project').props.onClick())
  assert.match(textOf(tree.toJSON()), /官方清单不可用/)
  const versionInput = tree.root.findAllByType('label').find(n => textOf(n).includes('实际运行版本')).findByType('input')
  act(() => versionInput.props.onChange({ target: { value: '3.7.0' } }))
  await interaction(tree, () => tree.root.findByProps({ className: 'ai-card ai-version-editor' }).findByType('form').props.onSubmit({ preventDefault() {} }))
  assert.ok(textOf(tree.toJSON()).includes('配置已保存'))
  assert.equal(count(), 0, 'old verdicts must disappear when pins change')
  assert.ok(h.actions.includes('pin'))
})

test('fixed official versions render not affected; total source failure renders unavailable evidence', async t => {
  const h = await mount(t, {
    ...config,
    pins: [{ project: 'kafka', version: '3.7.1', component: 'kafka-clients' }]
  })
  await interaction(h.tree, () => button(h.tree, '核对 / 刷新').props.onClick())
  const fixedCard = h.tree.root
    .findAll(n => n.type === 'article' && n.props.className?.includes('ai-not_affected'))
    .find(n => textOf(n).includes('CVE-2024-31141'))
  assert.ok(fixedCard)
  assert.match(textOf(fixedCard), /不受影响/)
  assert.ok(fixedCard.findAllByType('a').some(a => a.props.href.endsWith('#CVE-2024-31141')))
})

test('changing the watch list clears the previous verdicts and report before the next evaluation', async t => {
  const { tree } = await mount(t)
  await interaction(tree, () => button(tree, '核对 / 刷新').props.onClick())
  await interaction(tree, () => button(tree, '查看报告').props.onClick())
  assert.ok(tree.root.findAllByType('textarea').length)
  act(() => tree.root.findAllByType('label').find(n => textOf(n).includes('关注项目（英文 id')).findByType('input').props.onChange({ target: { value: 'flink' } }))
  await interaction(tree, () => tree.root.findByProps({ className: 'ai-card ai-setup' }).findAllByType('form')[1].props.onSubmit({ preventDefault() {} }))
  assert.equal(tree.root.findAllByType('textarea').length, 0)
  assert.equal(tree.root.findAll(n => n.type === 'article' && n.props.className?.includes('ai-verdict')).length, 0)
  await interaction(tree, () => button(tree, '核对 / 刷新').props.onClick())
  const output = textOf(tree.toJSON())
  assert.match(output, /Flink 官方公告/)
  assert.match(output, /未填写运行版本，无法判断/)
  assert.ok(!output.includes('Kafka 官方公告'))
  assert.ok(!output.includes('官方不适用说明 · suppressions'))
})

test('panel does not present unavailable inventories as zero or not affected', async t => {
  const h = await mount(t)
  h.f.failAll()
  await interaction(h.tree, () => button(h.tree, '核对 / 刷新').props.onClick())
  const output = textOf(h.tree.toJSON())
  assert.ok(output.includes('官方清单不可用，无法判断'))
  const metrics = h.tree.root.findAll(n => n.type === 'article' && n.props.className?.includes('ai-metric'))
  assert.ok(metrics.every(n => textOf(n.findByType('strong')) === '—'))
  assert.equal(
    h.tree.root.findAll(n => n.type === 'article' && n.props.className?.includes('ai-verdict')).length,
    0
  )
})


test('advanced settings are folded and running versions remain on the main surface', async t => {
  const { tree } = await mount(t)
  const network = tree.root.findByProps({ className: 'ai-network' })
  assert.equal(network.type, 'details')
  assert.ok(!network.props.open)
  assert.equal(network.findAllByType('input').length, 0, 'network form loads only when opened')
  const versions = tree.root.findByProps({ className: 'ai-card ai-version-editor' })
  assert.equal(versions.type, 'section')
  assert.ok(versions.findByType('form'))
  await interaction(tree, () => button(tree, '核对 / 刷新').props.onClick())
  for (const detail of tree.root.findAllByProps({ className: 'ai-advisory-details' })) assert.ok(!detail.props.open)
  assert.ok(!tree.root.findByProps({ className: 'ai-card ai-section ai-suppression' }).props.open)
})

test('network form reads and writes the confined host route, preserving drafts across TLS changes and surfacing failures', async t => {
  const { NetworkSettings } = await import('../lib/network-settings.js')
  const { API_TLS_SKIP_LABEL } = await import('../lib/intranet-http.js')
  let state = { value: { timeoutSeconds: 30 }, writable: true, revision: '{}' }, fail = false
  const writes = []
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(url, '/api/advisory-impact/network-settings')
    assert.equal(init.credentials, 'same-origin')
    const body = JSON.parse(init.body)
    if (body.action === 'save') {
      writes.push(body)
      if (fail) return Response.json({ error: '网络设置保存失败，请重试。' }, { status: 400 })
      state = { ...state, value: { ...state.value, ...body.value }, revision: JSON.stringify(body.value) }
    }
    return Response.json(state)
  })
  let tree
  await act(async () => { tree = create(React.createElement(NetworkSettings, { endpoint: '/api/advisory-impact/network-settings' })) })
  assert.ok(textOf(tree.toJSON()).includes(API_TLS_SKIP_LABEL))
  const toggle = () => tree.root.findByProps({ name: 'insecureSkipTlsVerifyHosts' })
  const form = tree.root.findByType('form')
  assert.equal(toggle().props.checked, false);assert.equal(toggle().props.disabled, false)
  await act(async () => { await toggle().props.onChange({ target: { checked: true } }) })
  assert.deepEqual(writes[0], { action: 'save', value: { insecureSkipTlsVerifyHosts: true }, revision: '{}' })
  assert.equal(toggle().props.checked, true)
  assert.equal(tree.root.findByType('form'), form, 'TLS changes must not discard unsaved proxy fields')
  t.mock.method(globalThis, 'FormData', function () { return new Map(Object.entries({ systemProxy: 'off', timeoutSeconds: '45', httpsProxy: 'http://proxy:8080', noProxy: 'localhost', caBundlePath: '/tmp/company.pem' })) })
  await act(async () => { form.props.onSubmit({ preventDefault() {}, currentTarget: {} }) })
  assert.deepEqual(writes[1].value, { systemProxy: 'off', timeoutSeconds: 45, httpsProxy: 'http://proxy:8080', noProxy: 'localhost', caBundlePath: '/tmp/company.pem' })
  t.mock.method(globalThis, 'FormData', function () { return new Map([['timeoutSeconds', 'NaN']]) })
  await act(async () => { tree.root.findByType('form').props.onSubmit({ preventDefault() {}, currentTarget: {} }) })
  assert.equal(writes.length, 2)
  assert.match(textOf(tree.root.findByProps({ role: 'alert' })), /10–120/)
  fail = true
  await act(async () => { await toggle().props.onChange({ target: { checked: false } }) })
  assert.equal(toggle().props.checked, true)
  assert.match(textOf(tree.root.findByProps({ role: 'alert' })), /保存失败/)
  act(() => tree.unmount())
})
