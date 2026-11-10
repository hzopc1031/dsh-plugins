import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdtemp, mkdir, readFile, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { captureDeck } from '../lib/adapters.js'
import { exportCapturedDeck } from '../lib/export.js'

const fixtures = fileURLToPath(new URL('./fixtures/', import.meta.url))
const PptxGenJS = createRequire(import.meta.url)('pptxgenjs')
const inspector = fileURLToPath(new URL('./inspect-pptx.py', import.meta.url))
const inspect = path => JSON.parse(execFileSync('python3', [inspector, path], { encoding: 'utf8' }))
const digest = bytes => createHash('sha256').update(bytes).digest('hex')
const readReport = directory => readFile(join(directory, 'export-report.json'), 'utf8').then(JSON.parse)
let capture
async function sample() {
  return capture ??= captureDeck(join(fixtures, 'adapter.html'), { scale: 1 })
}

test('PPTX is valid OOXML with exactly one full-bleed image per page and multiline Chinese notes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'deck-pptx-'))
  try {
    const run = structuredClone(await sample())
    run.pages[0].notes = '第一行：中文 & <讲稿>\n\n第二行：你好，世界！\n第三行 🎤'
    run.pages[0].warnings.push('Requested primary font not observed: missing-test-font')
    run.pages[0].renderState.preview = { lowPower: true, backgroundCanvases: 2, hiddenBackgroundCanvases: 1, differences: ['Synthetic preview difference for serialization test'] }
    const result = await exportCapturedDeck(run, directory, { fileName: '演示稿.pptx' })
    const report = await readReport(directory)
    assert.deepEqual(JSON.parse(JSON.stringify(result.report)), report)
    assert.equal(report.status, 'completed')
    assert.equal(report.pageCount, 2)
    assert.equal(report.detectedFormat, 'generic')
    assert.deepEqual(report.viewport, { width: 1920, height: 1080 })
    assert.equal(report.scale, 1)
    assert.equal(report.format, 'png')
    assert.equal(report.quality, null)
    assert.equal(report.networkMode, 'blocked')
    assert.equal(report.browserVersion, run.browserVersion)
    assert.equal(report.totalBytes, run.pages.reduce((sum, page) => sum + page.image.byteLength, 0))
    assert.equal(report.pptxBytes, (await stat(result.pptxPath)).size)
    assert.ok(report.elapsedMs >= report.captureElapsedMs)
    assert.deepEqual(report.failedPages, [])
    assert.deepEqual(report.actualFontFamilies, [...new Set(run.pages.flatMap(page => page.actualFontFamilies))].sort())
    assert.ok(report.pages[0].fontWarnings.some(warning => warning.includes('missing-test-font')))
    assert.deepEqual(report.pages[0].renderState.preview, run.pages[0].renderState.preview)
    assert.ok(report.pages.every(page => !('image' in page)))
    const pptx = inspect(result.pptxPath)
    assert.equal(Number(pptx.size.cx) * 9, Number(pptx.size.cy) * 16)
    assert.equal(pptx.slides.length, run.pages.length)
    for (const [i, slide] of pptx.slides.entries()) {
      assert.deepEqual(slide.position, { x: '0', y: '0' })
      assert.deepEqual(slide.extent, { cx: pptx.size.cx, cy: pptx.size.cy })
      assert.equal(slide.imageBytes, run.pages[i].bytes)
      assert.equal(slide.imageSha256, digest(run.pages[i].image), 'preserve image bytes and DOM order')
      assert.equal(slide.notes, run.pages[i].notes)
    }
    assert.deepEqual((await readdir(directory)).sort(), ['export-report.json', '演示稿.pptx'])
    assert.equal((await stat(result.pptxPath)).mode & 0o777, 0o600)
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test('actual 2× PNG and smaller 1× JPEG exports report their byte totals and quality', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'deck-size-'))
  try {
    const input = join(fixtures, 'export.html')
    const large = await captureDeck(input)
    const small = await captureDeck(input, { scale: 1, format: 'jpeg', quality: 65, allowNetwork: true })
    const bigResult = await exportCapturedDeck(large, directory, { fileName: 'large.pptx' })
    const bigReport = await readReport(directory)
    const smallResult = await exportCapturedDeck(small, directory, { fileName: 'small.pptx' })
    const smallReport = await readReport(directory)
    assert.equal(bigReport.scale, 2)
    assert.equal(bigReport.format, 'png')
    assert.equal(bigReport.totalBytes, large.totalBytes)
    assert.equal(smallReport.scale, 1)
    assert.equal(smallReport.format, 'jpeg')
    assert.equal(smallReport.quality, 65)
    assert.equal(smallReport.networkMode, 'allowed')
    assert.equal(smallReport.totalBytes, small.totalBytes)
    assert.ok(smallReport.totalBytes < bigReport.totalBytes, `${smallReport.totalBytes} < ${bigReport.totalBytes}`)
    assert.ok(smallReport.pptxBytes < bigReport.pptxBytes)
    assert.ok(inspect(bigResult.pptxPath).slides[0].imagePath.endsWith('.png'))
    assert.ok(inspect(smallResult.pptxPath).slides[0].imagePath.endsWith('.jpeg'))
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test('failed pages remain in the report with evidence and never replace a good PPTX', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'deck-failed-'))
  try {
    const good = await sample()
    const result = await exportCapturedDeck(good, directory)
    const previous = await readFile(result.pptxPath)
    const failed = structuredClone(good)
    Object.assign(failed.pages[0], { status: 'failed', bytes: 0, error: 'Required font unavailable' })
    await assert.rejects(exportCapturedDeck(failed, directory), /refusing a partial PPTX/)
    assert.deepEqual(await readFile(result.pptxPath), previous)
    const report = await readReport(directory)
    assert.equal(report.status, 'failed')
    assert.equal(report.pageCount, 2)
    assert.equal(report.pages.length, 2)
    assert.equal(report.pages[1].status, 'captured')
    assert.equal(report.failedPages.length, 1)
    assert.equal(report.failedPages[0].error, 'Required font unavailable')
    assert.equal(report.failedPages[0].bytes, 0)
    assert.equal(report.pptxBytes, 0)
    assert.equal(report.totalBytes, good.pages[1].bytes)
    const evidence = join(directory, report.failedPages[0].evidencePath)
    assert.deepEqual(await readFile(evidence), Buffer.from(good.pages[0].image))
    assert.ok(!report.failedPages[0].evidencePath.includes('..'))
    failed.pages[0].image = undefined
    await assert.rejects(exportCapturedDeck(failed, directory), /partial PPTX/)
    assert.equal((await readReport(directory)).failedPages[0].evidencePath, undefined, 'reason remains when screenshot evidence is unavailable')
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test('assembly rejection and abort after serialization preserve the completed PPTX and clean staging', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'deck-atomic-'))
  try {
    const run = await sample()
    const result = await exportCapturedDeck(run, directory)
    const previous = await readFile(result.pptxPath)
    const serialize = PptxGenJS.prototype.write
    const mocked = t.mock.method(PptxGenJS.prototype, 'write', async () => { throw new Error('Injected assembly failure') })
    await assert.rejects(exportCapturedDeck(run, directory), /Injected assembly failure/)
    assert.equal((await readReport(directory)).status, 'failed')
    assert.deepEqual(await readFile(result.pptxPath), previous)
    mocked.mock.restore()
    const controller = new AbortController()
    t.mock.method(PptxGenJS.prototype, 'write', async function (...args) {
      const data = await serialize.apply(this, args)
      controller.abort(new Error('Cancelled before publication'))
      return data
    })
    await assert.rejects(exportCapturedDeck(run, directory, { signal: controller.signal }), /Cancelled before publication/)
    assert.deepEqual(await readFile(result.pptxPath), previous)
    assert.equal((await readReport(directory)).pptxBytes, 0)
    assert.deepEqual((await readdir(directory)).sort(), ['deck.pptx', 'export-report.json'])
    await assert.rejects(exportCapturedDeck(run, directory, { signal: controller.signal }), /Cancelled before publication/)
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test('output names reject traversal and absolute paths; existing output symlinks cannot write outside', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'deck-path-'))
  try {
    const output = join(directory, 'allowed')
    await mkdir(output)
    const run = await sample()
    for (const fileName of ['../outside.pptx', join(directory, 'absolute.pptx'), 'sub/file.pptx', '..\\outside.pptx', '/tmp/escape.pptx', 'deck.json', 'bad\0.pptx']) {
      await assert.rejects(exportCapturedDeck(run, output, { fileName }), /plain .pptx filename/)
    }
    assert.deepEqual(await readdir(output), [])
    const sentinel = join(directory, 'outside.pptx')
    const reportSentinel = join(directory, 'outside.json')
    await writeFile(sentinel, 'previous outside PPTX')
    await writeFile(reportSentinel, 'outside report')
    await symlink(sentinel, join(output, 'deck.pptx'))
    await symlink(reportSentinel, join(output, 'export-report.json'))
    await exportCapturedDeck(run, output)
    assert.equal(await readFile(sentinel, 'utf8'), 'previous outside PPTX')
    assert.equal(await readFile(reportSentinel, 'utf8'), 'outside report')
    inspect(join(output, 'deck.pptx'))
    await assert.rejects(exportCapturedDeck(run, sentinel), /existing directory/)
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test('missing/reordered captures and incomplete images cannot publish a partial PPTX', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'deck-incomplete-'))
  try {
    const run = await sample()
    for (const pages of [[], run.pages.slice(1), [...run.pages].reverse()]) {
      await assert.rejects(exportCapturedDeck({ ...run, pages }, directory), /every detected page/)
    }
    const incomplete = structuredClone(run)
    incomplete.pages[0].image = undefined
    await assert.rejects(exportCapturedDeck(incomplete, directory), /no complete captured image/)
    const invalidNotes = structuredClone(run)
    invalidNotes.pages[0].notes = '中文\u0000无效 XML'
    await assert.rejects(exportCapturedDeck(invalidNotes, directory), /characters forbidden in XML/)
    assert.deepEqual(await readdir(directory), ['export-report.json'])
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test('an unwritable report target prevents PPTX replacement and surfaces both errors', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'deck-report-write-'))
  try {
    const run = await sample()
    const result = await exportCapturedDeck(run, directory)
    const previous = await readFile(result.pptxPath)
    await rm(result.reportPath)
    await mkdir(result.reportPath)
    await assert.rejects(exportCapturedDeck(run, directory), error => {
      assert.ok(error instanceof AggregateError)
      assert.equal(error.errors.length, 2)
      return true
    })
    assert.deepEqual(await readFile(result.pptxPath), previous)
    assert.deepEqual((await readdir(directory)).sort(), ['deck.pptx', 'export-report.json'])
  } finally { await rm(directory, { recursive: true, force: true }) }
})
