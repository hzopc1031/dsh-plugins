import test from 'node:test'
import assert from 'node:assert/strict'
import { SOURCES, SourceError } from '../lib/http.js'
import {
  fetchAdvisories, fetchSuppressions, fetchFlinkPointer, fetchDependencyGuidance,
  parseAdvisories, parseSuppressions,
} from '../lib/fetchers.js'
import { AT, document, fixtureHttp, manifest } from './fixture-http.mjs'

test('recorded sources retain provenance and hashes; every inventory item has official URL and injected time', async () => {
  assert.equal(manifest.length, 6)
  for (const entry of manifest) {
    assert.ok(Number.isFinite(Date.parse(entry.originalFetchTime)))
    assert.match(entry.timeBasis, /mtime/)
    await document(entry.url)
  }
  for (const project of ['kafka', 'hadoop', 'flink']) {
    const page = await fetchAdvisories(project, fixtureHttp())
    assert.equal(page.url, SOURCES[project])
    assert.ok(page.advisories.length > 0)
    assert.equal(new Set(page.advisories.map(item => item.id)).size, page.advisories.length)
    for (const item of page.advisories) {
      assert.equal(item.project, project)
      assert.equal(item.fetchedAt, AT)
      assert.ok(item.url.startsWith(SOURCES[project] + '#'))
      assert.match(item.id, /^CVE-\d{4}-\d{4,}$/)
      assert.ok(item.title && item.affectedText && item.products.length)
      assert.ok(!('verdict' in item), 'fetchers do not invent verdicts')
      assert.ok(!('payload' in item), 'normalised items do not contain raw HTML')
    }
  }
})

test('Kafka preserves range boundaries, fixed lists, page timestamp, component and limiting language', async () => {
  const page = await fetchAdvisories('kafka', fixtureHttp())
  const item = page.advisories.find(item => item.id === 'CVE-2024-31141')
  assert.equal(item.affectedText, '2.3.0 - 3.7.0')
  assert.equal(item.fixedText, '3.7.1, 3.8.0')
  assert.equal(item.url, SOURCES.kafka + '#CVE-2024-31141')
  assert.equal(item.sourceTimestamp, '2026-11-08T22:10:19+05:30')
  assert.equal(item.announcedAt, '18 Nov 2024')
  assert.ok(item.products.includes('Apache Kafka Clients'))
  assert.match(item.notes.join('\n'), /allowlist.pattern/)
  const branches = page.advisories.find(item => item.id === 'CVE-2026-112375')
  assert.equal(branches.affectedText, '3.2.0 through 4.1.2, 4.2.0 through 4.2.1, 4.3.0 through 4.3.1')
  assert.equal(branches.fixedText, '4.2.2, 4.3.2, 4.4.0')
  assert.match(branches.notes.join('\n'), /Clusters with no authorizer configured are not affected in practice/)
  assert.ok(page.advisories.find(item => item.id === 'CVE-2026-111496').products.includes('Kafka Streams'))
  assert.match(page.notices.join(''), /不列出.*依赖库/)
})

test('Hadoop preserves lists and explanatory wording; prose-only CVE references are not new advisories', async () => {
  const page = await fetchAdvisories('hadoop', fixtureHttp())
  const item = page.advisories.find(item => item.id === 'CVE-2025-27821')
  assert.equal(item.affectedText, '3.2.0 to 3.4.1')
  assert.equal(item.fixedText, '3.4.2')
  assert.match(item.notes.join('\n'), /from 3.2.0 before 3.4.2/)
  assert.equal(item.announcedAt, '2026/01/23')
  assert.match(item.url, /#cve-2025-27821-out-of-bounds/)
  assert.ok(item.products.includes('native HDFS client'))
  assert.ok(!page.advisories.some(item => item.id === 'CVE-2016-3086'))
  assert.match(page.advisories.find(item => item.id === 'CVE-2017-15718').notes.join('\n'), /CVE-2016-3086/)
  const na = page.advisories.find(item => item.id === 'CVE-2021-44228')
  assert.equal(na.affectedText, 'N/A')
  assert.equal(na.fixedText, null)
  assert.match(na.notes.join('\n'), /no ASF version of Hadoop has ever been vulnerable/)
})

test('Flink retains separate products, original affected wording, recommendations and item timestamps', async () => {
  const page = await fetchAdvisories('flink', fixtureHttp())
  const operator = page.advisories.find(item => item.id === 'CVE-2026-40564')
  assert.deepEqual(operator.products, ['Apache Flink Kubernetes Operator'])
  assert.equal(operator.affectedText, 'Apache Flink Kubernetes Operator from 1.3.0 before 1.15.0')
  assert.equal(operator.fixedText, 'Users are recommended to upgrade to version 1.15.0, which fixes the issue.')
  assert.equal(operator.sourceTimestamp, '2026-05-26T14:43:13.154Z')
  assert.equal(page.sourceTimestamp, undefined, 'item timestamp is not a page-wide timestamp')
  assert.deepEqual(page.advisories.find(item => item.id === 'CVE-2025-62228').products, ['Apache Flink CDC'])
  assert.deepEqual(page.advisories.find(item => item.id === 'CVE-2023-41834').products, ['Apache Flink Stateful Functions'])
  assert.match(page.notices.join(''), /实验性.*2023.*滞后/)
})

test('Flink project page remains a pointer; ASF dependency guidance remains a separate reference', async () => {
  const pointer = await fetchFlinkPointer(fixtureHttp())
  assert.equal(pointer.kind, 'pointer')
  assert.ok(pointer.links.includes(SOURCES.flink))
  assert.equal(pointer.fetchedAt, AT)
  assert.ok(!('advisories' in pointer))
  const guidance = await fetchDependencyGuidance(fixtureHttp())
  assert.equal(guidance.kind, 'guidance')
  assert.equal(guidance.url, SOURCES.guidance)
  assert.equal(guidance.fetchedAt, AT)
  assert.match(guidance.text, /don’t accept the simple fact/)
})

test('official XML CDATA notes and CVEs are suppressions with file URL/time, separate from advisory inventory', async () => {
  const page = await fetchSuppressions(fixtureHttp())
  assert.equal(page.guidanceUrl, SOURCES.guidance)
  assert.deepEqual(page.suppressions.map(item => item.id), ['CVE-2023-35116', 'CVE-2023-36479'])
  assert.match(page.suppressions[0].notes, /cannot be achieved by an external attacker/)
  assert.equal(page.suppressions[1].notes, 'Kafka does not use CgiServlet')
  const kafka = await fetchAdvisories('kafka', fixtureHttp())
  for (const item of page.suppressions) {
    assert.equal(item.url, SOURCES.suppressions)
    assert.equal(item.fetchedAt, AT)
    assert.ok(!('verdict' in item))
    assert.ok(!kafka.advisories.some(advisory => advisory.id === item.id))
  }
})

test('empty, truncated, wrong-page and incomplete advisory HTML fails clearly', async () => {
  for (const project of ['kafka', 'hadoop', 'flink']) {
    const doc = await document(SOURCES[project])
    for (const payload of ['', doc.payload.slice(0, -100), '<html><body>login required</body></html>', doc.payload.replace(/CVE-\d{4}-\d+/gi, 'removed')]) {
      assert.throws(() => parseAdvisories(project, { ...doc, payload }), SourceError)
    }
    const payload = project === 'flink' ? doc.payload.replace(/>Affected</g, '>Missing<') : doc.payload.replace(/Versions affected/g, 'Missing')
    assert.throws(() => parseAdvisories(project, { ...doc, payload }), /Incomplete advisory section/)
    assert.throws(() => parseAdvisories(project, { ...doc, fetchedAt: 'invalid' }), /Invalid fetch time/)
  }
  const http = async url => ({ url, payload: '<html><body>login required</body></html>', fetchedAt: AT })
  await assert.rejects(fetchFlinkPointer(http), SourceError)
  await assert.rejects(fetchDependencyGuidance(http), SourceError)
})

test('XML truncation, DTDs, missing notes and unsupported conditional scopes fail instead of becoming empty data', async () => {
  const doc = await document(SOURCES.suppressions)
  for (const payload of ['', doc.payload.slice(0, -20), doc.payload.replace('</suppress>', '</bad>'), doc.payload.replace(/<notes>[\s\S]*?<\/notes>/, ''), doc.payload.replace('CVE-2023-35116</cve>', 'bad</cve>'), doc.payload.replace('<suppress>', '<suppress><filePath>limited.jar</filePath>'), doc.payload.replace('<suppress>', '<suppress until="2026-12-01Z">'), doc.payload.replace('<cve>', '<cve xmlns="https://example.invalid/">'), doc.payload.replace('<suppress>', '<suppress><!DOCTYPE a>')]) {
    assert.throws(() => parseSuppressions({ ...doc, payload }), /Invalid or truncated suppressions XML/)
  }
})

test('same fixtures and injected time give deterministic normalised data', async () => {
  for (const project of ['kafka', 'hadoop', 'flink']) {
    assert.deepEqual(await fetchAdvisories(project, fixtureHttp()), await fetchAdvisories(project, fixtureHttp()))
  }
})
