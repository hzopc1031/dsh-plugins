import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createServer } from 'node:http'
import puppeteer from 'puppeteer-core'
import { createCaptureEngine, CHROME_ARGS } from '../lib/capture.js'

const fixtures = fileURLToPath(new URL('./fixtures/', import.meta.url))
let engine
before(async () => { engine = await createCaptureEngine(fixtures) })
after(async () => { await engine?.close() })
const pngSize = image => [Buffer.from(image).readUInt32BE(16), Buffer.from(image).readUInt32BE(20)]

test('isolated Chrome records actual sandbox mode, sRGB, default viewport and full-viewport background', async () => {
  assert.ok(!CHROME_ARGS.includes('--no-sandbox'))
  for (const arg of ['--disable-gpu', '--force-color-profile=srgb']) assert.ok(CHROME_ARGS.includes(arg))
  const command = (await readFile(`/proc/${engine.browserPid}/cmdline`, 'utf8')).split(/[\s\0]+/)
  for (const arg of CHROME_ARGS) assert.ok(command.includes(arg))
  assert.equal(command.includes('--no-sandbox'), engine.sandboxMode === 'disabled-fallback')
  assert.equal(engine.launchArgs.includes('--no-sandbox'), engine.sandboxMode === 'disabled-fallback')
  for (const arg of engine.launchArgs) assert.ok(command.includes(arg), arg)
  if (engine.sandboxMode === 'disabled-fallback') assert.match(engine.sandboxFallbackReason, /sandbox|namespace/i)
  assert.ok(command.some(arg => arg.startsWith('--user-data-dir=') && arg.includes('puppeteer_dev_chrome_profile-')))
  assert.equal(engine.scale, 2)
  assert.deepEqual(engine.viewport, { width: 1920, height: 1080 })
  const result = await engine.capture('capture.html')
  assert.equal(result.status, 'captured', result.error)
  assert.deepEqual(pngSize(result.image), [3840, 2160])
  assert.equal(result.bytes, result.image.byteLength)
  assert.ok(result.computedFontFamilies.some(font => font.includes('Noto Sans')))
  assert.ok(result.actualFontFamilies.some(font => font.includes('Noto Sans')))
  assert.deepEqual(result.warnings, [])
  let pixel
  await engine.capture('capture.html', async page => {
    pixel = await page.evaluate(async source => {
      const image = new Image(); image.src = source; await image.decode()
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1
      const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0)
      return [...ctx.getImageData(0, 0, 1, 1).data]
    }, `data:image/png;base64,${Buffer.from(result.image).toString('base64')}`)
  })
  assert.ok(pixel[0] >= 16 && pixel[0] <= 22 && pixel[2] > 70, `background pixel ${pixel}`)
})

test('real Chrome keeps sandbox enabled when supported on this host', t => {
  if (engine.sandboxMode !== 'enabled') return t.skip(`Host requires fallback: ${engine.sandboxFallbackReason}`)
  assert.ok(!engine.launchArgs.includes('--no-sandbox'))
})

test('successful sandbox launch makes only one attempt (simulated)', async t => {
  const launch = t.mock.method(puppeteer, 'launch', async options => {
    assert.ok(!options.args.includes('--no-sandbox'))
    assert.equal(options.userDataDir, undefined, 'Puppeteer must allocate a fresh profile')
    return { version: async () => 'Chrome/test', process: () => null, close: async () => {} }
  })
  const sandboxed = await createCaptureEngine(fixtures)
  try {
    assert.equal(launch.mock.callCount(), 1)
    assert.equal(sandboxed.sandboxMode, 'enabled')
    assert.equal(sandboxed.sandboxFallbackReason, undefined)
    assert.ok(!sandboxed.launchArgs.includes('--no-sandbox'))
  } finally { await sandboxed.close() }
})

test('sandbox-specific launch failure retries once and records the fallback', async t => {
  const attempts = []
  const launch = puppeteer.launch.bind(puppeteer)
  const controller = new AbortController()
  t.mock.method(puppeteer, 'launch', async options => {
    attempts.push(options)
    if (attempts.length === 1) throw new Error('Failed to launch the browser process: No usable sandbox!')
    return launch(options)
  })
  const fallback = await createCaptureEngine(fixtures, { signal: controller.signal })
  try {
    assert.equal(attempts.length, 2)
    assert.ok(!attempts[0].args.includes('--no-sandbox'))
    assert.deepEqual(attempts[1].args, [...attempts[0].args, '--no-sandbox'])
    assert.equal(fallback.sandboxMode, 'disabled-fallback')
    assert.match(fallback.sandboxFallbackReason, /No usable sandbox/)
    for (const arg of attempts[1].args) assert.ok(fallback.launchArgs.includes(arg))
    assert.equal((await fallback.capture('capture.html')).status, 'captured')
    controller.abort(new Error('cancel fallback browser'))
    await fallback.close()
    assert.throws(() => process.kill(fallback.browserPid, 0), { code: 'ESRCH' })
  } finally { await fallback.close() }
})

test('other launch errors never disable sandbox; failed fallback is not retried again', async t => {
  const launch = t.mock.method(puppeteer, 'launch', async () => { throw new Error('Browser was not found: /tmp/sandbox/chrome') })
  await assert.rejects(createCaptureEngine(fixtures), /Browser was not found/)
  assert.equal(launch.mock.callCount(), 1)
  launch.mock.restore()
  const failing = t.mock.method(puppeteer, 'launch', async () => { throw new Error('No usable sandbox!') })
  await assert.rejects(createCaptureEngine(fixtures), /No usable sandbox/)
  assert.equal(failing.mock.callCount(), 2)
})

test('cancellation during initial launch prevents fallback; cancellation during retry closes Chrome', async t => {
  const initial = new AbortController()
  const launch = t.mock.method(puppeteer, 'launch', async () => {
    initial.abort(new Error('cancel initial launch'))
    throw new Error('No usable sandbox!')
  })
  await assert.rejects(createCaptureEngine(fixtures, { signal: initial.signal }), /cancel initial launch/)
  assert.equal(launch.mock.callCount(), 1)
  launch.mock.restore()
  const retry = new AbortController()
  let attempts = 0, closed = false
  t.mock.method(puppeteer, 'launch', async () => {
    if (++attempts === 1) throw new Error('No usable sandbox!')
    retry.abort(new Error('cancel fallback launch'))
    return { process: () => null, close: async () => { closed = true } }
  })
  await assert.rejects(createCaptureEngine(fixtures, { signal: retry.signal }), /cancel fallback launch/)
  assert.equal(attempts, 2)
  assert.ok(closed)
})

test('visibility hides chrome without flex reflow; display:none demonstrates the regression', async () => {
  let original, hidden, removed
  const result = await engine.capture('capture.html', async page => {
    original = await page.$eval('#deck', node => node.getBoundingClientRect().height)
    const screenshot = page.screenshot.bind(page)
    page.screenshot = async options => {
      hidden = await page.$eval('#deck', node => node.getBoundingClientRect().height)
      assert.equal(await page.$eval('#nav', node => getComputedStyle(node).visibility), 'hidden')
      assert.notEqual(await page.$eval('#nav', node => getComputedStyle(node).display), 'none')
      removed = await page.$eval('#nav', node => {
        node.style.display = 'none'
        const height = document.querySelector('#deck').getBoundingClientRect().height
        node.style.removeProperty('display')
        return height
      })
      return screenshot(options)
    }
  })
  assert.equal(result.status, 'captured', result.error)
  assert.equal(hidden, original)
  assert.equal(removed, original + 80)
})

test('capture awaits fonts.ready instead of snapshotting a pending font state', async () => {
  let readyAtCapture = false, wasPending = false
  const result = await engine.capture('capture.html', async page => {
    await page.evaluate(() => {
      window.fontWaitDone = false
      const pending = new Promise(resolve => setTimeout(() => { window.fontWaitDone = true; resolve(document.fonts) }, 300))
      Object.defineProperty(document.fonts, 'ready', { get: () => pending })
    })
    wasPending = await page.evaluate(() => !window.fontWaitDone)
    const screenshot = page.screenshot.bind(page)
    page.screenshot = async options => {
      readyAtCapture = await page.evaluate(() => window.fontWaitDone)
      assert.ok(readyAtCapture, 'refuse an early font snapshot')
      return screenshot(options)
    }
  })
  assert.ok(wasPending)
  assert.equal(result.status, 'captured', result.error)
  assert.ok(readyAtCapture)
})

test('font timeout fails with evidence, and the next page can succeed', async () => {
  const short = await createCaptureEngine(fixtures, { scale: 1, timeoutMs: 1000 })
  try {
    const result = await short.capture('capture.html', async page => {
      await page.evaluate(() => Object.defineProperty(document.fonts, 'ready', { get: () => new Promise(() => {}) }))
    })
    assert.equal(result.status, 'failed'); assert.match(result.error, /timed out/)
    assert.equal(result.bytes, 0, 'failure evidence is not a successful slide image')
    assert.ok(result.image || result.error)
    assert.equal((await short.capture('capture.html')).status, 'captured')
  } finally { await short.close() }
})

test('default blocks HTTPS and loopback HTTP; only explicit allowNetwork enables fetching', async () => {
  let hits = 0
  const server = createServer((_, response) => {
    hits++; response.writeHead(200, { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'text/plain' }); response.end('allowed')
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const url = `http://127.0.0.1:${server.address().port}/asset`
  const fetchFromPage = (page, target) => page.evaluate(async target => fetch(target).then(r => r.text()).catch(() => 'blocked'), target)
  try {
    let fetched, publicFetch
    const result = await engine.capture('capture.html', async page => {
      fetched = await fetchFromPage(page, url); publicFetch = await fetchFromPage(page, 'https://example.com/')
    })
    assert.equal(fetched, 'blocked'); assert.equal(publicFetch, 'blocked'); assert.equal(hits, 0)
    assert.equal(result.status, 'captured', result.error)
    assert.ok(result.warnings.some(w => w.includes('Blocked resource') && w.includes('https://example.com/')))
    const online = await createCaptureEngine(fixtures, { allowNetwork: true, scale: 1 })
    try {
      const allowed = await online.capture('capture.html', async page => { fetched = await fetchFromPage(page, url) })
      assert.equal(allowed.status, 'captured', allowed.error)
      assert.equal(fetched, 'allowed'); assert.equal(hits, 1)
    } finally { await online.close() }
  } finally { await new Promise(resolve => server.close(resolve)) }
})

test('file containment rejects traversal, absolute paths, symlinks, and resource escapes', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'html-deck-capture-'))
  const root = join(temp, 'deck'); await mkdir(root)
  await writeFile(join(temp, 'outside.html'), '<p>private</p>')
  await writeFile(join(temp, 'outside.js'), 'window.secretRead = true')
  await writeFile(join(root, 'index.html'), '<!doctype html><p>safe</p>')
  await symlink(join(temp, 'outside.js'), join(root, 'linked.js'))
  const confined = await createCaptureEngine(root, { scale: 1 })
  try {
    for (const input of ['../outside.html', join(temp, 'outside.html'), pathToFileURL(join(temp, 'outside.html')).href]) {
      const result = await confined.capture(input)
      assert.equal(result.status, 'failed'); assert.match(result.error, /escapes deck directory/)
    }
    for (const src of ['../outside.js', 'linked.js', pathToFileURL(join(temp, 'outside.js')).href]) {
      await writeFile(join(root, 'index.html'), `<!doctype html><script src="${src}"></script><p>safe</p>`)
      const result = await confined.capture('index.html')
      assert.equal(result.status, 'failed'); assert.match(result.error, /escapes deck directory/)
    }
    await writeFile(join(root, 'index.html'), '<!doctype html><p>safe</p>')
    let popup, worker
    const result = await confined.capture('index.html', async page => {
      popup = await page.evaluate(() => window.open('file:///etc/hostname') === null)
      worker = await page.evaluate(() => {
        return new Promise(resolve => {
          const worker = new Worker(URL.createObjectURL(new Blob(['postMessage("ran")'])))
          worker.onmessage = () => { worker.terminate(); resolve(false) }
          worker.onerror = () => { worker.terminate(); resolve(true) }
        })
      })
    })
    assert.equal(result.status, 'captured', result.error)
    assert.ok(popup); assert.ok(worker)
  } finally { await confined.close(); await rm(temp, { recursive: true, force: true }) }
})

test('missing images fail; unavailable fonts explicitly warn and report actual families', async () => {
  const missing = await engine.capture('capture.html', async page => { await page.$eval('img', image => { image.src = 'missing.png' }) })
  assert.equal(missing.status, 'failed'); assert.match(missing.error, /Image not loaded|ENOENT/)
  const fonts = await engine.capture('capture.html', async page => {
    await page.addStyleTag({ content: 'body { font-family: "Deliberately Missing Test Font", sans-serif }' })
  })
  assert.equal(fonts.status, 'captured', fonts.error)
  assert.ok(fonts.warnings.some(w => w.includes('字体回退：请求字体「Deliberately Missing Test Font」') && w.includes('字体排版可能不同')))
  const fallback = fonts.fontFallbacks.find(item => item.requestedFamily === 'Deliberately Missing Test Font')
  assert.ok(fallback.actualFamilies.length)
  assert.deepEqual(fallback.actualFamilies, fonts.actualFontFamilies)
  assert.ok(fonts.actualFontFamilies.length)
  const heading = await engine.capture('capture.html', async page => {
    await page.addStyleTag({ content: 'h1 { font-family: "Missing Heading Font", "Noto Serif CJK SC" }' })
  })
  assert.equal(heading.status, 'captured', heading.error)
  assert.deepEqual(heading.fontFallbacks.find(item => item.requestedFamily === 'Missing Heading Font').actualFamilies, ['Noto Serif CJK SC'])
})

test('scale/format change bytes, preserve viewport and fixed canvas, and report overflow', async () => {
  const png = await engine.capture('capture.html')
  const one = await createCaptureEngine(fixtures, { scale: 1 })
  const jpeg = await createCaptureEngine(fixtures, { scale: 1, format: 'jpeg', quality: 55 })
  try {
    let viewport
    const small = await one.capture('capture.html', async page => { viewport = await page.evaluate(() => [innerWidth, innerHeight]) })
    const compressed = await jpeg.capture('capture.html')
    for (const result of [small, compressed]) assert.equal(result.status, 'captured', result.error)
    assert.deepEqual(viewport, [1920, 1080]); assert.deepEqual(pngSize(small.image), [1920, 1080])
    assert.notEqual(png.bytes, small.bytes); assert.notEqual(compressed.bytes, small.bytes)
    assert.deepEqual([...compressed.image.slice(0, 2)], [0xff, 0xd8])
    let design
    await one.capture('fixed-canvas.html', async page => { design = await page.$eval('.stage', node => [node.offsetWidth, node.offsetHeight]) })
    assert.deepEqual(design, [1280, 720])
    const overflow = await one.capture('capture.html', async page => {
      await page.addStyleTag({ content: 'html, body { overflow: visible } #deck { min-height: 1300px }' })
    })
    assert.ok(overflow.warnings.some(w => w.includes('exceeds viewport')))
  } finally { await one.close(); await jpeg.close() }
})

test('abort terminates capture and browser; close is idempotent', async () => {
  const controller = new AbortController()
  const cancellable = await createCaptureEngine(fixtures, { signal: controller.signal, scale: 1 })
  let started
  const prepared = new Promise(resolve => { started = resolve })
  const capture = cancellable.capture('capture.html', async page => { started(); await page.evaluate(() => new Promise(() => {})) })
  await prepared; controller.abort(new Error('cancel test'))
  await assert.rejects(capture, /cancel test/)
  await cancellable.close(); await cancellable.close()
  assert.throws(() => process.kill(cancellable.browserPid, 0), { code: 'ESRCH' })
  await assert.rejects(cancellable.capture('capture.html'), /cancel test/)
  const already = new AbortController(); already.abort()
  await assert.rejects(createCaptureEngine(fixtures, { signal: already.signal }), { name: 'AbortError' })
})

test('invalid settings are rejected before Chrome launch', async () => {
  for (const options of [{ scale: 3 }, { viewport: { width: 1280, height: 800 } }, { quality: 80 }, { format: 'jpeg', quality: 101 }, { timeoutMs: 0 }]) {
    await assert.rejects(createCaptureEngine(fixtures, options))
  }
})

test('fonts activated during adapter finalization are awaited before screenshot', async () => {
  let readyAtCapture = false
  const result = await engine.capture('capture.html', async page => {
    const screenshot = page.screenshot.bind(page)
    page.screenshot = async options => {
      readyAtCapture = await page.evaluate(() => window.finalFontReady)
      assert.ok(readyAtCapture, 'finalization must not bypass the last fonts.ready wait')
      return screenshot(options)
    }
  }, async page => {
    await page.evaluate(() => {
      window.finalFontReady = false
      const pending = new Promise(resolve => setTimeout(() => { window.finalFontReady = true; resolve(document.fonts) }, 250))
      Object.defineProperty(document.fonts, 'ready', { get: () => pending })
    })
  })
  assert.equal(result.status, 'captured', result.error)
  assert.ok(readyAtCapture)
})
