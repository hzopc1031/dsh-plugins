import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, access, rm, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ShotServer, ORIGIN } from '../lib/server.js'

const png = Buffer.from('89504e470d0a1a0a00000000', 'hex')
const tick = () => new Promise(resolve => setImmediate(resolve))
async function fixture(t, options = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'snip-test-'))
  const jobs = [], logs = []
  const server = new ShotServer({ directory, log: s => logs.push(s), run: file => {
    const d = Promise.withResolvers()
    const row = { file, settle: d.resolve, cancelled: false }
    jobs.push(row)
    return { done: d.promise, cancel: () => { row.cancelled = true; d.resolve('timeout') } }
  }, ...options })
  await server.listen()
  t.after(async () => { await server.close(); await rm(directory, { recursive: true, force: true }) })
  return { server, jobs, directory, logs }
}
const get = (url, options = {}) => fetch(url, { headers: { Origin: ORIGIN }, ...options })
const absent = async file => {
  // Response completion can precede the asynchronous rm finishing.
  for (let attempt = 0; attempt < 50; attempt++) {
    try { await access(file) } catch (error) { assert.equal(error.code, 'ENOENT'); return }
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  assert.fail('temporary screenshot was not removed')
}

test('binds IPv4 loopback ephemeral port; names contain only generated UUID; concurrent capture refused', async t => {
  const f = await fixture(t), url = f.server.start()
  assert.match(url, /^http:\/\/127\.0\.0\.1:\d+\/shot\/[0-9a-f-]{36}$/)
  assert.equal(f.jobs[0].file, join(f.directory, 'dsh-shot-' + url.split('/').at(-1) + '.png'))
  assert.throws(() => f.server.start(), /已有截图/)
  f.jobs[0].settle('cancelled'); await tick()
  assert.notEqual(f.server.start(), url)
})
test('GET waits, returns PNG length and exact CORS/no-store; consumes token and deletes file', async t => {
  const f = await fixture(t), url = f.server.start()
  let resolved = false
  const waiting = get(url).then(r => { resolved = true; return r })
  await tick(); assert.equal(resolved, false)
  await writeFile(f.jobs[0].file, png); f.jobs[0].settle('success')
  const r = await waiting
  assert.equal(r.status, 200)
  assert.equal(r.headers.get('Content-Type'), 'image/png')
  assert.equal(r.headers.get('Content-Length'), String(png.length))
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), ORIGIN)
  assert.equal(r.headers.get('Cache-Control'), 'no-store')
  assert.deepEqual(Buffer.from(await r.arrayBuffer()), png)
  assert.equal((await get(url)).status, 404)
  await tick(); await absent(f.jobs[0].file)
})
test('OPTIONS 204 leaves token usable; POST 405 does not consume', async t => {
  const f = await fixture(t), url = f.server.start()
  const r = await get(url, { method: 'OPTIONS' })
  assert.equal(r.status, 204); assert.equal(r.headers.get('Access-Control-Allow-Methods'), 'GET, OPTIONS')
  assert.equal((await get(url, { method: 'POST' })).status, 405)
  f.jobs[0].settle('cancelled')
  assert.equal((await get(url)).status, 204)
})
test('unknown, traversal, query and malformed token are 404', async t => {
  const f = await fixture(t), url = f.server.start(), root = new URL(url).origin
  for (const path of ['/shot/no', '/shot/../../etc/passwd', '/other', new URL(url).pathname + '?file=C:/secret', '/shot/00000000-0000-4000-8000-000000000000']) {
    assert.equal((await get(root + path)).status, 404)
  }
})
test('foreign, null and missing Origin 403 cannot consume or obtain CORS allowance', async t => {
  const f = await fixture(t), url = f.server.start()
  for (const headers of [{}, { Origin: 'null' }, { Origin: 'https://evil.example' }, { Origin: ORIGIN + '.evil' }]) {
    const r = await get(url, { headers })
    assert.equal(r.status, 403); assert.equal(r.headers.get('Access-Control-Allow-Origin'), null)
  }
  f.jobs[0].settle('cancelled'); assert.equal((await get(url)).status, 204)
})
for (const status of ['cancelled', 'save-failed', 'failed', 'timeout']) {
  test(`${status} maps to empty 204 and removes partial file/token`, async t => {
    const f = await fixture(t), url = f.server.start()
    await writeFile(f.jobs[0].file, 'partial'); f.jobs[0].settle(status)
    const r = await get(url)
    assert.equal(r.status, 204); assert.equal(await r.text(), '')
    assert.equal((await get(url)).status, 404)
    await tick(); await absent(f.jobs[0].file)
  })
}
for (const content of [null, 'invalid image']) {
  test(`missing/invalid PNG returns 204, logs fixed event, cleans token (${content})`, async t => {
    const f = await fixture(t), url = f.server.start()
    if (content) await writeFile(f.jobs[0].file, content)
    f.jobs[0].settle('success')
    assert.equal((await get(url)).status, 204)
    assert.deepEqual(f.logs, ['capture file read failed'])
    assert.equal((await get(url)).status, 404)
  })
}
test('simultaneous GET can claim token only once', async t => {
  const f = await fixture(t), url = f.server.start()
  const one = get(url), two = get(url)
  await new Promise(resolve => setTimeout(resolve, 30))
  await writeFile(f.jobs[0].file, png); f.jobs[0].settle('success')
  const responses = await Promise.all([one, two])
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 404])
  await Promise.all(responses.map(r => r.arrayBuffer()))
})
test('TTL expiry kills capture, deletes partial file and makes token unknown', async t => {
  const f = await fixture(t, { ttlMs: 25 }), url = f.server.start()
  await writeFile(f.jobs[0].file, 'partial')
  await new Promise(resolve => setTimeout(resolve, 60))
  assert.equal(f.jobs[0].cancelled, true)
  assert.equal((await get(url)).status, 404)
  await absent(f.jobs[0].file)
})
test('TTL also deletes completed but unfetched screenshot', async t => {
  const f = await fixture(t, { ttlMs: 25 }), url = f.server.start()
  await writeFile(f.jobs[0].file, png); f.jobs[0].settle('success')
  await new Promise(resolve => setTimeout(resolve, 60))
  assert.equal((await get(url)).status, 404); await absent(f.jobs[0].file)
})
test('unload cancels jobs, closes HTTP port, removes files and rejects further starts', async t => {
  const f = await fixture(t), url = f.server.start()
  await writeFile(f.jobs[0].file, 'partial')
  await f.server.close()
  assert.equal(f.jobs[0].cancelled, true); assert.deepEqual(await readdir(f.directory), [])
  assert.throws(() => f.server.start(), /尚未就绪/)
  await assert.rejects(get(url))
})
test('client disconnect cancels claimed capture and removes temporary file', async t => {
  const f = await fixture(t), url = f.server.start(), c = new AbortController()
  const p = get(url, { signal: c.signal }).catch(() => {})
  await new Promise(resolve => setTimeout(resolve, 30)); c.abort(); await p
  await new Promise(resolve => setTimeout(resolve, 30))
  assert.equal(f.jobs[0].cancelled, true); assert.equal((await get(url)).status, 404)
})
