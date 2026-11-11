import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { test } from 'node:test'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { captureDeck } from '../lib/adapters.js'
import { createCaptureEngine } from '../lib/capture.js'
import { exportCapturedDeck } from '../lib/export.js'

const fixtures = fileURLToPath(new URL('./fixtures/', import.meta.url))
const vendor = '/workspace/dev/vendor'
const inspirationRoot = `${vendor}/inspiration-deck-workshop/dsh-inspiration-deck-workshop/skills/inspiration-deck-workshop`
const wanghongRoot = `${vendor}/dsh-wanghong-handwritten-ppt/skills/wanghong-handwritten-ppt`
const size = image => [Buffer.from(image).readUInt32BE(16), Buffer.from(image).readUInt32BE(20)]
const captured = page => assert.equal(page.status, 'captured', `page ${page.index}: ${page.error}`)

for (const [name, ids] of [
  ['magazine', ['cover', 'drift', 'by-the-numbers', 'shared-contract', 'specimens', 'pipeline', 'before-after', 'next-step']],
  ['swiss', ['cover', 'timeline', 'numbers', 'principle', 'specimens', 'shared-layers', 'contrast', 'closing']],
]) {
  test(`official 歸藏 ${name}: ordered viewport images, ID notes, final state, offline warnings and preview differences`, async () => {
    const run = await captureDeck(`${vendor}/dsh-guizang-design/examples/ppt-${name}/index.html`, { scale: 1 })
    assert.equal(run.allowNetwork, false)
    assert.match(run.browserVersion, /Chrome/)
    assert.equal(run.pages.length, 8)
    assert.deepEqual(run.pages.map(page => page.id), ids)
    assert.equal(run.totalBytes, run.pages.reduce((sum, page) => sum + page.bytes, 0))
    for (const page of run.pages) {
      captured(page)
      assert.deepEqual(size(page.image), [1920, 1080])
      assert.equal(page.notesSource, 'speaker-notes')
      assert.equal(page.notes, run.deck.slides[page.index - 1].notes)
      assert.ok(page.notes.includes('\n'))
      assert.equal(page.renderState.navigation, `?mode=preview&slide=${page.index}`)
      assert.ok(Math.abs(page.renderState.slideBounds.x) < 1)
      assert.equal(page.renderState.slideBounds.width, 1920)
      assert.equal(page.renderState.unresolvedAnimatedElements, 0)
      assert.ok(page.renderState.animatedElements > 0)
      assert.equal(page.renderState.preview.lowPower, true)
      assert.ok(page.renderState.preview.backgroundCanvases > 0)
      if (name === 'swiss') assert.ok(page.renderState.preview.hiddenBackgroundCanvases > 0)
      assert.ok(page.renderState.preview.differences.some(item => item.includes('WebGL')))
      for (const selector of ['#nav', '#hint']) {
        const chrome = page.renderState.chrome.find(item => item.selector === selector)
        assert.equal(chrome.visibility, 'hidden')
        assert.notEqual(chrome.display, 'none', 'preview must preserve chrome layout')
      }
      const embeddedChrome = page.renderState.chrome.filter(item => item.selector === '[data-export-chrome]')
      assert.ok(embeddedChrome.length > 0)
      assert.ok(embeddedChrome.every(item => item.visibility === 'hidden' && item.display !== 'none'))
      assert.ok(page.warnings.some(warning => warning.includes('Blocked resource') && warning.includes('fonts.googleapis.com')))
      assert.ok(page.warnings.some(warning => warning.includes('Missing local resource') && warning.includes('motion.min.js')))
      assert.ok(page.actualFontFamilies.length)
    }
    assert.equal(new Set(run.pages.map(page => Buffer.from(page.image).toString('base64'))).size, 8)
    const output = await mkdtemp(join(tmpdir(), 'deck-official-pptx-'))
    try {
      const result = await exportCapturedDeck(run, output)
      const report = JSON.parse(await readFile(result.reportPath, 'utf8'))
      const markdown = await readFile(result.markdownReportPath, 'utf8')
      assert.equal(markdown, result.summary)
      const pptx = JSON.parse(execFileSync('python3', [fileURLToPath(new URL('./inspect-pptx.py', import.meta.url)), result.pptxPath], { encoding: 'utf8' }))
      assert.equal(pptx.slides.length, 8)
      for (const [i, page] of run.pages.entries()) {
        assert.equal(report.pages[i].id, ids[i])
        assert.deepEqual(report.pages[i].renderState.preview, page.renderState.preview)
        assert.deepEqual(report.pages[i].fontFallbacks, page.fontFallbacks)
        for (const fallback of page.fontFallbacks) {
          assert.ok(markdown.includes(`第 ${page.index} 页字体回退：请求字体「${fallback.requestedFamily}」`))
          assert.ok(markdown.includes(`实际使用「${fallback.actualFamilies.join('、')}」`))
        }
        assert.equal(pptx.slides[i].notes, page.notes, 'official notes survive OOXML in page order')
      }
    } finally { await rm(output, { recursive: true, force: true }) }
    const probe = await createCaptureEngine(fixtures, { scale: 1 })
    try {
      let corner
      const checked = await probe.capture('adapter.html', async page => {
        corner = await page.evaluate(async source => {
          const image = new Image(); image.src = source; await image.decode()
          const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1
          const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0)
          return [...ctx.getImageData(0, 0, 1, 1).data]
        }, `data:image/png;base64,${Buffer.from(run.pages[0].image).toString('base64')}`)
      })
      captured(checked)
      assert.ok(corner.slice(0, 3).some(value => value < 150), `full viewport background is not white: ${corner}`)
    } finally { await probe.close() }
  })
}

test('灵感 official starter uses #/N, hides progress chrome and reads runtime aside notes', async () => {
  const run = await captureDeck(`${inspirationRoot}/templates/starter/index.html`, { resourceRoot: inspirationRoot, scale: 1 })
  assert.equal(run.deck.format, 'hash')
  assert.deepEqual(run.pages.map(page => page.title), ['封面', '三件事', '结束'])
  for (const page of run.pages) {
    captured(page)
    assert.equal(page.renderState.navigation, `#/${page.index}`)
    assert.equal(page.renderState.unresolvedAnimatedElements, 0)
    assert.equal(page.renderState.chrome.find(node => node.selector === '.progress-bar').visibility, 'hidden')
  }
  assert.match(run.pages[0].notes, /开场说明/)
  assert.equal(run.pages[0].notesSource, 'aside.notes')
  assert.equal(run.pages[2].notes, undefined)
  const confined = await captureDeck(`${inspirationRoot}/templates/starter/index.html`, { scale: 1 })
  assert.ok(confined.pages.every(page => page.status === 'failed' && /escapes deck directory/.test(page.error)))
})

test('王虹 official template refuses missing HanziPen rather than capturing fallback', async () => {
  const run = await captureDeck(`${wanghongRoot}/templates/deck.html`, { resourceRoot: wanghongRoot, scale: 1 })
  assert.equal(run.pages.length, 6)
  assert.equal(run.totalBytes, 0)
  for (const page of run.pages) {
    assert.equal(page.status, 'failed')
    assert.match(page.error, /缺少王虹必需的手写字体 HanziPen SC，已拒绝导出/)
    assert.equal(page.bytes, 0)
    assert.ok(page.image, 'retain failure evidence')
    assert.equal(page.notesSource, 'aside.notes')
  }
  const output = await mkdtemp(join(tmpdir(), 'deck-wanghong-refused-'))
  try {
    await assert.rejects(exportCapturedDeck(run, output), error => {
      for (const page of run.pages) assert.ok(error.message.includes(`第 ${page.index} 页失败：缺少王虹必需的手写字体 HanziPen SC，已拒绝导出`))
      assert.match(error.message, /page-6-failed.png/)
      return true
    })
    const markdown = await readFile(join(output, 'export-report.md'), 'utf8')
    assert.match(markdown, /缺少王虹必需的手写字体 HanziPen SC，已拒绝导出/)
    const report = JSON.parse(await readFile(join(output, 'export-report.json'), 'utf8'))
    assert.equal(report.failedPages.length, 6)
    for (const page of report.failedPages) assert.ok((await readFile(join(output, page.evidencePath))).byteLength)
    await assert.rejects(readFile(join(output, 'deck.pptx')), { code: 'ENOENT' })
  } finally { await rm(output, { recursive: true, force: true }) }
})

test('synthetic 王虹 readiness gate succeeds at 1920×1080 and rejects false readiness / smaller viewport', async () => {
  const run = await captureDeck(join(fixtures, 'wanghong-ready.html'), { scale: 1 })
  captured(run.pages[0])
  assert.deepEqual(run.viewport, { width: 1920, height: 1080 })
  assert.equal(run.pages[0].notesSource, 'aside.notes')
  const small = await captureDeck(join(fixtures, 'wanghong-ready.html'), { viewport: { width: 1280, height: 720 }, scale: 1 })
  assert.equal(small.pages[0].status, 'failed')
  assert.match(small.pages[0].error, /1920×1080/)
  const directory = await mkdtemp(join(tmpdir(), 'deck-font-gate-'))
  try {
    const html = await readFile(join(fixtures, 'wanghong-ready.html'), 'utf8')
    await writeFile(join(directory, 'index.html'), html.replace('font-ready="true"', 'font-ready="false"'))
    const failed = await captureDeck(directory, { scale: 1 })
    assert.equal(failed.pages[0].status, 'failed')
    assert.match(failed.pages[0].error, /王虹必需的手写字体尚未就绪，已拒绝导出/)
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test('required-font loaded branch accepts a synthetic local alias and retains 1080p notes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'deck-loaded-font-'))
  try {
    const html = await readFile(join(fixtures, 'wanghong-ready.html'), 'utf8')
    // Exercise availability with a test alias; this does not validate HanziPen handwriting fidelity.
    await writeFile(join(directory, 'index.html'), html
      .replace('<style>', '<style>@font-face { font-family:"HanziPen SC"; src:local("Noto Sans CJK SC") }')
      .replace("font-family:'Noto Sans CJK SC'", "font-family:'HanziPen SC'"))
    const run = await captureDeck(directory, { scale: 1 })
    captured(run.pages[0])
    assert.deepEqual(size(run.pages[0].image), [1920, 1080])
    assert.match(run.pages[0].notes, /合成夹具/)
    assert.ok(run.pages[0].computedFontFamilies.some(family => family.includes('HanziPen SC')))
    assert.ok(run.pages[0].actualFontFamilies.some(family => family.includes('Noto Sans CJK')))
    assert.ok(run.pages[0].fontFallbacks.some(item => item.requestedFamily === 'HanziPen SC' && item.actualFamilies.includes('Noto Sans CJK SC')))
    assert.ok(run.pages[0].warnings.some(warning => warning.includes('字体排版可能不同')))
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test('generic __goTo is zero-based with skipAnim, and runtime notes override static notes by ID', async () => {
  const run = await captureDeck(join(fixtures, 'adapter.html'), { scale: 1 })
  assert.equal(run.deck.navigation, 'dom')
  run.pages.forEach(captured)
  assert.equal(run.pages[0].notes, '运行时备注\n跳过动画：true')
  assert.equal(run.pages[0].notesSource, 'speaker-notes')
  assert.equal(run.pages[1].notes, '属性备注\n中文')
  assert.equal(run.pages[1].notesSource, 'data-notes')
  assert.notDeepEqual(run.pages[0].image, run.pages[1].image)
  assert.notDeepEqual(run.pages[0].actualFontFamilies, run.pages[1].actualFontFamilies, 'font reports exclude offscreen/inactive pages')
})

test('query navigation selects pages and preserves decoded multiline DOM notes', async () => {
  const run = await captureDeck(join(fixtures, 'query.html'), { scale: 1 })
  assert.equal(run.deck.format, 'query')
  run.pages.forEach(captured)
  assert.deepEqual(run.pages.map(page => page.renderState.navigation), ['?slide=1', '?slide=2'])
  assert.equal(run.pages[0].notes, '第一行 ©\n第二行\n第三行')
  assert.equal(run.pages[1].notes, undefined)
})

test('fallback DOM activation preserves the 1280×720 fixed canvas and warns on short viewport / clipping', async () => {
  const run = await captureDeck(join(fixtures, 'fixed-canvas.html'), { scale: 1, viewport: { width: 1280, height: 720 } })
  run.pages.forEach(captured)
  for (const page of run.pages) {
    assert.equal(page.renderState.slideBounds.width, 1280)
    assert.equal(page.renderState.slideBounds.height, 720)
    assert.ok(page.warnings.some(warning => warning.includes('Non-1920×1080 viewport')))
    assert.ok(page.warnings.some(warning => warning.includes('Fixed design canvas 1280×720 preserved')))
    assert.ok(page.warnings.some(warning => /clip/.test(warning)))
  }
  const defaultViewport = await captureDeck(join(fixtures, 'fixed-canvas.html'), { scale: 1 })
  assert.deepEqual(defaultViewport.viewport, { width: 1920, height: 1080 })
  for (const page of defaultViewport.pages) {
    captured(page)
    assert.equal(page.renderState.slideBounds.width, 1280)
    assert.equal(page.renderState.slideBounds.height, 720)
  }
  await assert.rejects(captureDeck(join(fixtures, 'article.html')), /Unsupported HTML/)
})

test('synthetic preview keeps flex chrome space and forces pipeline final state after delayed fonts', async () => {
  const run = await captureDeck(join(fixtures, 'guizang-static.html'), { scale: 1 })
  const page = run.pages[0]
  captured(page)
  assert.equal(page.renderState.slideBounds.height, 1000, '80px nav space remains in the flex layout')
  assert.equal(page.renderState.chrome.find(node => node.selector === '#nav').display, 'block')
  assert.equal(page.renderState.unresolvedAnimatedElements, 0)
  assert.equal(page.renderState.animatedElements, 2)
  assert.equal(page.notes, '第一行\n第二行')
  assert.ok(page.elapsedMs >= 500, 'wait for the font gate before finalizing pipeline')
})

test('adapter run reports chosen pixel density, format, quality, total bytes and network policy', async () => {
  const path = join(fixtures, 'wanghong-ready.html')
  const png = await captureDeck(path, { scale: 1 })
  const large = await captureDeck(path)
  const jpeg = await captureDeck(path, { scale: 1, format: 'jpeg', quality: 70, allowNetwork: true })
  for (const run of [png, large, jpeg]) {
    run.pages.forEach(captured)
    assert.equal(run.totalBytes, run.pages[0].image.byteLength)
  }
  assert.deepEqual(size(png.pages[0].image), [1920, 1080])
  assert.deepEqual(size(large.pages[0].image), [3840, 2160])
  assert.equal(large.scale, 2)
  assert.notEqual(png.totalBytes, large.totalBytes)
  assert.equal(jpeg.format, 'jpeg'); assert.equal(jpeg.quality, 70); assert.equal(jpeg.allowNetwork, true)
  assert.equal(png.allowNetwork, false)
  assert.deepEqual([...jpeg.pages[0].image.slice(0, 2)], [0xff, 0xd8])
  assert.notEqual(jpeg.totalBytes, png.totalBytes)
})

test('wrong query navigation fails with evidence and retains the later successful page', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'deck-query-failure-'))
  try {
    const html = await readFile(join(fixtures, 'query.html'), 'utf8')
    await writeFile(join(directory, 'index.html'), html.replace("[index].classList.add('active')", "[1].classList.add('active')"))
    const run = await captureDeck(directory, { scale: 1 })
    assert.equal(run.pages.length, 2)
    assert.equal(run.pages[0].status, 'failed')
    assert.match(run.pages[0].error, /not visible/)
    assert.ok(run.pages[0].image)
    assert.equal(run.pages[0].bytes, 0)
    captured(run.pages[1])
    assert.equal(run.totalBytes, run.pages[1].bytes)
  } finally { await rm(directory, { recursive: true, force: true }) }
})
