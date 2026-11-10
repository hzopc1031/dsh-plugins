import { createPlan, observationTemplate, record } from '../lib/core.js'
export const ID = '11111111-1111-4111-8111-111111111111'
export const now = '2026-11-10T04:00:00.000Z'
export const planInput = {
  plugins: [{ name: 'dsh-fixture-a', version: '1.0.0' }, { name: '@fixture/b', version: '2.0.0-rc.1' }],
  environment: { platform: 'win32', client: 'official-desktop', version: '0.2.1-rc.5', machine: 'DESKTOP-NTRMANG' },
  workspace: 'fixture-workspace', configBaseline: 'fixture-baseline-v1'
}
export function study(overrides = {}) { return createPlan({ ...structuredClone(planInput), ...overrides }, ID, now) }
export function observe(s, stepId, outcome = 'pass', overrides = {}) {
  return { ...observationTemplate(s, stepId, now), outcome, evidence: '人工执行所述动作，核对归属与结果；测试夹具', observer: 'fixture', ...overrides }
}
export function add(s, run, outcome = 'pass', check = 'input.commands', overrides = {}) { return record(s, observe(s, run + ':' + check, outcome, overrides)) }
export function isolatedFailure(check = 'input.commands', order = 'ab') {
  let s = study()
  for (const run of ['baseline', 'a', 'b']) s = add(s, run, 'pass', check)
  return add(s, order, 'fail', check)
}