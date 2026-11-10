import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalize, hash, parseCsv, extract, parseRegistration, parseRegistry, emptyRegistry,
  register, analyze, compare, createPlan, renderScan, localPath, acceptBaselines, isAcceptable,
} from '../lib/core.js'

export const csv = 'item,vendor,price\nA,甲,100\nB,乙,200\n'
export const input = (id = 'quote-a') => ({
  id, source: 'quotes.csv', selector: { kind: 'csv-key', keyColumn: 'item', keyValue: 'A', columns: ['vendor', 'price'] },
  conclusion: { id: 'buy-a', text: '建议购买 A' },
  outputs: [
    { path: 'comparison.csv', kind: 'table', locator: 'item=A', label: '采购比较表' },
    { path: 'report.md', kind: 'section', locator: '## 建议', label: '采购建议' },
    { path: 'report.md', kind: 'report', locator: '全文', label: '采购报告' },
  ],
  recheck: '按最新单价乘以采购数量 10，重算比较表总价，再检查建议是否仍有依据。',
})
const makeScan = (text, registry = register(emptyRegistry(), input(), csv)) => analyze(registry, new Map([['quotes.csv', { text }]]))

test('scan-local reuse preserves canonical scanId and full per-reference evidence',()=>{
  let registry=emptyRegistry()
  for(let i=0;i<80;i++) registry=register(registry,input('ref-'+i),csv)
  const observation={text:csv.replace('100','120')}, impacts=registry.references.map(r=>compare(r,observation))
  const scan=analyze(registry,new Map([['quotes.csv',observation]]))
  assert.deepEqual(scan.impacts,impacts)
  assert.equal(scan.scanId,hash(JSON.stringify({registry,impacts})))
  assert.equal(renderScan(scan).split('\n').filter(l=>l.startsWith('{')).length,20)
  assert.match(renderScan(scan),/受影响 80 条/)
  scan.impacts[0].statuses.length=0
  assert.ok(scan.impacts[1].statuses.length>0,'each result owns its mutable status array')
  assert.equal(analyze(registry,new Map([['quotes.csv',{text:csv}]] )).impacts[0].citationContentChanged,false)
})

test('register preserves explicit source → citation → conclusion → output chain without mutating input', () => {
  const before = emptyRegistry(), original = input()
  const after = register(before, original, csv)
  assert.equal(before.references.length, 0)
  assert.deepEqual(after.references[0].outputs, original.outputs)
  assert.equal(after.references[0].baseline.versionHash, hash(csv))
  assert.equal(after.references[0].baseline.excerpt, '[["vendor","甲"],["price","100"]]')
  assert.deepEqual(parseRegistry(JSON.parse(JSON.stringify(after))), after)
})
test('unchanged source has no status or affected outputs', () => {
  const scan = makeScan(csv)
  assert.deepEqual(scan.impacts[0].statuses, [])
  assert.equal(scan.impacts[0].needsManualReview, false)
  assert.deepEqual(scan.affected, { conclusions: [], outputs: [] })
  assert.match(renderScan(scan), /受影响 0 条/)
})
test('BOM and CRLF normalization is reproducible', () => {
  assert.equal(normalize('\uFEFFa\r\nb\rc'), 'a\nb\nc')
  assert.deepEqual(makeScan('\uFEFF' + csv.replaceAll('\n', '\r\n')).impacts[0].statuses, [])
})
test('unreferenced CSV row changes only the whole-file version', () => {
  const scan = makeScan(csv.replace('200', '250')), i = scan.impacts[0]
  assert.deepEqual(i.statuses, ['来源版本已变化'])
  assert.equal(i.sourceVersionChanged, true)
  assert.equal(i.citationContentChanged, false)
  assert.equal(i.needsManualReview, false)
  assert.equal(scan.affected.outputs.length, 3)
})
test('quoted CSV formatting, row and header order do not alter referenced cell content', () => {
  const scan = makeScan('price,item,vendor\n200,B,乙\n"100",A,"甲"\n')
  assert.equal(scan.impacts[0].sourceVersionChanged, true)
  assert.equal(scan.impacts[0].citationContentChanged, false)
})
test('referenced price change marks all three statuses without judging the conclusion', () => {
  const scan = makeScan(csv.replace('100', '105')), i = scan.impacts[0]
  assert.deepEqual(i.statuses, ['来源版本已变化', '引用内容已变化', '需要人工复核'])
  assert.equal(i.needsManualReview, true)
  assert.deepEqual(scan.affected.conclusions, [input().conclusion])
  assert.equal(i.reference.conclusion.text, '建议购买 A')
})
for (const [label, text, reason] of [
  ['deleted row', 'item,vendor,price\nB,乙,200\n', /键已不存在/],
  ['duplicate key', csv + 'A,丙,90\n', /键重复/],
  ['deleted column', 'item,vendor\nA,甲\n', /列已不存在/],
  ['duplicate header', 'item,price,price\nA,1,2\n', /表头/],
  ['malformed CSV', 'item,vendor,price\nA,"甲,100\n', /引号未闭合/],
]) test(label + ' is unresolved, requiring review rather than claiming a content comparison', () => {
  const i = makeScan(text).impacts[0]
  assert.equal(i.sourceVersionChanged, true)
  assert.equal(i.citationContentChanged, null)
  assert.equal(i.needsManualReview, true)
  assert.match(i.reason, reason)
})
test('missing/unreadable source keeps change flags unknown', () => {
  const r = register(emptyRegistry(), input(), csv), scan = analyze(r, new Map())
  assert.deepEqual(scan.impacts[0].statuses, ['需要人工复核'])
  assert.equal(scan.impacts[0].sourceVersionChanged, null)
  assert.equal(scan.impacts[0].citationContentChanged, null)
})
test('strict CSV supports embedded comma, double quote, newline and empty trailing cells', () => {
  assert.deepEqual(parseCsv('a,b,c\r\n1,"x,""y""\r\nz",\r\n'), [['a','b','c'], ['1','x,"y"\nz','']])
  assert.deepEqual(parseCsv('a,b\n1,2'), [['a','b'], ['1','2']])
})
for (const invalid of ['', 'a,a\n1,2', ',b\n1,2', 'a,b\n1', 'a\n"x"z', 'a\nx"y']) {
  test('strict CSV rejects malformed input ' + JSON.stringify(invalid), () => assert.throws(() => parseCsv(invalid)))
}
test('Markdown line selection detects exact range changes and ignores unrelated changes', () => {
  const r = { ...input(), source: 'source.md', selector: { kind: 'markdown-lines', start: 2, end: 3 } }
  const registry = register(emptyRegistry(), r, '# Header\n段落一\n段落二\n尾注\n')
  const scan = raw => analyze(registry, new Map([['source.md', { text: raw }]])).impacts[0]
  assert.equal(scan('# Header\n段落一\n段落二\n尾注更新\n').citationContentChanged, false)
  assert.equal(scan('# Header\n新段落\n段落二\n尾注\n').citationContentChanged, true)
  assert.equal(scan('# Header\n').citationContentChanged, null)
})
test('Markdown unique quote tolerates movement but fails closed on missing or ambiguous text', () => {
  const selector = { kind: 'markdown-quote', text: '明确登记原文' }
  assert.equal(extract('前\n明确登记原文\n后', selector), selector.text)
  assert.equal(extract('新增\n前\n明确登记原文\n后', selector), selector.text)
  assert.throws(() => extract('已删除', selector), /无法定位/)
  assert.throws(() => extract('明确登记原文 明确登记原文', selector), /多次/)
  assert.throws(() => extract('aaa', { kind: 'markdown-quote', text: 'aa' }), /多次/)
})
test('quote missing on update is manual review, not a proven citation content change', () => {
  const r = register(emptyRegistry(), { ...input(), source: 'x.md', selector: { kind: 'markdown-quote', text: 'old' } }, 'old')
  const i = analyze(r, new Map([['x.md', { text: 'new' }]])).impacts[0]
  assert.deepEqual(i.statuses, ['来源版本已变化', '需要人工复核'])
})
test('multiple sources propagate to and deduplicate the same conclusion and output positions', () => {
  let registry = register(emptyRegistry(), input(), csv)
  registry = register(registry, { ...input('quote-b'), source: 'other.csv' }, csv)
  const scan = analyze(registry, new Map([['quotes.csv', { text: csv.replace('100', '110') }], ['other.csv', { text: csv.replace('100', '120') }]]))
  assert.equal(scan.affected.conclusions.length, 1)
  assert.equal(scan.affected.outputs.length, 3)
  assert.equal(scan.impacts.filter(i => i.needsManualReview).length, 2)
})
test('duplicate reference or conflicting conclusion is rejected, preserving original baseline', () => {
  const r = register(emptyRegistry(), input(), csv)
  assert.throws(() => register(r, input(), csv), /已存在/)
  assert.throws(() => register(r, { ...input('b'), conclusion: { id: 'buy-a', text: '其他' } }, csv), /文本必须一致/)
  assert.equal(r.references[0].baseline.versionHash, hash(csv))
})
test('registration validates selector/file agreement, ranges, selected columns, output and instruction', () => {
  for (const patch of [
    { source: 'x.xlsx' }, { source: 'x.md' }, { id: 'bad id' },
    { selector: { kind: 'csv-key', keyColumn: 'item', keyValue: 'A', columns: [] } },
    { selector: { kind: 'csv-key', keyColumn: 'item', keyValue: 'A', columns: ['price', 'price'] } },
    { source: 'x.md', selector: { kind: 'markdown-lines', start: 3, end: 2 } },
    { source: 'x.md', selector: { kind: 'markdown-lines', start: 0, end: 1 } },
    { outputs: [] }, { recheck: '' },
  ]) assert.throws(() => parseRegistration({ ...input(), ...patch }))
})
test('project path validation rejects traversal, remote, credential and Windows stream paths', () => {
  for (const value of ['../x.md', 'a/../x.md', '/x.md', 'C:\\x.md', '\\\\server\\x.csv', 'https://x/a.md', '_private/a.md', '_tools/a.md', '.git/a.md', '.env/a.md', 'x.md:stream', 'a./x.md']) assert.throws(() => localPath(value))
  assert.equal(localPath('data\\quotes.CSV'), 'data/quotes.CSV')
})
test('corrupt registry and unsupported schema are rejected rather than silently reset', () => {
  const r = register(emptyRegistry(), input(), csv)
  assert.throws(() => parseRegistry({ ...r, schemaVersion: 2 }))
  assert.throws(() => parseRegistry({ ...r, references: [...r.references, ...r.references] }))
  r.references[0].baseline.excerpt = 'tampered'
  assert.throws(() => parseRegistry(r), /基线损坏/)
})
test('plan only includes selected affected references and contains executable instructions/evidence', () => {
  let r = register(emptyRegistry(), input(), csv)
  r = register(r, input('second'), csv)
  const scan = makeScan(csv.replace('100', '101'), r), before = JSON.stringify(r)
  const plan = createPlan(scan, ['second'], scan.scanId)
  assert.deepEqual(plan.selectedIds, ['second'])
  assert.equal(plan.tasks.length, 1)
  assert.equal(plan.tasks[0].steps[2], input().recheck)
  assert.equal(plan.tasks[0].evidence.current.citationHash, scan.impacts[1].current.citationHash)
  assert.match(plan.instruction, /不得直接改写报告结论/)
  assert.equal(JSON.stringify(r), before)
})
test('empty, duplicate, unknown and unaffected selections are rejected', () => {
  const changed = makeScan(csv.replace('100', '101')), same = makeScan(csv)
  for (const ids of [[], ['quote-a', 'quote-a'], ['unknown']]) assert.throws(() => createPlan(changed, ids, changed.scanId))
  assert.throws(() => createPlan(same, ['quote-a'], same.scanId), /没有受影响/)
})
test('scan fingerprint rejects stale selection after source or registry changes', () => {
  const a = makeScan(csv.replace('100', '101')), b = makeScan(csv.replace('100', '102'))
  assert.equal(a.scanId, makeScan(csv.replace('100', '101')).scanId)
  assert.throws(() => createPlan(b, ['quote-a'], a.scanId), /已变化/)
  const r = register(register(emptyRegistry(), input(), csv), input('extra'), csv)
  assert.notEqual(makeScan(csv.replace('100', '101'), r).scanId, a.scanId)
})
test('oversized reference excerpt is rejected', () => {
  assert.throws(() => extract('x'.repeat(65537), { kind: 'markdown-lines', start: 1, end: 1 }), /64 Ki/)
})

test('acceptBaselines binds to scanId, keeps previous baseline, and leaves the original registry untouched', () => {
  const registry = register(emptyRegistry(), input(), csv)
  const before = JSON.stringify(registry)
  const scan = makeScan(csv.replace('100', '105'))
  const unchanged = makeScan(csv)
  assert.equal(isAcceptable(scan.impacts[0]), true)
  assert.equal(isAcceptable(unchanged.impacts[0]), false)
  assert.throws(() => acceptBaselines(registry, scan, unchanged.scanId), /已变化/)
  assert.throws(() => acceptBaselines(registry, unchanged, unchanged.scanId), /没有可接受的新基线/)
  const missing = makeScan('item,vendor,price\nB,乙,200\n')
  assert.throws(() => acceptBaselines(registry, missing, missing.scanId, ['quote-a']), /无法重新定位/)
  assert.equal(JSON.stringify(registry), before)
  const next = acceptBaselines(registry, scan, scan.scanId)
  assert.equal(JSON.stringify(registry), before)
  assert.equal(next.references[0].baseline.citationHash, scan.impacts[0].current.citationHash)
  assert.equal(next.references[0].previousBaseline.versionHash, registry.references[0].baseline.versionHash)
  assert.equal(next.references[0].previousBaseline.acceptedFromScanId, scan.scanId)
  assert.deepEqual(parseRegistry(JSON.parse(JSON.stringify(next))), next)
  assert.match(renderScan(scan), /impact accept/)
})
