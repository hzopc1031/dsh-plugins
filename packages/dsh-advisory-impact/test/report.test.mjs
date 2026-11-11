import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir, symlink } from 'node:fs/promises'
import path from 'node:path'
import { AdvisoryService, evaluatePins, createViewModel, renderReport, saveReport, openReport, REPORT_FILE, displayTime } from '../index.js'
import { SOURCES } from '../lib/http.js'
import { AT } from './fixture-http.mjs'
import { setup, config } from './surface-fixtures.mjs'

test('Chinese Markdown and shared view model preserve every official verdict with evidence and distinct OSV/suppression groups', async t => {
  const s = await setup(t)
  const evaluation = await evaluatePins({ ...s, config })
  const view = createViewModel(evaluation)
  const markdown = renderReport(view)
  assert.equal(displayTime(AT), '2026-11-11 16:00:00 UTC+8')
  assert.deepEqual(createViewModel(evaluation), view)
  assert.equal(renderReport(createViewModel(evaluation)), markdown)
  assert.deepEqual(markdown.split('\n').filter(l => l.startsWith('## ')), [
    '## 来源状态', '## kafka', '## 扫描器报了，但官方说明不适用', '## 仅见 OSV，未见官方公告', '## 官方与 OSV 分歧',
  ])
  for (const a of evaluation.projects[0].verdicts.advisories) {
    const section = markdown.split(`### ${a.id} · `)[1].split('\n### ')[0]
    assert.ok(section.includes(a.url))
    assert.ok(section.includes('2026-11-11 16:00:00 UTC+8'))
    if (a.affectedText) assert.ok(section.includes(a.affectedText))
    if (a.fixedText) assert.ok(section.includes(a.fixedText))
    assert.ok(section.includes('官方受影响版本（原文）'))
    assert.ok(section.includes('官方修复版本（原文）'))
  }
  assert.match(markdown, /CVE-2024-31141 · 受影响/)
  assert.match(markdown, /OSV 未收录 \/ HTTP 404/)
  assert.match(markdown, /官方判定保持不变/)
  assert.ok(markdown.includes(SOURCES.guidance))
  const suppressionSection = markdown.split('## 扫描器报了，但官方说明不适用')[1].split('## 仅见 OSV')[0]
  for (const item of evaluation.suppressions.data.suppressions) {
    assert.ok(suppressionSection.includes(item.id))
    assert.ok(suppressionSection.includes(item.url))
    assert.ok(!view.projects[0].advisories.some(a => a.id === item.id && a.verdict === 'affected'))
  }
  const onlySection = markdown.split('## 仅见 OSV，未见官方公告')[1].split('## 官方与 OSV')[0]
  assert.equal(view.projects[0].osvOnly.items.length, 2)
  for (const item of view.projects[0].osvOnly.items) {
    assert.ok(onlySection.includes(item.id))
    assert.ok(onlySection.includes(item.url))
    assert.ok(!('verdict' in item))
  }
  assert.equal(view.counts.affected + view.counts.not_affected + view.counts.unknown, view.projects[0].advisories.length)
  assert.equal(view.counts.suppressions, view.suppressions.items.length)
  const serialized = JSON.stringify(view)
  for (const forbidden of ['"payload"', '"record"', '<html', '"affected":[' ]) assert.ok(!serialized.includes(forbidden), forbidden)
})

test('report exposes stale failures and unavailable inventories without inventing an empty list', async t => {
  const s = await setup(t)
  await evaluatePins({ ...s, config })
  s.failAll()
  const stale = renderReport(createViewModel(await evaluatePins({ ...s, config, force: true })))
  assert.match(stale, /抓取失败，使用最后成功缓存（已陈旧）/)
  assert.match(stale, /fixture source unavailable/)
  assert.match(stale, /2026-11-11 16:00:00 UTC\+8/)
  const failed = renderReport(createViewModel(await evaluatePins({ ...s, config: { watch: ['hadoop'] } })))
  assert.match(failed, /来源失败，无可用缓存/)
  assert.match(failed, /官方清单不可用，无法判断；不能当作 0 条公告/)
  assert.ok(!failed.includes('### CVE-'))
  const noPin = renderReport(createViewModel(await evaluatePins({ ...s, config: { watch: ['kafka'] } })))
  assert.match(noPin, /未填写运行版本，无法判断/)
})

test('Flink report always labels experimental coverage and separately cites the project pointer', async t => {
  const s = await setup(t)
  const markdown = renderReport(createViewModel(await evaluatePins({ ...s, config: { watch: ['flink'] } })))
  assert.match(markdown, /实验性.*2023.*滞后/)
  assert.ok(markdown.includes(SOURCES.flinkPointer))
  assert.ok(markdown.includes(SOURCES.flink))
})

test('report escaping preserves untrusted literal text without HTML or Markdown injection', async t => {
  const s = await setup(t)
  const view = createViewModel(await evaluatePins({ ...s, config }))
  view.settings.pins[0].version = '<script>x</script>\n# injected [link](javascript:alert(1))'
  const markdown = renderReport(view)
  assert.ok(!markdown.includes('<script>'))
  assert.match(markdown, /&lt;script&gt;/)
  assert.ok(!markdown.includes('\n# injected'))
  assert.ok(markdown.includes('\\[link\\]'))
})

test('fixed report writes and reads reject dot-dot, directory and file symlink escapes', async t => {
  const s = await setup(t)
  const project = path.join(s.root, 'project'), outside = path.join(s.root, 'outside')
  await mkdir(project); await mkdir(outside)
  const file = path.join(outside, REPORT_FILE)
  await writeFile(file, 'preserve outside')
  await symlink(outside, path.join(project, 'escape'))
  await symlink(file, path.join(project, REPORT_FILE))
  for (const dir of [path.join(project, 'escape'), `${project}/../outside`, 'relative-project']) {
    await assert.rejects(saveReport(dir, 'blocked'))
    await assert.rejects(openReport(dir))
  }
  await assert.rejects(saveReport(project, 'blocked'), /符号链接/)
  await assert.rejects(openReport(project))
  assert.equal(await readFile(file, 'utf8'), 'preserve outside')
  assert.equal(await saveReport(s.root, '# 报告\n'), path.join(s.root, REPORT_FILE))
  assert.deepEqual(await openReport(s.root), { path: path.join(s.root, REPORT_FILE), markdown: '# 报告\n' })
})

test('service pin/watch/report/open/lookup share fixture evaluation and serialize concurrent settings edits', async t => {
  const s = await setup(t)
  const service = new AdvisoryService({ ...s, config })
  const run = (action, args = {}) => service.execute(s.root, action, args, new AbortController().signal)
  const initial = await run('pin')
  assert.equal(initial.summary.saved, false)
  await Promise.all([run('pin', { project: 'kafka', version: '3.7.1', component: 'kafka-clients' }), run('watch', { watch: ['kafka', 'my-project'] })])
  const settings = (await run('pin')).summary
  assert.equal(settings.pins[0].version, '3.7.1')
  assert.deepEqual(settings.watch, ['kafka', 'my-project'])
  const lookup = (await run('lookup', { id: 'cve-2024-31141' })).summary
  assert.equal(lookup.official[0].verdict, 'not_affected')
  assert.equal(lookup.official[0].url, SOURCES.kafka + '#CVE-2024-31141')
  assert.equal(lookup.official[0].fetchedAt, AT)
  assert.equal(lookup.osv.status, 'found')
  const absentOsv = (await run('lookup', { id: 'CVE-2026-112375' })).summary
  assert.equal(absentOsv.osv.status, 'not_indexed')
  const suppression = (await run('lookup', { id: 'CVE-2023-35116' })).summary
  assert.equal(suppression.verdict, 'unknown')
  assert.equal(suppression.suppressions[0].id, 'CVE-2023-35116')
  assert.equal(suppression.suppressions[0].url, SOURCES.suppressions)
  const missing = (await run('lookup', { id: 'CVE-1900-99999999' })).summary
  assert.equal(missing.verdict, 'unknown')
  assert.equal(missing.official.length, 0)
  assert.equal(missing.osv.status, 'unavailable')
  await assert.rejects(run('lookup', { id: '../escape' }), /有效 CVE/)
  const report = await run('report')
  assert.match(report.text, /^# 官方公告影响核对/)
  const saved = await run('report', { save: true })
  const opened = await run('open')
  assert.equal(saved.summary.path, path.join(s.root, REPORT_FILE))
  assert.equal(opened.text, saved.summary.path + '\n\n' + report.text)
  assert.ok(opened.summary.bytes > 0)
  assert.ok(!('markdown' in opened.summary))
  await run('pin', { project: 'kafka', remove: true })
  assert.deepEqual((await run('pin')).summary.pins, [])
  s.failAll()
  const refreshed = await run('refresh')
  assert.equal(refreshed.summary.projects[0].source.state, 'stale')
  assert.match(refreshed.text, /fixture source unavailable/)
})

test('pre-cancelled actions do not write or fetch', async t => {
  const s = await setup(t)
  const service = new AdvisoryService(s)
  const controller = new AbortController(); controller.abort()
  await assert.rejects(service.execute(s.root, 'report', { save: true }, controller.signal), /abort/i)
  await assert.rejects(service.execute(s.root, 'pin', { project: 'kafka', version: '3.7.0' }, controller.signal), /abort/i)
  assert.equal(s.calls.length, 0)
  await assert.rejects(openReport(s.root), /ENOENT/)
})

test('cancellation between source reads stops the pipeline and prevents report saving', async t => {
  const s = await setup(t)
  const controller = new AbortController()
  const cache = { async load(...args) {
    const result = await s.cache.load(...args)
    controller.abort()
    return result
  } }
  const service = new AdvisoryService({ ...s, cache, config })
  await assert.rejects(service.execute(s.root, 'report', { save: true }, controller.signal), /abort/i)
  assert.deepEqual(s.calls, [SOURCES.suppressions])
  await assert.rejects(openReport(s.root), /ENOENT/)
})

test('an OSV-only CVE lookup remains unknown; shared view models cover all three semantic verdict states', async t => {
  const s = await setup(t)
  const evaluation = await evaluatePins({ ...s, config })
  const id = evaluation.projects[0].osvOnly.items.flatMap(i => i.record.aliases).find(id => id.startsWith('CVE-'))
  assert.ok(id)
  const service = new AdvisoryService({ ...s, config })
  const result = await service.execute(s.root, 'lookup', { id }, new AbortController().signal)
  assert.equal(result.summary.verdict, 'unknown')
  assert.deepEqual(result.summary.official, [])
  assert.ok(result.summary.osvOnly.length)
  const find = view => view.projects[0].advisories.find(a => a.id === 'CVE-2024-31141')
  const affected = find(createViewModel(evaluation))
  const fixed = find(createViewModel(await evaluatePins({ ...s, config: { watch: ['kafka'], pins: [{ project: 'kafka', version: '3.7.1', component: 'kafka-clients' }] } })))
  const missing = find(createViewModel(await evaluatePins({ ...s, config: { watch: ['kafka'] } })))
  assert.deepEqual([affected.label, fixed.label, missing.label], ['受影响', '不受影响', '无法判断'])
  for (const item of [affected, fixed, missing]) {
    assert.equal(item.url, SOURCES.kafka + '#CVE-2024-31141')
    assert.equal(item.fetchedTime, '2026-11-11 16:00:00 UTC+8')
  }
})
