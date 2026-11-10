import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import { fieldNames, ingest, reconcile, rulesVersion } from '../index.js'

// Every in-memory record and fixture is synthetic SAMPLE / 示例 / 非真实票据.
const fixtures = fileURLToPath(new URL('./fixtures/', import.meta.url))
const number = '12345678901234567890'
const rawFields = { date: '2026-11-01', number, buyer: 'SAMPLE 示例买方', seller: 'SAMPLE 示例卖方', amount: '100.00', tax: '6.00', total: '106.00', currency: 'CNY', materialType: 'SAMPLE 非真实票据' }
const fields = (raw = rawFields) => Object.fromEntries(fieldNames.map(name => [name, { raw: raw[name] ?? null, source: null, review: 'pending' }]))
function record(id = 'SAMPLE-1', raw = {}, kind = 'ticket', lines) {
  return { id, fileId: id + '-file', kind, label: 'SAMPLE 示例 非真实票据', fields: fields({ ...rawFields, ...raw }), ...(lines === undefined ? {} : { lineItems: lines.map(line => fields(line)) }) }
}
function input(records = [record()]) {
  const files = records.map(r => ({ id: r.fileId, path: r.id + '.json', sha256: createHash('sha256').update(r.id).digest('hex'), status: 'parsed' }))
  return { files, inventory: files.map(file => ({ fileId: file.id, unit: 'file', status: 'parsed' })), records }
}
const outcomes = (run, id) => run.results.filter(rule => rule.ruleId === id)
const first = (run, id) => outcomes(run, id)[0]
function correction(recordId, field, before, after = before, extra = {}) {
  return { recordId, field, before, after, confirmedBy: 'SAMPLE local reviewer', confirmedAt: '2026-11-10T01:00:00Z', ...extra }
}
const corrections = entries => ({ schemaVersion: 1, entries })
function confirmAll(data) {
  return corrections(data.records.flatMap(r => [
    ...fieldNames.filter(name => r.fields[name].raw !== null).map(name => correction(r.id, name, r.fields[name].raw)),
    ...(r.lineItems ?? []).flatMap((line, lineItem) => fieldNames.filter(name => line[name].raw !== null).map(name => correction(r.id, name, line[name].raw, line[name].raw, { lineItem }))),
  ]))
}
function freeze(value) {
  Object.freeze(value)
  for (const child of Object.values(value)) if (child && typeof child === 'object') freeze(child)
  return value
}

test('SAMPLE original 100.00 + 6.00 vs 108.00 retains evidence and reports exact expected/actual/difference', async () => {
  const before = await readFile(fixtures + '/mismatch.json')
  const data = await ingest(fixtures, [{ path: 'mismatch.json', kind: 'ticket' }])
  freeze(data)
  const run = reconcile(data)
  assert.equal(run.rulesVersion, rulesVersion)
  assert.deepEqual(first(run, 'amount-tax-total'), {
    ruleId: 'amount-tax-total', outcome: 'mismatch', recordIds: [data.records[0].id], fileIds: [], field: 'total',
    expected: '106.00', actual: '108.00', difference: '2.00', expectedFen: '10600', actualFen: '10800', differenceFen: '200',
  })
  assert.deepEqual(run.extracted, data)
  assert.equal(run.records[0].fields.total.normalized.value, '108.00')
  assert.equal(run.records[0].fields.total.confirmed, undefined)
  assert.equal(run.extracted.files[0].sha256, createHash('sha256').update(before).digest('hex'))
  assert.deepEqual(await readFile(fixtures + '/mismatch.json'), before)
  const reviewed = reconcile(data, {}, corrections([correction(data.records[0].id, 'total', '108.00')]))
  assert.equal(first(reviewed, 'amount-tax-total').outcome, 'mismatch')
  assert.deepEqual(reviewed.extracted, data)
  assert.deepEqual(await readFile(fixtures + '/mismatch.json'), before)
  assert.equal(run.fullyConfirmed, false)
  assert.equal(run.externalVerification, 'not-checked')
  assert.match(run.disclaimer, /do not prove authenticity, payment or reimbursability/)
  assert.match(run.disclaimer, /do not establish accounting-archive compliance/)
  assert.match(run.records[0].label, /SAMPLE/)
})

test('clean set passes arithmetic, line sums, duplicates and number-based ledger comparisons', () => {
  const data = input([record('SAMPLE-ticket', {}, 'ticket', [{ total: '100.00' }, { total: '6.00' }]), record('SAMPLE-ledger', {}, 'ledger')])
  const run = reconcile(data, { buyerWhitelist: ['SAMPLE 示例买方'], period: { start: '2026-11-01', end: '2026-11-01' } })
  assert.ok(run.results.filter(r => r.outcome !== 'not-implemented').every(r => r.outcome === 'pass'))
  assert.equal(first(run, 'line-items-total').expectedFen, '10600')
  assert.equal(run.records[0].fields.number.normalized.value, number)
  assert.equal(typeof run.records[0].fields.number.normalized.value, 'string')
  assert.ok(run.pendingKeyFields.length > 0)
  assert.equal(run.fullyConfirmed, false)
  const confirmed = reconcile(data, run.options, confirmAll(data))
  assert.equal(confirmed.fullyConfirmed, true)
  assert.deepEqual(confirmed.pendingKeyFields, [])
  assert.equal(confirmed.externalVerification, 'not-checked')
})

test('integer fen covers fractional, signed, leading-zero and arbitrarily large values without float drift', () => {
  for (const [amount, tax, total] of [
    ['0.10', '0.20', '0.30'], ['-1.20', '-0.30', '-1.50'], ['+0001.2', '0', '1.20'],
    ['90071992547409931234567890.99', '0.01', '90071992547409931234567891.00'],
  ]) {
    const run = reconcile(input([record('SAMPLE', { amount, tax, total })]))
    assert.equal(first(run, 'amount-tax-total').outcome, 'pass')
    assert.equal(first(run, 'amount-tax-total').differenceFen, '0')
    assert.doesNotThrow(() => JSON.stringify(run))
  }
  const zero = reconcile(input([record('SAMPLE', { amount: '0', tax: '0', total: '0' })]))
  assert.equal(first(zero, 'amount-tax-total').outcome, 'pass')
})

test('blank is not zero; unclear money precision/sign and currency never pass', () => {
  for (const amount of [null, '', ' ', '1.001', '(1.00)', '1-', '±1', '1e2', '1,000.00', '￥100', '.50', '--1']) {
    assert.equal(first(reconcile(input([record('SAMPLE', { amount })])), 'amount-tax-total').outcome, 'unchecked', String(amount))
  }
  for (const currency of [null, '', 'USD', '¥', 'CNY/USD']) {
    const run = reconcile(input([record('SAMPLE', { currency }, 'ticket', [{ total: '106' }])]))
    assert.equal(first(run, 'amount-tax-total').outcome, 'unchecked')
    assert.equal(first(run, 'line-items-total').outcome, 'unchecked')
  }
  for (const field of ['tax', 'total']) assert.equal(first(reconcile(input([record('SAMPLE', { [field]: null })])), 'amount-tax-total').outcome, 'unchecked')
})

test('line totals mismatch in fen, require every total, and inherit only absent currency', () => {
  const run = reconcile(input([record('SAMPLE', {}, 'ticket', [{ total: '100' }, { total: '5' }])]))
  assert.deepEqual([first(run, 'line-items-total').outcome, first(run, 'line-items-total').expected, first(run, 'line-items-total').actual, first(run, 'line-items-total').difference], ['mismatch', '105.00', '106.00', '1.00'])
  for (const lines of [[{ amount: '106' }], [{ total: '' }], [{ total: '106', currency: 'USD' }], [{ total: '100' }, {}]]) {
    assert.equal(first(reconcile(input([record('SAMPLE', {}, 'ticket', lines)])), 'line-items-total').outcome, 'unchecked')
  }
  for (const lines of [undefined, []]) {
    const absent = reconcile(input([record('SAMPLE', {}, 'ticket', lines)]))
    assert.equal(first(absent, 'line-items-total').reason, 'no-line-items')
    assert.ok(absent.unexecutedRules.some(r => r.ruleId === 'line-items-total'))
  }
})

test('duplicate numbers within each kind and file hashes are reported without deleting records', () => {
  const data = input([record('SAMPLE-A'), record('SAMPLE-B'), record('SAMPLE-L', {}, 'ledger')])
  data.files[1].sha256 = data.files[0].sha256
  const run = reconcile(data)
  const duplicate = outcomes(run, 'duplicate-number').find(r => r.outcome === 'mismatch')
  assert.deepEqual(duplicate.recordIds, ['SAMPLE-A', 'SAMPLE-B'])
  assert.equal(duplicate.actual, number)
  assert.deepEqual(first(run, 'duplicate-file-hash').fileIds, ['SAMPLE-A-file', 'SAMPLE-B-file'])
  assert.equal(first(run, 'duplicate-file-hash').outcome, 'mismatch')
  assert.equal(run.extracted.records.length, 3)
  assert.equal(run.records.length, 3)
  assert.equal(run.extracted.files.length, 3)
  assert.ok(outcomes(run, 'ledger-match').every(r => r.outcome === 'unchecked' && r.reason === 'ambiguous-duplicate-number'))
  assert.equal(first(run, 'ledger-amount').outcome, 'unchecked')
  assert.equal(first(run, 'ledger-amount').reason, 'no-applicable-records')
  assert.equal(run.fullyConfirmed, false)
})

test('unavailable number and hash are unchecked, not unique or zero', () => {
  const data = input([record('SAMPLE', { number: null })])
  data.files[0].sha256 = null
  assert.equal(first(reconcile(data), 'duplicate-number').outcome, 'unchecked')
  assert.equal(first(reconcile(data), 'duplicate-file-hash').outcome, 'unchecked')
})

test('optional whitelist and period are explicitly unexecuted; configured checks report misses and missing values', () => {
  const data = input()
  const run = reconcile(data)
  for (const id of ['buyer-whitelist', 'date-period']) {
    assert.equal(first(run, id).outcome, 'unchecked')
    assert.equal(first(run, id).reason, 'not-configured')
    assert.ok(run.unexecutedRules.some(r => r.ruleId === id))
  }
  const configured = reconcile(data, { buyerWhitelist: ['SAMPLE another buyer'], period: { start: '2026-11-02', end: '2026-11-30' } })
  assert.equal(first(configured, 'buyer-whitelist').outcome, 'mismatch')
  assert.deepEqual(first(configured, 'buyer-whitelist').expected, ['SAMPLE another buyer'])
  assert.equal(first(configured, 'date-period').outcome, 'mismatch')
  assert.equal(first(configured, 'date-period').actual, '2026-11-01')
  assert.equal(first(reconcile(data, { buyerWhitelist: [] }), 'buyer-whitelist').outcome, 'mismatch')
  const missing = reconcile(input([record('SAMPLE', { buyer: null, date: '2026-02-30' })]), { buyerWhitelist: ['SAMPLE'], period: { start: '2026-01-01', end: '2026-12-31' } })
  assert.equal(first(missing, 'buyer-whitelist').outcome, 'unchecked')
  assert.equal(first(missing, 'date-period').outcome, 'unchecked')
})

test('dates validate actual calendar days and period boundaries inclusively', () => {
  for (const date of ['2024-02-29', '2024-03-01']) {
    assert.equal(first(reconcile(input([record('SAMPLE', { date })]), { period: { start: '2024-02-29', end: '2024-03-01' } }), 'date-period').outcome, 'pass')
  }
  for (const date of ['2026-02-29', '2026-13-01', '2026-00-01', '2026-11-31', '0000-01-01', '11/01/2026', null]) {
    const run = reconcile(input([record('SAMPLE', { date })]), { period: { start: '2026-01-01', end: '2026-12-31' } })
    assert.equal(first(run, 'date-period').outcome, 'unchecked', String(date))
  }
})

test('ledger ingest matches string numbers, reports unmatched sides, and compares net and gross separately', async () => {
  const mapping = { number: '发票号码', amount: '金额', total: '价税合计', currency: '币种' }
  const data = await ingest(fixtures, [{ path: 'tickets.json', kind: 'ticket' }, { path: 'ledger.csv', kind: 'ledger', mapping }])
  data.records.find(r => r.kind === 'ledger').fields.amount.raw = '101.00'
  data.records.find(r => r.kind === 'ledger').fields.total.raw = '108.00'
  const run = reconcile(data)
  assert.deepEqual(outcomes(run, 'ledger-match').filter(r => r.outcome === 'mismatch').map(r => r.reason).sort(), ['unmatched-ledger', 'unmatched-ticket'])
  assert.equal(outcomes(run, 'ledger-match').filter(r => r.outcome === 'pass').length, 1)
  assert.deepEqual(outcomes(run, 'ledger-amount').map(r => [r.field, r.outcome, r.expected, r.actual, r.difference]), [
    ['amount', 'mismatch', '100.00', '101.00', '1.00'], ['total', 'mismatch', '106.00', '108.00', '2.00'],
  ])
  assert.ok(outcomes(run, 'duplicate-number').every(r => r.outcome === 'pass'))
})

test('ledger never pairs by same amount alone, guesses gross/net, or silently passes missing/incomparable amounts', () => {
  const unmatched = reconcile(input([record('SAMPLE-T', { number: 'SAMPLE-T' }), record('SAMPLE-L', { number: 'SAMPLE-L' }, 'ledger')]))
  assert.ok(outcomes(unmatched, 'ledger-match').every(r => r.outcome === 'mismatch'))
  for (const patch of [{ amount: null }, { amount: '100.000' }, { currency: 'USD' }, { currency: null }]) {
    const run = reconcile(input([record('SAMPLE-T'), record('SAMPLE-L', patch, 'ledger')]))
    assert.equal(outcomes(run, 'ledger-amount').find(r => r.field === 'amount').outcome, 'unchecked')
  }
  const absent = reconcile(input([record('SAMPLE-T', { amount: null, total: null }), record('SAMPLE-L', { amount: null, total: null }, 'ledger')]))
  assert.equal(first(absent, 'ledger-amount').reason, 'no-comparable-amount-fields')
  const missingId = reconcile(input([record('SAMPLE-T', { number: null }), record('SAMPLE-L', {}, 'ledger')]))
  assert.ok(outcomes(missingId, 'ledger-match').some(r => r.outcome === 'unchecked' && r.reason === 'missing-or-unreadable-number'))
  const noTickets = reconcile(input([record('SAMPLE-L', {}, 'ledger')]))
  assert.equal(first(noTickets, 'ledger-match').reason, 'unmatched-ledger')
  assert.equal(first(reconcile(input()), 'ledger-match').reason, 'no-ledger-records')
})

test('corrections JSON preserves extracted and normalized values, records provenance and re-runs rules', () => {
  // SAMPLE OCR extraction with no asserted original total; the replacement is supplied by a human.
  const data = freeze(input([record('SAMPLE', { total: '108.00' }, 'ticket', [{ total: '108.00' }])]))
  const audit = freeze(corrections([
    correction('SAMPLE', 'total', '108.00', '106.00'),
    correction('SAMPLE', 'total', '108.00', '106.00', { lineItem: 0 }),
  ]))
  const run = reconcile(data, {}, JSON.stringify(audit))
  assert.equal(first(run, 'amount-tax-total').outcome, 'pass')
  assert.equal(first(run, 'line-items-total').outcome, 'pass')
  assert.equal(run.extracted.records[0].fields.total.raw, '108.00')
  assert.equal(run.records[0].fields.total.normalized.value, '108.00')
  assert.deepEqual(run.records[0].fields.total.confirmed, { value: '106.00', fen: '10600', raw: '106.00', confirmedBy: 'SAMPLE local reviewer', confirmedAt: '2026-11-10T01:00:00Z' })
  assert.deepEqual(run.corrections, audit)
  assert.equal(run.records[0].fields.total.review, 'confirmed')
  assert.equal(run.fullyConfirmed, false)
  assert.equal(first(reconcile(data), 'amount-tax-total').outcome, 'mismatch')
  const chain = corrections([correction('SAMPLE', 'total', '108.00', '107.00'), correction('SAMPLE', 'total', '107.00', '106.00')])
  assert.equal(reconcile(data, {}, chain).records[0].fields.total.confirmed.value, '106.00')
})

test('corrections can resolve formula-only unreadable fields without changing the formula evidence', async () => {
  const data = await ingest(fixtures, [{ path: 'ledger.xlsx', kind: 'ticket', mapping: { number: '发票号码', amount: '金额', tax: '税额', total: '价税合计', currency: '币种' }, sheet: '示例台账 SAMPLE' }])
  const row = data.records.find(r => r.fields.total.issue === 'formula-without-cache')
  assert.ok(row)
  assert.equal(outcomes(reconcile(data), 'amount-tax-total').find(r => r.recordIds.includes(row.id)).outcome, 'unchecked')
  const run = reconcile(data, {}, corrections([correction(row.id, 'total', null, '106.00')]))
  assert.equal(outcomes(run, 'amount-tax-total').find(r => r.recordIds.includes(row.id)).outcome, 'pass')
  assert.equal(run.records.find(r => r.id === row.id).fields.total.normalized.issue, 'formula-without-cache')
  assert.deepEqual(run.extracted, data)
  assert.equal(run.fullyConfirmed, false)
})

test('confirmation gating rejects remaining mismatches, missing key fields, invalid confirmations and failed inventory', () => {
  const mismatched = input([record('SAMPLE', { total: '108.00' })])
  assert.equal(reconcile(mismatched, {}, confirmAll(mismatched)).fullyConfirmed, false)
  for (const field of ['amount', 'number', 'date', 'buyer', 'seller', 'currency', 'tax', 'total']) {
    const data = input([record('SAMPLE', { [field]: null })])
    const run = reconcile(data, {}, confirmAll(data))
    assert.equal(run.fullyConfirmed, false, field)
    assert.ok(run.pendingKeyFields.some(p => p.field === field))
  }
  const data = input()
  const audit = confirmAll(data)
  audit.entries.push(correction('SAMPLE-1', 'amount', '100.00', '100.001'))
  assert.equal(reconcile(data, {}, audit).records[0].fields.amount.review, 'unreadable')
  assert.equal(reconcile(data, {}, audit).fullyConfirmed, false)
  data.inventory.push({ fileId: 'SAMPLE-1-file', unit: 'row', row: 2, status: 'failed', reason: 'SAMPLE-unreadable' })
  assert.equal(reconcile(data, {}, confirmAll(data)).fullyConfirmed, false)
  assert.equal(reconcile(input([])).fullyConfirmed, false)
})

test('correction trust boundary rejects stale before values, invalid targets, schemas, metadata and numeric money/ids', () => {
  const data = input()
  const entry = correction('SAMPLE-1', 'amount', '100.00', '101.00')
  for (const patch of [
    { recordId: 'missing' }, { field: 'rewriteAmount' }, { lineItem: 0 }, { lineItem: -1 }, { lineItem: 0.5 },
    { before: '99.00' }, { before: undefined }, { after: 101 }, { after: null }, { confirmedBy: '' },
    { confirmedAt: 'yesterday' }, { confirmedAt: '2026-02-30T01:00:00Z' }, { confirmedAt: '2026-11-10T25:00:00Z' },
    { confirmedAt: undefined }, { modelRewrite: true },
  ]) assert.throws(() => reconcile(data, {}, corrections([{ ...entry, ...patch }])), undefined, JSON.stringify(patch))
  for (const invalid of ['{', {}, [], { schemaVersion: 2, entries: [] }, { schemaVersion: 1, entries: [], model: 'SAMPLE' }]) assert.throws(() => reconcile(data, {}, invalid))
  assert.throws(() => reconcile(data, {}, corrections([entry, entry])), /stale-correction/)
  assert.equal(data.records[0].fields.amount.raw, '100.00')
  assert.equal(data.records[0].fields.amount.review, 'pending')
  assert.throws(() => reconcile(data, {}, corrections([correction('SAMPLE-1', 'number', number, 123)])), /invalid-correction-entry/)
})

test('options and normalized input validate boundaries without echoing sensitive values', () => {
  for (const options of [null, [], { rewriteAmounts: true }, { buyerWhitelist: 'SAMPLE' }, { buyerWhitelist: [''] },
    { period: {} }, { period: { start: '2026-13-01', end: '2026-12-01' } }, { period: { start: '2026-11-02', end: '2026-11-01' } },
  ]) assert.throws(() => reconcile(input(), options))
  const data = input()
  data.records[0].fields.number.raw = 123
  assert.throws(() => reconcile(data), /invalid-ingest-fields/)
  const duplicateId = input([record(), record()])
  assert.throws(() => reconcile(duplicateId), /invalid-ingest-files/)
})

test('same inputs, options and corrections produce byte-identical JSON and list only the four rule states', () => {
  const data = input([record('SAMPLE', { total: '108.00' }, 'ticket', [{ total: '108.00' }])])
  const audit = corrections([correction('SAMPLE', 'buyer', rawFields.buyer)])
  const options = { buyerWhitelist: ['SAMPLE another buyer'], period: { start: '2026-11-01', end: '2026-11-30' } }
  const before = JSON.stringify({ data, options, audit })
  const run = reconcile(freeze(data), freeze(options), freeze(audit))
  assert.equal(JSON.stringify(run), JSON.stringify(reconcile(JSON.parse(JSON.stringify(data)), options, audit)))
  assert.equal(JSON.stringify({ data, options, audit }), before)
  for (const rule of run.results) assert.ok(['pass', 'mismatch', 'unchecked', 'not-implemented'].includes(rule.outcome))
  for (const rule of run.results.filter(r => r.outcome === 'mismatch')) {
    assert.ok(rule.ruleId && rule.expected !== null && rule.actual !== null)
    assert.ok(Object.hasOwn(rule, 'difference'))
  }
  for (const id of ['authenticity', 'currency-conversion', 'payment-verification', 'reimbursability', 'archive-compliance']) {
    assert.ok(run.unexecutedRules.some(r => r.ruleId === id && r.outcome === 'not-implemented'))
  }
  assert.equal(run.externalVerification, 'not-checked')
})

test('every supported rule is listed even when no records can be checked', () => {
  const run = reconcile(input([]), { buyerWhitelist: ['SAMPLE'] })
  for (const ruleId of ['amount-tax-total', 'line-items-total', 'duplicate-number', 'duplicate-file-hash', 'buyer-whitelist', 'date-period', 'ledger-match', 'ledger-amount']) {
    assert.equal(first(run, ruleId).outcome, 'unchecked')
    assert.ok(run.unexecutedRules.some(r => r.ruleId === ruleId))
  }
  assert.equal(run.fullyConfirmed, false)
})

test('reconciliation and confirmed re-runs require no network or model service', t => {
  const deny = () => { throw new Error('network-forbidden-in-test') }
  for (const [target, key] of [[globalThis, 'fetch'], [http, 'request'], [http, 'get'], [https, 'request'], [https, 'get'], [net.Socket.prototype, 'connect']]) {
    t.mock.method(target, key, deny)
  }
  const data = input()
  assert.equal(first(reconcile(data), 'amount-tax-total').outcome, 'pass')
  assert.equal(reconcile(data, {}, confirmAll(data)).fullyConfirmed, true)
})
