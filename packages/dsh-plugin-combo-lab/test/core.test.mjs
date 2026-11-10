import test from 'node:test'
import assert from 'node:assert/strict'
import { createPlan, parseStudy, record, status, reduce, compare, renderStudy, observationTemplate, selectChecks, checkTemplates, TEMPLATE_VERSION } from '../lib/core.js'
import { ID, now, planInput, study, observe, add, isolatedFailure } from './fixtures.mjs'

test('固定两插件、三类交互、50 步及正反启用顺序；默认全待桌面验证', () => {
  const s = study()
  assert.equal(s.plan.steps.length, 50)
  assert.equal(new Set(s.plan.steps.map(x => x.id)).size, 50)
  assert.deepEqual([...new Set(s.plan.checks.map(x => x.surface))].sort(), ['input', 'session-menu', 'sidebar'])
  assert.deepEqual(s.plan.runs.map(x => x.enabled.length), [0, 1, 1, 2, 2])
  assert.deepEqual(s.plan.runs[3].enabled, [...s.plan.runs[4].enabled].reverse())
  for (const step of s.plan.steps) assert.equal(status(s, step.id), 'pending-desktop')
})

for (const [name, value] of [
  ['一个插件', { plugins: [planInput.plugins[0]] }],
  ['三个插件', { plugins: [...planInput.plugins, { name: 'extra', version: '1.0.0' }] }],
  ['重复包名', { plugins: [planInput.plugins[0], planInput.plugins[0]] }],
  ['版本范围', { plugins: [{ name: 'p', version: '^1.0.0' }, planInput.plugins[0]] }],
  ['版本 tag', { plugins: [{ name: 'p', version: 'latest' }, planInput.plugins[0]] }],
  ['非法 semver 前导零', { plugins: [{ name: 'p', version: '1.0.0-01' }, planInput.plugins[0]] }],
  ['git spec', { plugins: [{ name: 'github:user/repo', version: '1.0.0' }, planInput.plugins[0]] }],
  ['非 Windows', { environment: { ...planInput.environment, platform: 'linux' } }],
  ['普通 Web', { environment: { ...planInput.environment, client: 'web' } }],
  ['空配置基线', { configBaseline: '' }]
]) test('拒绝无效计划：' + name, () => assert.throws(() => study(value)))

test('选择顺序归一化；输入对象后续修改不影响计划', () => {
  const value = structuredClone(planInput), s = createPlan(value, ID, now)
  value.plugins[0].version = '9.0.0'
  assert.deepEqual(s, study({ plugins: [...planInput.plugins].reverse() }))
})
test('拒绝路径型 ID、无效日期和未知步骤', () => {
  assert.throws(() => createPlan(planInput, '../escape', now))
  assert.throws(() => createPlan(planInput, ID, '2026-02-30T00:00:00.000Z'))
  assert.throws(() => status(study(), 'missing'))
  assert.throws(() => observationTemplate(study(), 'missing', now))
})
test('headless/static 即使 pass 也永远不能算桌面通过或最小组合', () => {
  for (const source of ['headless', 'static']) {
    let s = study()
    for (const run of ['baseline', 'a', 'b']) s = add(s, run, 'pass', 'input.commands', { source })
    s = add(s, 'ab', 'fail')
    assert.equal(status(s, 'a:input.commands'), 'non-desktop-only')
    assert.equal(reduce(s, 'input.commands').verdict, 'needs-controls')
  }
})
test('待验证、受阻、不适用不会通过；模板默认受阻', () => {
  const s = study(), o = observationTemplate(s, 'a:input.commands', now)
  assert.equal(o.outcome, 'blocked')
  assert.equal(status(record(s, o), o.stepId), 'blocked')
  assert.equal(status(record(s, { ...o, outcome: 'unsupported' }), o.stepId), 'unable-to-automate')
})
test('桌面来源必须核对环境、目标精确版本和顺序', () => {
  const s = study(), o = observe(s, 'ab:input.commands')
  assert.throws(() => record(s, { ...o, environment: undefined }))
  assert.throws(() => record(s, { ...o, environment: { ...o.environment, machine: 'elsewhere' } }))
  assert.throws(() => record(s, { ...o, enabled: [...o.enabled].reverse() }))
  assert.throws(() => record(s, { ...o, enabled: [{ ...o.enabled[0], version: '8.0.0' }, o.enabled[1]] }))
})
test('拒绝伪造来源、空证据、空记录人、错误时间和历史倒序', () => {
  const s = study(), o = observe(s, 'a:input.commands')
  for (const patch of [{ source: 'desktop-auto' }, { outcome: 'ok' }, { evidence: '' }, { observer: '' }, { stepId: 'unknown' }, { observedAt: '2020-01-01T00:00:00.000Z' }]) {
    assert.throws(() => record(s, { ...o, ...patch }))
  }
  const first = record(s, { ...o, observedAt: '2026-11-10T04:01:00.000Z' })
  assert.throws(() => record(first, o))
})
test('持久化 pass/fail 要求完全退出与前后实际值；不一致不能判 pass', () => {
  const s = study(), o = observe(s, 'ab:sidebar.persistence')
  assert.throws(() => record(s, o))
  assert.throws(() => record(s, { ...o, restart: { before: 'x=1', after: 'x=1', fullyExited: false } }))
  assert.throws(() => record(s, { ...o, restart: { before: 'x=1', after: 'x=2', fullyExited: true } }))
  assert.throws(() => record(s, { ...o, outcome: 'fail', restart: { before: 'x=1', after: 'x=1', fullyExited: true } }))
  assert.equal(status(record(s, { ...o, restart: { before: 'x=1', after: 'x=1', fullyExited: true } }), o.stepId), 'desktop-pass')
  assert.equal(status(record(s, { ...o, outcome: 'fail', restart: { before: 'x=1', after: 'missing', fullyExited: true } }), o.stepId), 'desktop-fail')
})
test('证据追加保留历史、最后记录决定状态，旧对象不被修改', () => {
  const original = study(), first = add(original, 'a'), second = add(first, 'a', 'fail')
  assert.equal(original.observations.length, 0)
  assert.equal(first.observations.length, 1)
  assert.equal(second.observations.length, 2)
  assert.equal(status(second, 'a:input.commands'), 'desktop-fail')
})
test('逐步缩小：先补空白，再 A、B 单独，最终确认最小双插件', () => {
  let s = add(study(), 'ab', 'fail')
  assert.deepEqual(reduce(s, 'input.commands').next, ['baseline:input.commands', 'a:input.commands', 'b:input.commands'])
  assert.equal(reduce(s, 'input.commands').minimal, null)
  s = add(s, 'baseline'); s = add(s, 'a')
  assert.deepEqual(reduce(s, 'input.commands').next, ['b:input.commands'])
  s = add(s, 'b')
  const result = reduce(s, 'input.commands')
  assert.equal(result.verdict, 'minimal-pair')
  assert.deepEqual(result.minimal, s.plan.plugins)
  assert.ok(result.reproduction.some(x => x.includes('1.0.0')))
})
test('空白对照失败优先于组合归因', () => {
  const s = add(isolatedFailure(), 'baseline', 'fail')
  assert.equal(reduce(s, 'input.commands').verdict, 'environment-failure')
  assert.deepEqual(reduce(s, 'input.commands').minimal, [])
})
test('单插件已失败时缩小至单插件，不误报组合特有问题', () => {
  for (const run of ['a', 'b']) {
    const s = add(isolatedFailure(), run, 'fail')
    const result = reduce(s, 'input.commands')
    assert.equal(result.verdict, 'single-failure')
    assert.deepEqual(result.minimal, s.plan.runs.find(x => x.id === run).enabled)
  }
})
test('反向启用顺序独立判断；通过的一项不能掩盖另一顺序失败', () => {
  const s = add(isolatedFailure('sidebar.panel', 'ba'), 'ab', 'pass', 'sidebar.panel')
  assert.equal(reduce(s, 'sidebar.panel', 'ab').verdict, 'pair-passes')
  assert.equal(reduce(s, 'sidebar.panel', 'ba').verdict, 'minimal-pair')
})
test('工具/命令、快捷键、面板和配置检查均有独立最小组合结果', () => {
  for (const check of study().plan.checks) {
    let s = study()
    const patch = check.kind === 'persistence' ? { restart: { before: 'key=1', after: 'key=1', fullyExited: true } } : {}
    for (const run of ['baseline', 'a', 'b']) s = add(s, run, 'pass', check.id, patch)
    s = add(s, 'ab', 'fail', check.id, check.kind === 'persistence' ? { restart: { before: 'key=1', after: 'missing', fullyExited: true } } : {})
    assert.equal(reduce(s, check.id).verdict, 'minimal-pair')
  }
})
test('升级前后逐步对比 regression/fixed/unchanged 与未验证', () => {
  let before = add(study(), 'a'), after = add(study({ plugins: planInput.plugins.map(p => ({ ...p, version: '3.0.0' })) }), 'a', 'fail')
  before = add(before, 'b', 'fail'); after = add(after, 'b')
  before = add(before, 'ab'); after = add(after, 'ab')
  const result = compare(before, after)
  assert.equal(result.comparable, true)
  const change = step => result.rows.find(x => x.stepId === step + ':input.commands').change
  assert.equal(change('a'), 'regression'); assert.equal(change('b'), 'fixed'); assert.equal(change('ab'), 'unchanged'); assert.equal(change('ba'), 'inconclusive')
  assert.notDeepEqual(result.versions.before, result.versions.after)
})
test('headless 升级结果不能给出 fixed 或 regression', () => {
  const result = compare(add(study(), 'a', 'fail'), add(study(), 'a', 'pass', 'input.commands', { source: 'headless' }))
  assert.equal(result.rows.find(x => x.stepId === 'a:input.commands').change, 'inconclusive')
})
for (const [name, overrides] of [
  ['桌面版本', { environment: { ...planInput.environment, version: '0.2.1' } }],
  ['机器', { environment: { ...planInput.environment, machine: 'OTHER' } }],
  ['配置', { configBaseline: 'other' }],
  ['工作区', { workspace: 'other' }],
  ['插件集合', { plugins: [{ name: 'other', version: '1.0.0' }, planInput.plugins[0]] }]
]) test('对比条件变化只报告不确定：' + name, () => {
  const result = compare(add(study(), 'a'), add(study(overrides), 'a', 'fail'))
  assert.equal(result.comparable, false)
  assert.ok(result.rows.every(x => x.change === 'inconclusive'))
})
test('存档重建校验，拒绝改写派生计划或损坏证据', () => {
  const s = isolatedFailure()
  assert.deepEqual(parseStudy(JSON.parse(JSON.stringify(s))), s)
  for (const mutate of [
    x => { x.plan.steps.pop() }, x => { x.plan.checks[0].instructions = 'forged' },
    x => { x.observations[0].source = 'desktop-auto' }, x => { x.schemaVersion = 2 }
  ]) {
    const invalid = structuredClone(s); mutate(invalid); assert.throws(() => parseStudy(invalid))
  }
})
test('报告包含动作、明确证据来源、版本与复现清单，不伪称自动验证', () => {
  const output = renderStudy(isolatedFailure())
  for (const phrase of ['50 步', '人工证据', '未自动检测', '最小清单', '完全退出', '待桌面验证', '精确版本']) assert.ok(output.includes(phrase), phrase)
})

test('检查模板子集与存档兼容：无 templateId 的计划与旧版 50 步 JSON 一致', () => {
  const full = study()
  assert.equal('template' in full.plan, false)
  assert.deepEqual(parseStudy(JSON.parse(JSON.stringify(full))), full)
  const inputOnly = study({ templateId: 'input' })
  assert.equal(inputOnly.plan.template.id, 'input')
  assert.equal(inputOnly.plan.template.version, TEMPLATE_VERSION)
  assert.equal(inputOnly.plan.steps.length, 20)
  assert.ok(inputOnly.plan.checks.every(c => c.surface === 'input'))
  assert.deepEqual(parseStudy(JSON.parse(JSON.stringify(inputOnly))), inputOnly)
  const comparison = compare(full, inputOnly)
  assert.equal(comparison.comparable, false)
  assert.ok(comparison.reasons.some(r => r.includes('检查模板')))
  assert.equal(selectChecks('commands').checks.length, 2)
  assert.equal(checkTemplates.some(t => t.id === 'tools-and-panels'), true)
  assert.throws(() => study({ templateId: 'missing-template' }), /未知检查模板/)
})
