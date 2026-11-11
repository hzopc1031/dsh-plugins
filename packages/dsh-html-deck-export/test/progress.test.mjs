import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import puppeteer from 'puppeteer-core'
import { exportDeck } from '../lib/export.js'

const fixtures = fileURLToPath(new URL('./fixtures/', import.meta.url))
const PptxGenJS = createRequire(import.meta.url)('pptxgenjs')
const progress = directory => readFile(join(directory, 'export-progress.json'), 'utf8').then(JSON.parse)
async function output(t) {
  const directory = await mkdtemp(join(tmpdir(), 'deck-progress-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  return directory
}

test('real multi-page export exposes launch, each capture, assembly and final progress', async t => {
  const directory = await output(t)
  const input = join(fixtures, 'adapter.html')
  const updates = []
  const launch = puppeteer.launch.bind(puppeteer)
  t.mock.method(puppeteer, 'launch', async options => {
    updates.push(await progress(directory))
    const browser = await launch(options)
    const newPage = browser.newPage.bind(browser)
    t.mock.method(browser, 'newPage', async () => {
      const page = await newPage()
      const screenshot = page.screenshot.bind(page)
      t.mock.method(page, 'screenshot', async options => {
        updates.push(await progress(directory))
        return screenshot(options)
      })
      return page
    })
    return browser
  })
  const write = PptxGenJS.prototype.write
  t.mock.method(PptxGenJS.prototype, 'write', async function (...args) {
    updates.push(await progress(directory))
    return write.apply(this, args)
  })
  const result = await exportDeck(input, directory, { scale: 1 })
  const final = await progress(directory)
  assert.deepEqual(updates.map(({ phase, currentPage, totalPages }) => [phase, currentPage, totalPages]), [
    ['launch', 0, 2], ['capture', 1, 2], ['capture', 2, 2], ['assemble', 2, 2],
  ])
  assert.ok(updates.every(update => update.inputPath === input && update.pptxPath === null && !update.reportsWritten))
  assert.equal(final.phase, 'done')
  assert.equal(final.currentPage, 2)
  assert.equal(final.totalPages, 2)
  assert.equal(final.lastError, null)
  assert.equal(final.pptxPath, result.pptxPath)
  assert.equal(final.reportPath, result.reportPath)
  assert.equal(final.markdownReportPath, result.markdownReportPath)
  assert.equal(final.reportsWritten, true)
  assert.deepEqual(final.failedPages, [])
  assert.equal((await stat(result.progressPath)).mode & 0o777, 0o600)
  assert.ok((await readdir(directory)).every(name => !name.startsWith('.html-deck-')), 'clean staged progress and PPTX files')
  assert.match(result.summary, /导出完成：共 2 页/)
  assert.match(result.summary, /字体回退警告：\d+ 条；失败页：无/)
  assert.ok(!result.summary.includes('base64'))
  assert.ok(result.summary.includes(result.progressPath))
})

test('failed page leaves failed progress, aligned evidence and no partial PPTX', async t => {
  const directory = await output(t)
  const source = await readFile(join(fixtures, 'adapter.html'), 'utf8')
  const input = join(directory, 'broken.html')
  await writeFile(input, source.replace('window.__goTo = (i, options) => {', `window.__goTo = (i, options) => {
    if (i === 1) document.body.insertAdjacentHTML('beforeend', '<img src="missing.png">');`))
  await assert.rejects(exportDeck(input, directory, { scale: 1 }), /第 2 页失败：.*Image not loaded/)
  const final = await progress(directory)
  assert.equal(final.phase, 'failed')
  assert.equal(final.currentPage, 2)
  assert.equal(final.totalPages, 2)
  assert.match(final.lastError, /Image not loaded/)
  assert.equal(final.pptxPath, null)
  assert.equal(final.reportsWritten, true)
  assert.deepEqual(final.failedPages.map(page => page.index), [2])
  assert.ok((await stat(join(directory, final.failedPages[0].evidencePath))).size > 0)
  const report = JSON.parse(await readFile(final.reportPath, 'utf8'))
  assert.equal(report.status, 'failed')
  assert.equal(final.failedPages[0].evidencePath, report.failedPages[0].evidencePath)
  await assert.rejects(stat(join(directory, 'deck.pptx')), { code: 'ENOENT' })
  await writeFile(join(directory, 'deck.pptx'), 'previous good PPTX')
  await assert.rejects(exportDeck(input, directory, { scale: 1 }))
  assert.equal(await readFile(join(directory, 'deck.pptx'), 'utf8'), 'previous good PPTX')
  assert.equal((await progress(directory)).phase, 'failed')
})

test('cancellation during capture kills real Chrome and leaves failed progress', { timeout: 15000 }, async t => {
  const directory = await output(t)
  const controller = new AbortController()
  t.after(() => controller.abort())
  const input = join(directory, 'slow.html')
  await writeFile(input, '<section class="slide">等待字体</section><script>Object.defineProperty(document.fonts,"ready",{get:()=>new Promise(()=>{})})</script>')
  const launch = puppeteer.launch.bind(puppeteer)
  let pid
  let entered
  const capturing = new Promise(resolve => { entered = resolve })
  t.mock.method(puppeteer, 'launch', async options => {
    const browser = await launch(options)
    pid = browser.process().pid
    const newPage = browser.newPage.bind(browser)
    t.mock.method(browser, 'newPage', async () => {
      const page = await newPage()
      const evaluate = page.evaluate.bind(page)
      t.mock.method(page, 'evaluate', (...args) => {
        const pending = evaluate(...args)
        if (String(args[0]).includes('await document.fonts.ready')) entered()
        return pending
      })
      return page
    })
    return browser
  })
  const pending = exportDeck(input, directory, { scale: 1, signal: controller.signal })
  const rejected = assert.rejects(pending, /已取消/)
  await capturing
  assert.equal((await progress(directory)).phase, 'capture')
  controller.abort(new Error('test in-flight cancellation'))
  await rejected
  assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' })
  const final = await progress(directory)
  assert.equal(final.phase, 'failed')
  assert.match(final.lastError, /test in-flight cancellation/)
  assert.equal(final.pptxPath, null)
  assert.equal(final.reportsWritten, false)
  await assert.rejects(stat(join(directory, 'deck.pptx')), { code: 'ENOENT' })
  assert.ok((await readdir(directory)).every(name => !name.startsWith('.html-deck-')))
})

test('detection, launch and assembly failures overwrite prior running/done progress', async t => {
  const directory = await output(t)
  const input = join(fixtures, 'export.html')
  const result = await exportDeck(input, directory, { scale: 1 })
  const previous = await readFile(result.pptxPath)
  await assert.rejects(exportDeck(join(fixtures, 'article.html'), directory), /Unsupported HTML/)
  let final = await progress(directory)
  assert.equal(final.phase, 'failed')
  assert.equal(final.totalPages, null)
  assert.equal(final.reportsWritten, false, 'old reports are not attributed to this attempt')
  await assert.rejects(exportDeck(input, directory, { signal: AbortSignal.abort(new Error('already cancelled')) }), /已取消/)
  assert.equal((await progress(directory)).phase, 'failed')
  const mocked = t.mock.method(puppeteer, 'launch', async () => { throw new Error('Injected launch failure') })
  await assert.rejects(exportDeck(input, directory), /Injected launch failure/)
  assert.equal((await progress(directory)).phase, 'failed')
  mocked.mock.restore()
  const write = PptxGenJS.prototype.write
  const assembly = t.mock.method(PptxGenJS.prototype, 'write', async () => { throw new Error('Injected assembly failure') })
  await assert.rejects(exportDeck(input, directory, { scale: 1 }), /Injected assembly failure/)
  final = await progress(directory)
  assert.equal(final.phase, 'failed')
  assert.equal(final.reportsWritten, true)
  assert.equal(final.pptxPath, null)
  assert.deepEqual(await readFile(result.pptxPath), previous)
  assembly.mock.restore()
  const controller = new AbortController()
  t.mock.method(PptxGenJS.prototype, 'write', async function (...args) {
    const data = await write.apply(this, args)
    controller.abort(new Error('Cancelled during assembly'))
    return data
  })
  await assert.rejects(exportDeck(input, directory, { scale: 1, signal: controller.signal }), /已取消/)
  assert.equal((await progress(directory)).phase, 'failed')
  assert.deepEqual(await readFile(result.pptxPath), previous)
})

test('progress replaces symlinks without writing outside; unwritable progress prevents PPTX commit', async t => {
  const directory = await output(t)
  const outside = await output(t)
  const sentinel = join(outside, 'sentinel.json')
  await writeFile(sentinel, 'outside progress')
  await symlink(sentinel, join(directory, 'export-progress.json'))
  const result = await exportDeck(join(fixtures, 'export.html'), directory, { scale: 1 })
  assert.equal(await readFile(sentinel, 'utf8'), 'outside progress')
  assert.equal((await progress(directory)).phase, 'done')
  const previous = await readFile(result.pptxPath)
  const write = PptxGenJS.prototype.write
  t.mock.method(PptxGenJS.prototype, 'write', async function (...args) {
    const data = await write.apply(this, args)
    await rm(result.progressPath)
    await mkdir(result.progressPath)
    return data
  })
  await assert.rejects(exportDeck(join(fixtures, 'export.html'), directory, { scale: 1 }), /进度写入失败/)
  assert.deepEqual(await readFile(result.pptxPath), previous)
})
