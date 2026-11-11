import assert from 'node:assert/strict'
import test from 'node:test'
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createServer } from 'node:http'
import { Context } from '@deepseek-ai/cordis'
import { CommandRuntime } from '@deepseek-ai/dsh-commands'
import ToolRuntime, { defineTool } from '@deepseek-ai/dsh-tools'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import { createScope } from '@deepseek-ai/dsh-scope'
import * as plugin from '../index.js'

const packageRoot = fileURLToPath(new URL('../', import.meta.url))
const signal = new AbortController().signal
let sequence = 0
async function setup(t, module = plugin, cwd) {
  const root = cwd ?? await mkdtemp(join(tmpdir(), 'html-deck-tool-'))
  if (!cwd) t.after(() => rm(root, { recursive: true, force: true }))
  const ctx = new Context()
  t.after(() => ctx.fiber.dispose())
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(CommandRuntime)
  const fork = ctx.plugin(module, {})
  await fork
  const agent = { session: { id: 'export', header: { cwd: root } } }
  await ctx.plugin({ inject: ['tools'], apply(child) { agent.ctx = createScope(child, agent).ctx } })
  const command = (rawInput = '') => ctx.commands.find(agent, 'html-deck-export').handler({ agent, rawInput, attachments: [], signal })
  const execute = (args, options = {}) => ctx.tools.execute({ callId: `tool-${++sequence}`, name: 'html_deck_export', arguments: args, agent, signal, ...options })
  const out = join(root, 'out')
  if (!cwd) {
    await mkdir(out)
    await cp(new URL('./fixtures/export.html', import.meta.url), join(root, 'index.html'))
  }
  return { root, ctx, fork, agent, command, execute, out }
}
function text(result) { return result.content.map(item => item.text ?? '').join('\n') }
const args = { inputPath: 'index.html', exportDirectory: 'out', scale: 1 }

function dummy(name) {
  return defineTool({ name, description: 'test capability', parameters: {},
    output: { schema: { type: 'string' }, render: (_, value) => [{ type: 'text', text: value }] },
    async execute() { return 'ran' },
  })
}

test('one prefixed tool, honest bilingual help and no publish/post/login/shell tools', async t => {
  assert.equal(plugin.name, 'html-deck-export')
  assert.deepEqual(plugin.inject, ['commands', 'tools'])
  assert.deepEqual(plugin.Config({}), {})
  const { ctx, fork, command } = await setup(t)
  assert.deepEqual(ctx.tools.schemas().map(tool => tool.name), ['html_deck_export'])
  const help = await command()
  assert.equal(help.kind, 'success')
  for (const pattern of [/image-based 16:9 PPTX/, /HTML remains the source/, /Nothing is uploaded automatically/,
    /Network is blocked by default/, /export-report.json/, /export-report.md/, /export-progress.json/, /图片版 PPTX/, /start/, /stop/, /fixed canvas/]) assert.match(help.text, pattern)
  await fork.dispose()
  assert.equal(ctx.commands.find(undefined, 'html-deck-export'), undefined)
  assert.equal(ctx.tools.schemas().length, 0)
})

test('real scoped restrict masks globals; guard denies scoped bypass and requires workbench admission', async t => {
  const { ctx, fork, agent, command, execute } = await setup(t)
  ctx.tools.register(dummy('unrelated_shell'))
  assert.throws(() => ctx.tools.restrict({ allow: ['html_deck_export'] }), /requires a scoped context/)
  const before = await execute(args)
  assert.equal(before.isError, true); assert.match(text(before), /start first/)
  const started = await command('start')
  assert.equal(started.kind, 'success', started.text)
  assert.deepEqual(ctx.tools.schemas(agent).map(tool => tool.name), ['html_deck_export'])
  assert.ok(ctx.tools.get('unrelated_shell'), 'another conversation/global view stays intact')
  agent.ctx.tools.register(dummy('scoped_bypass'))
  assert.ok(ctx.tools.get('scoped_bypass', agent), 'scoped registrations bypass masks in DSH')
  const bypass = await execute({}, { name: 'scoped_bypass' })
  assert.equal(bypass.isError, true); assert.match(text(bypass), /permits only html_deck_export/)
  await command('stop')
  assert.ok(ctx.tools.get('unrelated_shell', agent), 'stop removes restriction')
  assert.equal((await execute({}, { name: 'scoped_bypass' })).isError, false, 'stop removes scoped guard')
  await command('start')
  await fork.dispose()
  assert.ok(ctx.tools.get('unrelated_shell', agent), 'plugin unload removes restriction')
  assert.equal((await execute({}, { name: 'scoped_bypass' })).isError, false)
})

test('tool confines input, output, directory index and linked resources including symlinks', async t => {
  const { root, command, execute } = await setup(t)
  const outside = await mkdtemp(join(tmpdir(), 'html-deck-outside-'))
  t.after(() => rm(outside, { recursive: true, force: true }))
  await writeFile(join(outside, 'outside.js'), 'window.location.hash = "#/1"')
  await writeFile(join(outside, 'outside.css'), '.slide { width:1280px;height:720px }')
  await cp(new URL('./fixtures/export.html', import.meta.url), join(outside, 'outside.html'))
  await symlink(outside, join(root, 'escape'))
  await mkdir(join(root, 'deck'))
  await symlink(join(outside, 'outside.html'), join(root, 'deck/index.html'))
  await command('start')
  for (const changes of [
    { inputPath: '../outside.html' }, { inputPath: join(outside, 'outside.html') },
    { inputPath: 'escape/outside.html' }, { inputPath: 'deck' },
    { exportDirectory: outside }, { exportDirectory: 'escape' },
    { inputPath: 'https://example.com/index.html' }, { inputPath: 'file:///etc/passwd' },
  ]) {
    const result = await execute({ ...args, ...changes })
    assert.equal(result.isError, true); assert.match(text(result), /escapes allowed root|local path/, JSON.stringify(changes))
  }
  const source = await readFile(join(root, 'index.html'), 'utf8')
  for (const link of [
    `<script src="${pathToFileURL(join(outside, 'outside.js')).href}"></script>`,
    '<script src="escape/outside.js"></script>', '<link rel="stylesheet" href="escape/outside.css">',
  ]) {
    await writeFile(join(root, 'linked.html'), source.replace('</head>', link + '</head>'))
    const result = await execute({ ...args, inputPath: 'linked.html' })
    assert.equal(result.isError, true); assert.match(text(result), /escapes allowed root/)
  }
  const unknown = await execute({ ...args, resourceRoot: outside })
  assert.equal(unknown.isError, true); assert.match(text(unknown), /Unsupported export argument/)
})

test('workbench snapshots the effective project root; repeated starts and stop do not leak restrictions', async t => {
  const { root, ctx, agent, command, execute } = await setup(t)
  const current = await mkdtemp(join(tmpdir(), 'html-deck-current-'))
  t.after(() => rm(current, { recursive: true, force: true }))
  let selected = current
  ctx.provide('workingDirectory', { get: () => selected })
  ctx.tools.register(dummy('other'))
  for (const result of await Promise.all([command('start'), command('start')])) {
    assert.equal(result.kind, 'success', result.text); assert.ok(result.text.includes(current))
  }
  selected = root
  const unchanged = await command('start')
  assert.ok(unchanged.text.includes(current), 'root stays fixed until stop/start')
  const escape = await execute({ ...args, inputPath: join(root, 'index.html') })
  assert.equal(escape.isError, true); assert.match(text(escape), /escapes allowed root/)
  await command('stop')
  assert.ok(ctx.tools.get('other', agent), 'both concurrent starts shared one restriction')
  assert.ok((await command('start')).text.includes(root))
})

test('DSH tool exports PPTX/report offline, opt-in reads assets but refuses network write methods', async t => {
  const { root, out, command, execute } = await setup(t)
  const hits = []
  const server = createServer((request, response) => {
    hits.push(request.method)
    response.writeHead(200, { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'text/css' })
    response.end('body { color: black }')
  })
  server.on('upgrade', (_, socket) => { hits.push('WEBSOCKET'); socket.destroy() })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise(resolve => server.close(resolve)))
  const url = `http://127.0.0.1:${server.address().port}/asset`
  const source = await readFile(join(root, 'index.html'), 'utf8')
  await writeFile(join(root, 'index.html'), source.replace('</head>', `<style>h1 { font-family: "Tool Missing Font", "Noto Sans CJK SC" }</style><link rel="stylesheet" href="${url}"><script>fetch('${url}',{method:'POST',body:'forbidden'}).catch(()=>{});fetch('https://example.com/').catch(()=>{})</script></head>`))
  await command('start')
  const offline = await execute(args)
  assert.equal(offline.isError, false, text(offline))
  assert.equal(offline.value.report.networkMode, 'blocked')
  assert.match(text(offline), /导出完成：共 1 页/)
  assert.match(text(offline), /字体回退警告：1 条；失败页：无/)
  assert.match(await readFile(offline.value.markdownReportPath, 'utf8'), /第 1 页字体回退：请求字体「Tool Missing Font」；实际使用「Noto Sans CJK SC」；字体排版可能不同/)
  assert.equal(text(offline), offline.value.summary)
  assert.equal(JSON.parse(await readFile(offline.value.progressPath, 'utf8')).phase, 'done')
  assert.ok(!text(offline).startsWith('{'), 'render the Chinese summary instead of raw JSON')
  assert.ok(offline.value.report.pages.some(page => page.warnings.some(warning => /Blocked resource/.test(warning))))
  assert.equal(hits.length, 0)
  assert.equal((await readFile(offline.value.pptxPath)).subarray(0, 2).toString(), 'PK')
  assert.equal(JSON.parse(await readFile(join(out, 'export-report.json'), 'utf8')).status, 'completed')
  // Keep this opt-in check local; only the blocked attempt references the public internet.
  await writeFile(join(root, 'index.html'), source.replace('</head>', `<link rel="stylesheet" href="${url}"><script>fetch('${url}',{method:'POST',body:'forbidden'}).catch(()=>{});new WebSocket('${url.replace('http:', 'ws:')}')</script></head>`))
  const online = await execute({ ...args, format: 'jpeg', quality: 60, allowNetwork: true })
  assert.equal(online.isError, false, text(online))
  assert.equal(online.value.report.networkMode, 'allowed')
  assert.equal(online.value.report.format, 'jpeg')
  assert.ok(hits.includes('GET')); assert.ok(!hits.includes('POST')); assert.ok(!hits.includes('WEBSOCKET'))
  const good = await readFile(join(out, 'deck.pptx'))
  const traversal = await execute({ ...args, fileName: '../escaped.pptx' })
  assert.equal(traversal.isError, true); assert.match(text(traversal), /plain .pptx filename/)
  await writeFile(join(root, 'broken.html'), source.replace('</body>', '<img src="missing.png"></body>'))
  const failure = await execute({ ...args, inputPath: 'broken.html' })
  assert.equal(failure.isError, true); assert.match(text(failure), /export-report.json/)
  assert.match(text(failure), /第 1 页失败：.*Image not loaded/)
  assert.match(text(failure), /证据截图.*page-1-failed.png/)
  assert.match(text(failure), /export-report.md/)
  assert.deepEqual(await readFile(join(out, 'deck.pptx')), good)
  const report = JSON.parse(await readFile(join(out, 'export-report.json'), 'utf8'))
  assert.equal(report.status, 'failed'); assert.ok(report.failedPages.length > 0)
  await writeFile(join(root, 'handwritten.html'), source.replace("font-family:'Noto Sans CJK SC'", "font-family:'HanziPen SC'"))
  const handwritten = await execute({ ...args, inputPath: 'handwritten.html' })
  assert.equal(handwritten.isError, true)
  assert.match(text(handwritten), /第 1 页失败：缺少王虹必需的手写字体 HanziPen SC，已拒绝导出/)
  assert.deepEqual(await readFile(join(out, 'deck.pptx')), good)
})

test('tool forwards cancellation; stop and agent disposal release policies', async t => {
  const { root, out, command, execute, ctx, agent } = await setup(t)
  await writeFile(join(root, 'slow.html'), '<section class="slide">Wait</section><script>Object.defineProperty(document.fonts,"ready",{get:()=>new Promise(()=>{})})</script>')
  ctx.tools.register(dummy('other'))
  await command('start')
  const controller = new AbortController()
  const pending = execute({ ...args, inputPath: 'slow.html' }, { signal: controller.signal })
  const timer = setTimeout(() => controller.abort(new Error('test cancellation')), 300)
  try { assert.equal((await pending).isError, true) } finally { clearTimeout(timer) }
  assert.equal(JSON.parse(await readFile(join(out, 'export-progress.json'), 'utf8')).phase, 'failed')
  const stopped = execute({ ...args, inputPath: 'slow.html' })
  const stopTimer = setTimeout(() => { void command('stop') }, 300)
  try { assert.equal((await stopped).isError, true) } finally { clearTimeout(stopTimer) }
  assert.equal(JSON.parse(await readFile(join(out, 'export-progress.json'), 'utf8')).phase, 'failed')
  assert.ok(ctx.tools.get('other', agent))
  await command('start')
  ctx.emit('agent/disposed', { agent })
  assert.ok(ctx.tools.get('other', agent))
  assert.equal((await execute(args)).isError, true)
})

test('reports survive simulated package deletion; tool refuses package-directory output', async t => {
  const installParent = await mkdtemp(join(tmpdir(), 'html-deck-install-'))
  t.after(() => rm(installParent, { recursive: true, force: true }))
  const install = join(installParent, 'plugin')
  await mkdir(install)
  for (const file of ['package.json', 'index.js', 'lib']) await cp(join(packageRoot, file), join(install, file), { recursive: true })
  await symlink(join(packageRoot, 'node_modules'), join(install, 'node_modules'))
  const installed = await import(pathToFileURL(join(install, 'index.js')).href)
  const { command, execute } = await setup(t, installed)
  await command('start')
  const result = await execute(args)
  assert.equal(result.isError, false, text(result))
  await rm(install, { recursive: true })
  assert.equal(JSON.parse(await readFile(result.value.reportPath, 'utf8')).status, 'completed')
  assert.equal((await readFile(result.value.pptxPath)).subarray(0, 2).toString(), 'PK')
  const original = await setup(t, plugin, packageRoot)
  await original.command('start')
  const rejected = await original.execute({ inputPath: 'test/fixtures/export.html', exportDirectory: '.' })
  assert.equal(rejected.isError, true); assert.match(text(rejected), /outside the installed plugin package/)
})
