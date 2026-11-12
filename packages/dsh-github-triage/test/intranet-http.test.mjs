import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer as httpsServer } from 'node:https'
import { createServer as httpServer } from 'node:http'
import { connect, createServer } from 'node:net'
import dns from 'node:dns'
import { updateVolatile } from '@deepseek-ai/cosmokit'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { createIntranetHttp, describeNetworkError, collapseNetworkErrors, intranetConfig, API_TLS_SKIP_LABEL, WEAK_CA_HINT } from '../lib/intranet-http.js'

const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
async function fixture(t, secureProxy = false) {
  const dir = await mkdtemp(join(tmpdir(), 'intranet-tls-'))
  const keyPath = join(dir, 'key.pem'), certPath = join(dir, 'cert.pem')
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', keyPath, '-out', certPath,
    '-days', '1', '-subj', '/CN=fixture.test', '-addext', 'subjectAltName=DNS:fixture.test,DNS:localhost,IP:127.0.0.1'], { stdio: 'ignore' })
  const credentials = { key: await readFile(keyPath), cert: await readFile(certPath) }
  const origin = httpsServer(credentials, (req, res) => req.url === '/redirect'
    ? res.writeHead(302, { Location: 'https://issues.apache.org:' + origin.address().port }).end()
    : res.end('local TLS fixture'))
  const sockets = new Set()
  const track = socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); socket.on('error', () => {}) }
  origin.on('connection', track)
  await listen(origin)
  let connects = 0
  const handler = (_req, res) => res.writeHead(405).end()
  const proxy = secureProxy ? httpsServer(credentials, handler) : httpServer(handler)
  proxy.on('connection', track)
  proxy.on('connect', (req, client, head) => {
    assert.equal(new URL('https://' + req.url).port, String(origin.address().port))
    connects++
    const upstream = connect(origin.address().port, '127.0.0.1'); track(upstream)
    upstream.once('connect', () => { client.write('HTTP/1.1 200 Connection Established\r\n\r\n'); if (head.length) upstream.write(head); client.pipe(upstream); upstream.pipe(client) })
    client.on('close', () => upstream.destroy()); upstream.on('close', () => client.destroy())
  })
  await listen(proxy)
  t.after(async () => { for (const socket of sockets) socket.destroy(); await Promise.all([new Promise(r => origin.close(r)), new Promise(r => proxy.close(r))]); await rm(dir, { recursive: true, force: true }) })
  return { certPath, url: 'https://fixture.test:' + origin.address().port, direct: 'https://127.0.0.1:' + origin.address().port,
    proxy: (secureProxy ? 'https:' : 'http:') + '//127.0.0.1:' + proxy.address().port,
    target: host => 'https://' + host + ':' + origin.address().port, connects: () => connects }
}
function client(t, settings, env = {}) { const c = createIntranetHttp(settings, env, { readSettings: async () => ({}) }); t.after(() => c.close()); return c }

test('default fetch preserves the host dispatcher and passes through request options', async t => {
  const previous = globalThis.fetch, seen = []
  globalThis.fetch = async (...args) => { seen.push(args); return new Response('host') }
  t.after(() => { globalThis.fetch = previous })
  const c = client(t, {}, {})
  const init = { headers: { Accept: 'application/json' } }
  assert.equal(await (await c.fetch('https://example.test', init)).text(), 'host')
  assert.equal(seen[0][1], init)
  assert.equal(seen[0][1].dispatcher, undefined)
})

test('local CONNECT + custom CA succeeds; missing CA exposes a named TLS cause; diagnostics hide proxy credentials', async t => {
  const f = await fixture(t)
  const trusted = client(t, { httpsProxy: f.proxy, caBundlePath: f.certPath })
  assert.equal(await (await trusted.fetch(f.url)).text(), 'local TLS fixture')
  assert.ok(f.connects() > 0)
  const missing = client(t, { httpsProxy: f.proxy })
  await assert.rejects(missing.fetch(f.url), error => {
    const info = describeNetworkError(error)
    assert.match(info.code, /SELF_SIGNED|CERT|ISSUER|SIGNATURE/)
    assert.match(info.hintZh, /公司.*证书|根证书/)
    return true
  })
  const authProxy = client(t, { httpsProxy: f.proxy.replace('http://', 'http://fixture:never-echo-this@'), caBundlePath: f.certPath })
  const diagnosis = await authProxy.diagnose(f.url)
  assert.equal(diagnosis.proxy, 'plugin setting')
  assert.equal(diagnosis.tcp, 'connected')
  assert.equal(diagnosis.tls.authorized, true)
  assert.ok(Array.isArray(diagnosis.dns))
  assert.doesNotMatch(JSON.stringify(diagnosis), /never-echo-this|fixture:|http:\/\//)
})

test('env proxies, lowercase priority, ALL_PROXY and NO_PROXY survive custom TLS; NODE_EXTRA_CA_CERTS is merged', async t => {
  const f = await fixture(t)
  const c = client(t, { caBundlePath: f.certPath }, { https_proxy: f.proxy, HTTPS_PROXY: 'http://127.0.0.1:1', NODE_EXTRA_CA_CERTS: f.certPath })
  assert.equal(c.route(f.url).source, 'https_proxy')
  assert.equal(await (await c.fetch(f.url)).text(), 'local TLS fixture')
  const upper = client(t, { noProxy: '' }, { HTTPS_PROXY: f.proxy, NODE_EXTRA_CA_CERTS: f.certPath })
  assert.equal(await (await upper.fetch(f.url)).text(), 'local TLS fixture')
  const all = client(t, { caBundlePath: f.certPath }, { ALL_PROXY: f.proxy })
  assert.equal(await (await all.fetch(f.url)).text(), 'local TLS fixture')
  const bypass = client(t, { caBundlePath: f.certPath }, { HTTPS_PROXY: f.proxy, NO_PROXY: '.fixture.test' })
  assert.equal(bypass.route(f.url).proxied, false)
  assert.equal(bypass.route('https://other.test').proxied, true)
  assert.equal(bypass.route('http://other.test').proxied, false)
  assert.equal(await (await bypass.fetch(f.direct)).text(), 'local TLS fixture')
  const override = client(t, { httpsProxy: f.proxy, noProxy: 'other.test:443', caBundlePath: f.certPath }, { NO_PROXY: '*' })
  assert.equal(override.route(f.url).proxied, true)
  assert.equal(override.route('https://other.test').proxied, false)
  assert.equal(override.route('https://other.test:444').proxied, true)
})

test('environment-only proxy and CA work without plugin overrides', async t => {
  const f = await fixture(t)
  for (const proxyName of ['HTTPS_PROXY', 'HTTP_PROXY']) {
    const c = client(t, {}, { [proxyName]: f.proxy, NODE_EXTRA_CA_CERTS: f.certPath })
    assert.equal(c.route(f.url).source, proxyName)
    assert.equal(await (await c.fetch(f.url)).text(), 'local TLS fixture')
  }
  assert.ok(f.connects() > 0)
})

test('insecure TLS is opt-in, unsupported proxy config and invalid CA fail safely, close rejects reuse', async t => {
  const f = await fixture(t)
  const c = client(t, { httpsProxy: f.proxy, insecureSkipTlsVerify: true })
  assert.equal(await (await c.fetch(f.url)).text(), 'local TLS fixture')
  for (const proxy of ['socks5://secret:password@127.0.0.1:1', 'file:///proxy.pac']) assert.throws(() => createIntranetHttp({ httpsProxy: proxy }), error => !error.message.includes('password') && /SOCKS/.test(error.message))
  assert.throws(() => createIntranetHttp({ caBundlePath: '../ca.pem' }), /绝对路径/)
  const badCa = client(t, { httpsProxy: f.proxy, caBundlePath: join(f.certPath, 'missing.pem') })
  await assert.rejects(badCa.fetch(f.url), error => error.code === 'CERT_BUNDLE_INVALID' && !error.message.includes(f.certPath))
  await c.close()
  await assert.rejects(c.fetch(f.url))
})

test('ECONNREFUSED includes the Chinese recovery hint; cause/aggregate cycles and HTTP status are bounded', async t => {
  const port = createServer(); await listen(port); const number = port.address().port; await new Promise(resolve => port.close(resolve))
  const c = client(t, { noProxy: '*' })
  await assert.rejects(c.fetch('http://127.0.0.1:' + number), error => {
    const info = describeNetworkError(error)
    assert.equal(info.code, 'ECONNREFUSED'); assert.match(info.hintZh, /HTTPS_PROXY.*退出.*重开/); return true
  })
  const cyclic = new Error('fetch failed'); cyclic.cause = new AggregateError([{ code: 'ENOTFOUND' }, cyclic])
  assert.equal(describeNetworkError(cyclic).code, 'ENOTFOUND')
  assert.equal(describeNetworkError(new Error('HTTP 503')).code, 'HTTP_503')
  assert.equal(describeNetworkError(new DOMException('deadline', 'TimeoutError')).code, 'ETIMEDOUT')
})

test('collapse repeats by code and unique source, keeping different causes distinct', () => {
  const url = 'https://projects.apache.org/json/foundation/chooser.json'
  const value = { rows: [{ url, error: 'ECONNREFUSED' }, { url, cacheError: 'ECONNREFUSED' }, { url: 'https://attic.apache.org', error: 'ECONNREFUSED' }], nested: { url: 'https://kafka.apache.org', error: 'SELF_SIGNED_CERT_IN_CHAIN' } }
  const groups = collapseNetworkErrors(value)
  assert.equal(groups.find(g => g.code === 'ECONNREFUSED').count, 2)
  assert.equal(groups.find(g => g.code === 'SELF_SIGNED_CERT_IN_CHAIN').count, 1)
  assert.equal(collapseNetworkErrors({ error: 'parse error' }).length, 0)
})


test('weak certificate keys are recognized through messages, codes, bounded causes and aggregates', () => {
  const weak = [new Error('CA certificate key too weak'), new Error('ca key too small'), new Error('ee key too small'),
    new Error('key too small'), new Error('verify error:num=67:verification failed'), new Error('Verify return code: 67'),
    ...['CA_KEY_TOO_SMALL', 'ERR_SSL_CA_KEY_TOO_SMALL', 'X509_V_ERR_CA_KEY_TOO_SMALL', 'EE_KEY_TOO_SMALL', 'ERR_SSL_EE_KEY_TOO_SMALL'].map(code => ({ code })),
    { code: 67 }, { verifyCode: 67 }, new TypeError('fetch failed', { cause: new Error('CA certificate key too weak') }),
    new Error('outer', { cause: new AggregateError([{ code: 'ERR_SSL_CA_KEY_TOO_SMALL' }]) })]
  for (const error of weak) {
    const info = describeNetworkError(error)
    assert.equal(info.code, 'TLS_KEY_TOO_SMALL')
    assert.equal(info.hintZh, WEAK_CA_HINT)
    assert.ok(info.hintZh.includes('「' + API_TLS_SKIP_LABEL + '」'))
    assert.doesNotMatch(info.hintZh, /RSA 1024|NODE_EXTRA_CA_CERTS|SECLEVEL/)
  }
  for (const error of [new Error('self-signed certificate'), { code: 'SELF_SIGNED_CERT_IN_CHAIN' },
    { code: 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY' }, new Error('unable to get local issuer certificate'), new Error('verify error:num=20')]) {
    assert.notEqual(describeNetworkError(error).code, 'TLS_KEY_TOO_SMALL')
    assert.notEqual(describeNetworkError(error).hintZh, WEAK_CA_HINT)
  }
  let deep = { code: 'CA_KEY_TOO_SMALL' }
  for (let i = 0; i < 100; i++) deep = { cause: deep }
  assert.notEqual(describeNetworkError(deep).code, 'TLS_KEY_TOO_SMALL')
  const groups = collapseNetworkErrors({ rows: [{ url: 'https://api.osv.dev', error: 'CA certificate key too weak' },
    { url: 'https://api.github.com', error: 'ERR_SSL_CA_KEY_TOO_SMALL' }] })
  assert.deepEqual(groups, [{ code: 'TLS_KEY_TOO_SMALL', hintZh: WEAK_CA_HINT, count: 2 }])
})

test('per-host TLS skip defaults off in schema and verifies both API hosts through CONNECT', async t => {
  assert.equal(intranetConfig.insecureSkipTlsVerifyHosts.meta.default, false)
  assert.equal(intranetConfig.insecureSkipTlsVerifyHosts().get(), false)
  assert.equal(intranetConfig.insecureSkipTlsVerifyHosts.meta.volatile, true)
  assert.equal(intranetConfig.insecureSkipTlsVerify(), false)
  assert.equal(intranetConfig.insecureSkipTlsVerifyHosts.meta.description, API_TLS_SKIP_LABEL)
  for (const value of ['true', null, 1, [], {}]) assert.throws(() => createIntranetHttp({ insecureSkipTlsVerifyHosts: value }), /布尔值/)
  const f = await fixture(t)
  for (const value of [undefined, false]) {
    const c = client(t, { httpsProxy: f.proxy, insecureSkipTlsVerifyHosts: value })
    for (const host of ['api.osv.dev', 'api.github.com']) await assert.rejects(c.fetch(f.target(host)), /CERT|ISSUER|SIGNATURE/)
  }
})

test('per-host TLS skip isolates exact target origins in CONNECT, redirects and diagnostics', async t => {
  const f = await fixture(t)
  const c = client(t, { httpsProxy: f.proxy, insecureSkipTlsVerifyHosts: true })
  for (const host of ['api.osv.dev', 'api.github.com']) assert.equal(await (await c.fetch(f.target(host))).text(), 'local TLS fixture')
  for (const host of ['issues.apache.org', 'registry.npmjs.org', 'evil-api.github.com.example', 'api.osv.dev.example', 'sub.api.github.com', 'sub.api.osv.dev', 'api.github.com.']) {
    await assert.rejects(c.fetch(f.target(host)), /CERT|ISSUER|SIGNATURE/)
  }
  await assert.rejects(c.fetch(f.target('api.osv.dev') + '/redirect'), /CERT|ISSUER|SIGNATURE/)
  const diagnosis = await c.diagnose(f.target('api.osv.dev'))
  assert.deepEqual(diagnosis.tlsVerification, { host: 'api.osv.dev', skipped: true })
  assert.equal(diagnosis.tls.authorized, false)
  assert.equal(diagnosis.tls.status, 200)
  const verified = await c.diagnose(f.direct)
  assert.deepEqual(verified.tlsVerification, { host: '127.0.0.1', skipped: false })
  assert.equal(verified.tls.authorized, false)
})

test('per-host TLS skip works directly and still verifies redirects and unrelated origins', async t => {
  const f = await fixture(t)
  const lookup = dns.lookup
  t.mock.method(dns, 'lookup', (hostname, options, callback) => lookup('127.0.0.1', options, callback))
  const c = client(t, { noProxy: '*', insecureSkipTlsVerifyHosts: true })
  for (const host of ['api.osv.dev', 'api.github.com']) assert.equal(await (await c.fetch(f.target(host))).text(), 'local TLS fixture')
  for (const host of ['issues.apache.org', 'registry.npmjs.org', 'evil-api.github.com.example', 'sub.api.osv.dev']) {
    await assert.rejects(c.fetch(f.target(host)), /CERT|ISSUER|SIGNATURE/)
  }
  await assert.rejects(c.fetch(f.target('api.github.com') + '/redirect'), /CERT|ISSUER|SIGNATURE/)
  const off = client(t, { noProxy: '*', insecureSkipTlsVerifyHosts: false })
  await assert.rejects(off.fetch(f.target('api.osv.dev')), /CERT|ISSUER|SIGNATURE/)
})

test('per-host TLS skip never disables the HTTPS proxy own certificate check', async t => {
  const f = await fixture(t, true)
  const c = client(t, { httpsProxy: f.proxy, insecureSkipTlsVerifyHosts: true })
  await assert.rejects(c.fetch(f.target('api.osv.dev')), /CERT|ISSUER|SIGNATURE/)
  assert.equal(f.connects(), 0)
  const trustedProxy = client(t, { httpsProxy: f.proxy, caBundlePath: f.certPath, insecureSkipTlsVerifyHosts: true })
  assert.equal(await (await trustedProxy.fetch(f.target('api.github.com'))).text(), 'local TLS fixture')
  assert.ok(f.connects() > 0)
  const globalSkip = client(t, { httpsProxy: f.proxy, insecureSkipTlsVerify: true })
  assert.equal(await (await globalSkip.fetch(f.url)).text(), 'local TLS fixture')
})


test('the generated settings switch applies live and disabling it restores verification on cached origins', async t => {
  const f = await fixture(t)
  const setting = intranetConfig.insecureSkipTlsVerifyHosts()
  const c = client(t, { httpsProxy: f.proxy, insecureSkipTlsVerifyHosts: setting })
  await assert.rejects(c.fetch(f.target('api.osv.dev')), /CERT|ISSUER|SIGNATURE/)
  updateVolatile(setting, intranetConfig.insecureSkipTlsVerifyHosts(true))
  assert.equal(await (await c.fetch(f.target('api.osv.dev'))).text(), 'local TLS fixture')
  updateVolatile(setting, intranetConfig.insecureSkipTlsVerifyHosts(false))
  await assert.rejects(c.fetch(f.target('api.osv.dev')), /CERT|ISSUER|SIGNATURE/)
})

test('diagnostics retain the weak-key hint from nested fetch failures', async t => {
  const f = await fixture(t)
  const c = client(t, { httpsProxy: f.proxy })
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('fetch failed', { cause: { code: 'ERR_SSL_CA_KEY_TOO_SMALL' } }) })
  const diagnosis = await c.diagnose(f.target('api.github.com'))
  assert.equal(diagnosis.tls.code, 'TLS_KEY_TOO_SMALL')
  assert.equal(diagnosis.tls.hintZh, WEAK_CA_HINT)
  assert.equal(diagnosis.tlsVerification.skipped, false)
})
