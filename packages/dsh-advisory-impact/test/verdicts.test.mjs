import test from 'node:test'
import assert from 'node:assert/strict'
import { fetchAdvisories, fetchSuppressions } from '../lib/fetchers.js'
import { evaluateProject, parseAffectedRanges } from '../index.js'
import { SOURCES } from '../lib/http.js'
import { AT, fixtureHttp } from './fixture-http.mjs'

const pages = Object.fromEntries(await Promise.all(['kafka', 'hadoop', 'flink'].map(async project => [project, await fetchAdvisories(project, fixtureHttp())])))
const suppressions = await fetchSuppressions(fixtureHttp())
const advisory = (project, id) => {
  const item = pages[project].advisories.find(a => a.id === id)
  assert.ok(item, `Missing recorded advisory: ${id}`)
  return item
}
const evaluate = (item, pins = [], xml) => evaluateProject({ ...pages[item.project], advisories: [item] }, pins, xml).advisories[0]
const verdict = (item, version, component) => evaluate(item, [{ version, ...(component ? { component } : {}) }])

test('recorded Kafka range is inclusive; official fixed releases and numeric ordering retain evidence', () => {
  const item = advisory('kafka', 'CVE-2024-31141')
  for (const version of ['2.3.0', '3.7.0', '3.7.0.0']) {
    // This recorded advisory explicitly targets Kafka Clients; the pin names that component.
    const result = verdict(item, version, 'kafka-clients')
    assert.equal(result.verdict, 'affected', version)
    assert.equal(result.url, item.url)
    assert.equal(result.fetchedAt, AT)
    assert.equal(result.sourceTimestamp, item.sourceTimestamp)
    assert.equal(result.announcedAt, item.announcedAt)
    assert.equal(result.affectedText, item.affectedText)
    assert.equal(result.fixedText, item.fixedText)
    assert.deepEqual(result.products, item.products)
    assert.deepEqual(result.notes, item.notes)
    assert.match(result.notes.join('\n'), /allowlist.pattern/)
  }
  for (const version of ['3.7.1', '3.8.0', '3.10.0', '2.2.9']) assert.equal(verdict(item, version, 'Apache Kafka Clients').verdict, 'not_affected', version)
  assert.deepEqual(evaluate(item).fixedVersions, ['3.7.1', '3.8.0'])
  const core = advisory('kafka', 'CVE-2025-27818')
  assert.equal(verdict(core, '3.9.0').verdict, 'affected')
  assert.equal(verdict(core, '3.9.1').verdict, 'not_affected')
})

test('recorded multi-branch ranges, singleton affected releases, fixed lists and limiting notes', () => {
  const item = advisory('kafka', 'CVE-2026-112375')
  assert.equal(parseAffectedRanges(item).length, 3)
  for (const version of ['3.2.0', '4.1.2', '4.2.0', '4.2.1', '4.3.1']) assert.equal(verdict(item, version).verdict, 'affected', version)
  for (const version of ['4.2.2', '4.3.2', '4.4.0', '4.1.3', '4.2.3', '4.3.3']) assert.equal(verdict(item, version).verdict, 'not_affected', version)
  for (const version of ['4.4.1', '5.0.0']) assert.equal(verdict(item, version).verdict, 'unknown', version)
  assert.match(verdict(item, '4.2.1').notes.join('\n'), /Clusters with no authorizer configured are not affected in practice/)
  const singleton = advisory('kafka', 'CVE-2026-110985')
  assert.equal(verdict(singleton, '4.3.0').verdict, 'affected')
  assert.equal(verdict(singleton, '4.3.1').verdict, 'not_affected')
  const older = advisory('kafka', 'CVE-2022-34917')
  assert.equal(verdict(older, '2.8.1').verdict, 'affected')
  assert.equal(verdict(older, '2.8.2').verdict, 'not_affected')
  assert.equal(verdict(older, '2.8.3').verdict, 'not_affected')
  assert.equal(verdict(older, '2.9.0').verdict, 'unknown')
  const later = advisory('kafka', 'CVE-2019-12399')
  assert.equal(verdict(later, '2.3.0', 'Kafka Connect').verdict, 'affected')
  assert.equal(verdict(later, '3.0.0', 'Kafka Connect').verdict, 'not_affected', 'official fixed wording explicitly says and later')
})

test('recorded Hadoop to-ranges and Flink before/at-ranges honour exact boundaries', () => {
  const hadoop = advisory('hadoop', 'CVE-2023-26031')
  assert.equal(verdict(hadoop, '3.3.1').verdict, 'affected')
  assert.equal(verdict(hadoop, '3.3.4').verdict, 'affected')
  assert.equal(verdict(hadoop, '3.3.5').verdict, 'not_affected')
  const operator = advisory('flink', 'CVE-2026-40564')
  assert.equal(verdict(operator, '1.3.0', 'Apache Flink Kubernetes Operator').verdict, 'affected')
  assert.equal(verdict(operator, '1.14.9', 'Apache Flink Kubernetes Operator').verdict, 'affected')
  assert.equal(verdict(operator, '1.15.0', 'Apache Flink Kubernetes Operator').verdict, 'not_affected')
  assert.equal(parseAffectedRanges(operator)[0].upperInclusive, false)
  const flink = advisory('flink', 'CVE-2020-17519')
  assert.equal(verdict(flink, '1.11.2').verdict, 'affected')
  assert.equal(verdict(flink, '1.11.3').verdict, 'not_affected')
  assert.equal(verdict(flink, '1.12.0').verdict, 'not_affected')
})

test('equivalent grammar variants of a recorded range parse completely; malformed tails never become partial ranges', () => {
  const item = advisory('kafka', 'CVE-2024-31141')
  // Parser-only mutations of the recorded wording; these are not additional official claims.
  for (const affectedText of ['from 2.3.0 to 3.7.0', '2.3.0 to 3.7.0', '2.3.0 through 3.7.0', '2.3.0-3.7.0']) {
    const variant = { ...item, affectedText }
    assert.equal(verdict(variant, '3.7.0', 'kafka-clients').verdict, 'affected', affectedText)
  }
  const exclusive = { ...item, affectedText: 'from 2.3.0 before 3.7.0' }
  assert.equal(verdict(exclusive, '3.7.0', 'kafka-clients').verdict, 'not_affected')
  for (const affectedText of ['2.3.0 - 3.7.0, maybe other versions', '3.7.0 to 2.3.0', 'from 3.7.0 before 3.7.0', '2.3.0 - 3.7.0-RC1', '2.3.0 - 3.7.0 except some builds', '']) {
    const result = verdict({ ...item, affectedText }, '3.7.0', 'kafka-clients')
    assert.equal(result.verdict, 'unknown', affectedText)
    assert.equal(result.ranges, null)
  }
})

test('missing pins retain every official advisory as unknown with the required reason', () => {
  for (const page of Object.values(pages)) {
    const result = evaluateProject(page)
    assert.equal(result.advisories.length, page.advisories.length)
    assert.deepEqual(result.notices, page.notices)
    for (const item of result.advisories) {
      assert.equal(item.verdict, 'unknown')
      assert.equal(item.reason, '未填写运行版本，无法判断')
      assert.equal(item.fetchedAt, AT)
      assert.ok(item.url.startsWith(SOURCES[page.project] + '#'))
    }
  }
  assert.equal(verdict(advisory('kafka', 'CVE-2025-27818'), ' ').reason, '未填写运行版本，无法判断')
})

test('ambiguous pins, recorded unparseable ranges and different components stay visible as unknown', () => {
  const core = advisory('kafka', 'CVE-2025-27818')
  for (const version of ['3.7.0-RC1', '3.7.0-SNAPSHOT', '3.7.0rc1', 'latest', '3.7.x', '>=3.7.0']) {
    const result = verdict(core, version)
    assert.equal(result.verdict, 'unknown', version)
    assert.match(result.reason, /预发布.*点分数字/)
  }
  for (const [project, id] of [['kafka', 'CVE-2022-23302'], ['hadoop', 'CVE-2022-26612'], ['hadoop', 'CVE-2022-25168'], ['flink', 'CVE-2026-35194']]) {
    const result = verdict(advisory(project, id), '3.3.1')
    assert.equal(result.verdict, 'unknown')
    assert.equal(result.ranges, null)
    assert.match(result.reason, /范围无法完整解析/)
  }
  const ambiguousFix = verdict(advisory('kafka', 'CVE-2026-41115'), '4.1.0')
  assert.equal(ambiguousFix.verdict, 'unknown')
  assert.match(ambiguousFix.reason, /修复版本表述无法明确解析/)
  const operator = verdict(advisory('flink', 'CVE-2026-40564'), '1.14.0')
  assert.equal(operator.verdict, 'unknown')
  assert.match(operator.reason, /组件\/产品.*不匹配/)
  assert.equal(operator.products[0], 'Apache Flink Kubernetes Operator')
  assert.equal(verdict(advisory('kafka', 'CVE-2024-31141'), '3.7.0', 'kafka-streams').verdict, 'unknown')
  assert.equal(verdict(advisory('hadoop', 'CVE-2025-27821'), '3.4.1').verdict, 'unknown')
})

test('explicit component and Maven pins are matched conservatively, without overriding conflicts', () => {
  const clients = advisory('kafka', 'CVE-2026-35554')
  assert.equal(evaluate(clients, [{ version: '4.1.1', maven: 'org.apache.kafka:kafka-clients' }]).verdict, 'affected')
  assert.equal(evaluate(clients, [{ version: '4.1.2', maven: 'org.apache.kafka:kafka-clients' }]).verdict, 'not_affected')
  for (const pin of [
    { version: '4.1.1', maven: 'other.group:kafka-clients' },
    { version: '4.1.1', maven: 'org.apache.kafka:kafka-clients@4.1.1' },
    { version: '4.1.1', component: 'Kafka Streams', maven: 'org.apache.kafka:kafka-clients' },
  ]) assert.equal(evaluate(clients, [pin]).verdict, 'unknown')
  const connect = advisory('kafka', 'CVE-2023-25194')
  assert.equal(evaluate(connect, [{ version: '3.3.2', maven: 'org.apache.kafka:connect-runtime' }]).verdict, 'affected')
  assert.equal(evaluate(connect, [{ version: '3.4.0', component: 'Kafka Connect' }]).verdict, 'not_affected')
})

test('multiple pins preserve per-pin outcomes and aggregate affected before unknown before not affected', () => {
  const item = advisory('kafka', 'CVE-2025-27818')
  let result = evaluate(item, [{ version: '3.9.1' }, { version: '3.9.0' }, { version: '3.9.0-RC1' }])
  assert.equal(result.verdict, 'affected')
  assert.deepEqual(result.pins.map(r => r.verdict), ['not_affected', 'affected', 'unknown'])
  result = evaluate(item, [{ version: '3.9.1' }, { version: '3.9.0-RC1' }])
  assert.equal(result.verdict, 'unknown')
  assert.equal(evaluate(item, [{ version: '3.9.1' }, { version: '4.0.0' }]).verdict, 'not_affected')
})

test('official Kafka suppressions form a separate sourced section, with no invented Hadoop/Flink section', () => {
  const result = evaluateProject(pages.kafka, [{ version: '3.7.0' }], suppressions)
  assert.equal(result.suppressions.title, '扫描器报了，但官方说明不适用')
  assert.equal(result.suppressions.project, 'kafka')
  assert.equal(result.suppressions.guidanceUrl, SOURCES.guidance)
  assert.equal(result.suppressions.url, SOURCES.suppressions)
  assert.equal(result.suppressions.fetchedAt, AT)
  assert.deepEqual(result.suppressions.suppressions, suppressions.suppressions)
  for (const suppression of result.suppressions.suppressions) {
    assert.ok(suppression.notes)
    assert.equal(suppression.url, SOURCES.suppressions)
    assert.equal(suppression.fetchedAt, AT)
    assert.ok(!('verdict' in suppression))
    assert.ok(!result.advisories.some(a => a.id === suppression.id))
  }
  assert.equal(evaluateProject(pages.kafka).suppressions, null, 'unavailable file is not an empty official list')
  for (const project of ['hadoop', 'flink']) assert.equal(evaluateProject(pages[project], [], suppressions).suppressions, null)
})

test('a suppression/advisory collision keeps both facts visible and cannot emit affected, even per pin', () => {
  const base = advisory('kafka', 'CVE-2025-27818')
  // Deliberate collision using the recorded suppression ids; no claim that these appear in the real inventory.
  for (const suppression of suppressions.suppressions) {
    const item = { ...base, id: suppression.id }
    const result = evaluate(item, [{ version: '3.9.0' }, { version: '3.9.1' }], suppressions)
    assert.equal(result.verdict, 'unknown')
    assert.deepEqual(result.suppressions, [suppression])
    assert.equal(result.url, base.url)
    assert.deepEqual(result.notes, base.notes)
    for (const pin of result.pins) {
      assert.equal(pin.verdict, 'unknown')
      assert.match(pin.reason, /官方 suppression/)
    }
  }
})

test('same recorded inputs yield deterministic evidence-rich results without mutating inputs or exposing HTML', () => {
  const pins = [{ version: '3.7.0', component: 'kafka-clients' }]
  const before = structuredClone({ pages, pins, suppressions })
  for (const page of Object.values(pages)) {
    const first = evaluateProject(page, pins, suppressions)
    assert.deepEqual(first, evaluateProject(page, pins, suppressions))
    assert.ok(!JSON.stringify(first).includes('<html'))
  }
  assert.deepEqual({ pages, pins, suppressions }, before)
})
