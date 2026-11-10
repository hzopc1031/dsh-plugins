import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { detectDeck } from 'dsh-html-deck-export/detect'

const fixtures = fileURLToPath(new URL('./fixtures/', import.meta.url))
const guizang = '/workspace/dev/vendor/dsh-guizang-design/examples'
const inspiration = '/workspace/dev/vendor/inspiration-deck-workshop/dsh-inspiration-deck-workshop/skills/inspiration-deck-workshop'
const wanghong = '/workspace/dev/vendor/dsh-wanghong-handwritten-ppt/skills/wanghong-handwritten-ppt'

async function localDeck(t, body, { head = '', attrs = '', files = {} } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-html-deck-detect-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const path = join(directory, 'index.html')
  await writeFile(path, `<!doctype html><html ${attrs}><head>${head}</head><body>${body}</body></html>`)
  for (const [name, content] of Object.entries(files)) await writeFile(join(directory, name), content)
  return path
}

for (const [example, ids] of [
  ['ppt-magazine', ['cover', 'drift', 'by-the-numbers', 'shared-contract', 'specimens', 'pipeline', 'before-after', 'next-step']],
  ['ppt-swiss', ['cover', 'timeline', 'numbers', 'principle', 'specimens', 'shared-layers', 'contrast', 'closing']],
]) {
  test(`official 歸藏 ${example}: ordered pages, preview query URLs, static notes by id`, async () => {
    const result = await detectDeck(join(guizang, example))
    assert.equal(result.format, 'guizang')
    assert.equal(result.navigation, 'query')
    assert.deepEqual(result.slides.map(slide => slide.id), ids)
    assert.equal(result.slides.length, 8)
    assert.equal(result.designSize, undefined, 'viewport-based CSS is not a fixed canvas')
    assert.equal(result.runtimeNotes, false)
    for (const [i, slide] of result.slides.entries()) {
      assert.equal(slide.index, i + 1)
      const url = new URL(slide.url)
      assert.equal(url.protocol, 'file:')
      assert.equal(url.searchParams.get('slide'), String(i + 1))
      assert.equal(url.searchParams.get('mode'), 'preview')
      assert.equal(url.hash, '')
      assert.equal(slide.notesSource, 'speaker-notes')
      assert.ok(slide.notes.includes('\n'), `multiline notes for ${slide.id}`)
    }
    assert.ok(result.warnings.some(warning => warning.includes('did not fetch https:')))
    const specific = result.slides.find(slide => slide.id === (example === 'ppt-magazine' ? 'pipeline' : 'shared-layers'))
    assert.match(specific.notes, example === 'ppt-magazine' ? /六步全部点亮后再翻页/ : /Token：颜色、字号、间距/)
  })
}

test('official 灵感 starter: linked runtime supplies one-based hash pagination and aside notes', async () => {
  const result = await detectDeck(join(inspiration, 'templates/starter/index.html'))
  assert.equal(result.format, 'hash')
  assert.equal(result.navigation, 'hash')
  assert.deepEqual(result.slides.map(slide => slide.title), ['封面', '三件事', '结束'])
  assert.deepEqual(result.slides.map(slide => new URL(slide.url).hash), ['#/1', '#/2', '#/3'])
  assert.equal(result.slides[0].notesSource, 'aside.notes')
  assert.match(result.slides[0].notes, /开场说明这是一份 starter deck/)
  assert.equal(result.slides[1].notes, undefined, 'no invented notes')
  assert.deepEqual(result.warnings, [])
})

test('official 王虹 template and example: hash navigation and notes only where supplied', async () => {
  const template = await detectDeck(join(wanghong, 'templates/deck.html'))
  assert.equal(template.format, 'hash')
  assert.deepEqual(template.slides.map(slide => slide.title), ['封面', '变化', '图解', '对比', '总结', '结束'])
  assert.ok(template.slides.every(slide => slide.notesSource === 'aside.notes'))
  assert.equal(template.slides[5].notes, '感谢观众，进入提问。')
  const example = await detectDeck(join(wanghong, 'examples/deepseek-v4-flash/index.html'))
  assert.equal(example.format, 'hash')
  assert.equal(example.slides.length, 19)
  assert.equal(example.slides[0].title, '封面')
  assert.equal(example.slides[18].title, '结束')
  assert.ok(example.slides.every(slide => slide.notes === undefined))
})

test('owned generic fixture: direct children in DOM order, no nested/overview/template/script pages', async () => {
  const result = await detectDeck(join(fixtures, 'generic.html'))
  assert.equal(result.format, 'generic')
  assert.equal(result.navigation, 'dom')
  assert.deepEqual(result.slides.map(slide => slide.id), ['second-name', 'first-name'])
  assert.deepEqual(result.slides.map(slide => slide.selector), [
    'html:nth-of-type(1) > body:nth-of-type(1) > div:nth-of-type(1) > section:nth-of-type(1)',
    'html:nth-of-type(1) > body:nth-of-type(1) > div:nth-of-type(1) > section:nth-of-type(4)',
  ])
  assert.equal(result.slides[0].notes, '第一行 & 开场\n第二行\n第三行 中文')
  assert.equal(result.slides[1].notes, '保留属性备注\n下一行 "引号"')
  assert.equal(result.slides[1].notesSource, 'data-notes')
})

test('section.slide fallback excludes nested sections and overview clones without #deck', async t => {
  const path = await localDeck(t, '<main><section class="slide" data-title="One"><section class="slide">Nested</section></section><section class="slide" data-title="Two"></section></main><div class="overview"><section class="slide">Clone</section></div>')
  assert.deepEqual((await detectDeck(path)).slides.map(slide => slide.title), ['One', 'Two'])
})

test('owned article is rejected even if it contains a ?slide= link', async () => {
  await assert.rejects(detectDeck(join(fixtures, 'article.html')), /Unsupported HTML: no deck contract/)
})

test('fixed canvas size is returned unchanged, independent of default capture viewport', async () => {
  const result = await detectDeck(join(fixtures, 'fixed-canvas.html'))
  assert.equal(result.format, 'fixed-canvas')
  assert.deepEqual(result.designSize, { width: 1280, height: 720, source: 'css' })
  assert.equal(result.slides.length, 2)
})

test('declared sizes and query pagination are independent; linked CSS is read locally', async t => {
  const path = await localDeck(t, '<div id="deck"><section class="slide"></section><section class="slide"></section></div><script>const page = new URLSearchParams(location.search).get("slide");</script>', {
    attrs: 'data-export-width="1280" data-export-height="720"',
    head: '<link rel="stylesheet" href="stage.css">', files: { 'stage.css': '#deck { width: 1600px; height: 900px; }' },
  })
  const result = await detectDeck(path)
  assert.equal(result.format, 'query')
  assert.deepEqual(result.designSize, { width: 1280, height: 720, source: 'attributes' })
  assert.equal(new URL(result.slides[1].url).search, '?slide=2')
  assert.equal(new URL(result.slides[1].url).searchParams.has('mode'), false)
  const cssOnly = await localDeck(t, '<div id="deck"><section class="slide"></section></div>', {
    head: '<link rel="stylesheet" href="stage.css">', files: { 'stage.css': '.slide { height:720px; width:1280px; }' },
  })
  assert.deepEqual((await detectDeck(cssOnly)).designSize, { width: 1280, height: 720, source: 'css' })
})

test('query navigation recognizes URL/searchParams and location.search regex readers', async t => {
  for (const code of [
    'const page = new URL(location.href).searchParams.get("slide");',
    'const page = /[?&]slide=(\\d+)/.exec(location.search);',
  ]) {
    const path = await localDeck(t, `<section class="slide"></section><script>${code}</script>`)
    assert.equal((await detectDeck(path)).format, 'query')
  }
})

test('static speaker note maps/arrays align by id rather than object order and decode literal escapes', async t => {
  for (const expression of [
    `{ b: '第二页\\n下一行', a: {talk: ['甲', '乙'], transition: '引号\\\'和\\u4e2d\\x21\\u{1f600}'}, }`,
    `[{ id: 'b', talk: ['第二页', '下一行'] }, { id: 'a', talk: ['甲', '乙'], transition: '引号\\\'和\\u4e2d\\x21\\u{1f600}' }]`,
  ]) {
    const path = await localDeck(t, `<section class="slide" data-slide-id="a"></section><section class="slide" data-slide-id="b"></section><script>const NOTES = ${expression}; window.__SPEAKER_NOTES__ = NOTES;</script>`)
    const result = await detectDeck(path)
    assert.equal(result.runtimeNotes, false)
    assert.equal(result.slides[0].notes, "甲\n乙\n引号'和中!😀")
    assert.equal(result.slides[1].notes, '第二页\n下一行')
  }
})

test('direct JSON notes are supported; runtime expressions are flagged without executing deck code', async t => {
  const path = await localDeck(t, '<section class="slide" data-slide-id="a"></section><script>window.__SPEAKER_NOTES__ = {"a":"中文\\n第二行"};</script>')
  assert.equal((await detectDeck(path)).slides[0].notes, '中文\n第二行')
  const sentinel = join(path, '..', 'must-never-execute')
  const runtime = await localDeck(t, `<section class="slide" data-slide-id="a" data-notes="静态备用备注"></section><script>window.__SPEAKER_NOTES__ = (() => { require('node:fs').writeFileSync(${JSON.stringify(sentinel)}, 'executed'); return {a:'not static'} })();</script>`)
  const result = await detectDeck(runtime)
  assert.equal(result.runtimeNotes, true)
  assert.equal(result.slides[0].notes, '静态备用备注')
  assert.ok(result.warnings.some(warning => warning.includes('runtime JavaScript')))
  await assert.rejects(readFile(sentinel), { code: 'ENOENT' })
})

test('invalid deck contracts, design dimensions, paths and ambiguous navigation refuse clearly', async t => {
  const cases = [
    ['<div id="deck"><section class="slide"></section></div>', { attrs: 'data-medium="slide"' }, /unique data-slide-id/],
    ['<section class="slide" data-slide-id="a"></section>', { attrs: 'data-medium="slide"' }, /require #deck/],
    ['<div id="deck"><section class="slide" data-slide-id="a"></section><section class="slide" data-slide-id="a"></section></div>', { attrs: 'data-medium="slide"' }, /unique data-slide-id/],
    ['<div id="deck"><section class="slide"></section></div><div id="deck"></div>', {}, /multiple #deck/],
    ['<section class="slide"></section>', { attrs: 'data-export-width="1280"' }, /positive integers/],
    ['<section class="slide" data-export-width="0" data-export-height="720"></section>', {}, /positive integers/],
    ['<section class="slide" style="width:1280px;height:720px"></section><section class="slide" style="width:1600px;height:900px"></section>', {}, /Conflicting design sizes/],
    ['<section class="slide"></section><script>const h = location.hash; const page = new URLSearchParams(location.search).get("slide"); const hash = "#/1";</script>', {}, /Ambiguous deck navigation/],
    ['<section class="slide"></section>', { head: '<base href="https://example.invalid/">' }, /<base>/],
  ]
  for (const [body, options, expected] of cases) await assert.rejects(detectDeck(await localDeck(t, body, options)), expected)
  await assert.rejects(detectDeck('https://example.invalid/deck.html'), /local HTML path/)
  const path = await localDeck(t, '<section class="slide"></section>')
  const text = join(path, '..', 'deck.txt')
  await writeFile(text, '<section class="slide"></section>')
  await assert.rejects(detectDeck(text), /HTML file/)
})

test('missing and remote linked resources produce explicit warnings without network access', async t => {
  const path = await localDeck(t, '<section class="slide"></section><script src="missing.js"></script><script src="https://example.invalid/runtime.js"></script>', {
    head: '<link rel="stylesheet" href="https://example.invalid/fonts.css">',
  })
  const result = await detectDeck(path)
  assert.equal(result.warnings.length, 3)
  assert.ok(result.warnings.some(warning => warning.includes('ENOENT')))
  assert.equal(result.format, 'generic')
})

test('markup scanner handles uppercase tags, quoted >, raw text, void tags and rejects browser repair', async t => {
  const path = await localDeck(t, '<SECTION CLASS="slide" DATA-NOTES="a > b"><img src="local.png"><textarea><section class="slide">Text</section></textarea></SECTION>')
  const result = await detectDeck(path)
  assert.equal(result.slides.length, 1)
  assert.equal(result.slides[0].notes, 'a > b')
  for (const body of ['<section class="slide"><div></section></div>', '<section class="slide"/>', '<section class="slide"></section><script>']) {
    await assert.rejects(detectDeck(await localDeck(t, body)), /Unsupported HTML/)
  }
})
