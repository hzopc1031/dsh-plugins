import test from 'node:test'
import assert from 'node:assert/strict'
import { networkConfigHandler, registerNetworkSettings } from '../lib/network-config.js'
const req = body => new Request('http://localhost/api/test/network-settings', { method: 'POST', body: JSON.stringify(body) })

test('network form reads only network fields, preserves other config, fences stale writes and validates input', async () => {
  const fiber = {}, entry = { fiber, options: { config: { httpsProxy: 'http://proxy:8080', timeoutSeconds: 30, privateToken: 'must not leave host', watchList: ['kafka'] } } }
  fiber.entry = entry
  let writes = 0
  const editor = { entries: () => [entry], async edit(_, change) { entry.options.config = change(entry.options.config); writes++ } }
  const handle = networkConfigHandler(editor, fiber)
  const read = await (await handle(req({ action: 'read' }))).json()
  assert.deepEqual(read.value, { timeoutSeconds: 30, httpsProxy: 'http://proxy:8080' })
  assert.equal(read.writable, true)
  const saved = await handle(req({ action: 'save', revision: read.revision, value: { insecureSkipTlsVerifyHosts: true } }))
  assert.equal(saved.status, 200)
  assert.equal(entry.options.config.insecureSkipTlsVerifyHosts, true)
  assert.equal(entry.options.config.privateToken, 'must not leave host')
  assert.deepEqual(entry.options.config.watchList, ['kafka'])
  assert.equal((await handle(req({ action: 'save', revision: read.revision, value: { timeoutSeconds: 45 } }))).status, 400)
  const revision = (await saved.json()).revision
  for (const value of [{ privateToken: 'oops' }, { timeoutSeconds: 9 }, { timeoutSeconds: '30' }, { caBundlePath: '../bad' }, { httpsProxy: 'file:///etc/passwd' }, { systemProxy: 'unknown' }, { insecureSkipTlsVerify: 'true' }, []]) {
    assert.equal((await handle(req({ action: 'save', revision, value }))).status, 400)
  }
  for (const body of [null, [], {}, { action: ['read'] }, { action: null }, { action: 'read', value: {} }, { action: 'save', value: {} }, { action: 'read', extra: true }]) assert.equal((await handle(req(body))).status, 400)
  assert.equal(writes, 1)
  assert.equal((await handle(new Request('http://localhost', { method: 'POST', body: '{' }))).status, 400)
  assert.equal((await networkConfigHandler(editor, {})(req({ action: 'read' }))).status, 400)
  editor.edit = async () => { throw new Error('write rejected') }
  const failure = await handle(req({ action: 'save', revision, value: { timeoutSeconds: 45 } }))
  assert.equal(failure.status, 400)
  assert.equal(entry.options.config.timeoutSeconds, 30)
})

test('network configuration uses the authenticated owner connection and discovers the editor at request time', async () => {
  let editor
  const routes = [], fiber = {}, ctx = { fiber, get: () => editor, inject(names, setup) {
    assert.deepEqual(names, ['connection'])
    setup({ get: () => ({ fetch: { register: route => { routes.push(route); return () => routes.pop() } } }), effect: run => { this.dispose = run() } })
  } }
  registerNetworkSettings(ctx, 'apache-radar')
  assert.equal(routes[0].path, '/api/apache-radar/network-settings')
  assert.deepEqual(routes[0].methods, ['POST'])
  assert.equal(routes[0].requestBody, 'buffered')
  const entry = { fiber: {}, options: { config: {} } };fiber.entry = entry
  editor = { entries: () => [entry] }
  assert.equal((await routes[0].fetch(req({ action: 'read' }))).status, 200)
  ctx.dispose();assert.equal(routes.length, 0)
})
