import test from 'node:test'
import { childHook, withoutFdPaths } from './portable.mjs'
import assert from 'node:assert/strict'
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import ExcelJS from 'exceljs'
import { exportPack, fieldNames, ingest, packDisclaimer, reconcile } from '../index.js'

// All documents and human-review assertions here are synthetic SAMPLE / 示例 / 非真实票据.
const fixtures = fileURLToPath(new URL('./fixtures/', import.meta.url))
const number = '12345678901234567890'
const mapping = Object.fromEntries(fieldNames.map((name, i) => [name, ['开票日期', '发票号码', '购买方', '销售方', '金额', '税额', '价税合计', '币种', '材料类型'][i]]))
async function project(t, names = ['mismatch.json']) {
  await mkdir('.tmp', { recursive: true })
  const root = await mkdtemp(fileURLToPath(new URL('../.tmp/export-', import.meta.url)))
  t.after(() => rm(root, { recursive: true, force: true }))
  for (const name of names) await copyFile(`${fixtures}/${name}`, `${root}/${name}`)
  return root
}
const load = (root, names = ['mismatch.json']) => ingest(root, names.map(path => ({ path, kind: 'ticket', ...(/\.(csv|xlsx)$/.test(path) ? { mapping } : {}) })))
const json = async path => JSON.parse(await readFile(path, 'utf8'))
const cells = sheet => sheet.getRows(2, sheet.rowCount - 1)?.map(row => row.values.slice(1)) ?? []
async function workbook(path) {
  const book = new ExcelJS.Workbook()
  await book.xlsx.readFile(path)
  return book
}
const hash = data => createHash('sha256').update(data).digest('hex')

test('clean Chinese CSV and XLSX ledgers reconcile with an XML ticket and export without changing sources', async t => {
  const root = await project(t, ['clean.csv', 'gbk.csv', 'gb18030.csv', 'invoice.xml'])
  const book = new ExcelJS.Workbook()
  const sheet = book.addWorksheet('SAMPLE 示例台账')
  for (const row of (await readFile(`${root}/clean.csv`, 'utf8')).replace(/^\uFEFF/, '').trim().split(/\r?\n/)) sheet.addRow(row.split(','))
  await book.xlsx.writeFile(`${root}/SAMPLE-clean.xlsx`)
  for (const path of ['clean.csv', 'gbk.csv', 'gb18030.csv', 'SAMPLE-clean.xlsx']) {
    const paths = ['invoice.xml', path]
    const before = await Promise.all(paths.map(name => readFile(`${root}/${name}`)))
    const data = await ingest(root, [{ path: paths[0], kind: 'ticket' }, { path, kind: 'ledger', mapping }])
    assert.ok(data.files.every(file => file.status === 'parsed'))
    const run = reconcile(data)
    assert.equal(run.results.filter(rule => rule.outcome === 'mismatch').length, 0)
    for (const id of ['amount-tax-total', 'line-items-total', 'ledger-match']) assert.ok(run.results.some(rule => rule.ruleId === id && rule.outcome === 'pass'), id)
    assert.equal(run.fullyConfirmed, false)
    const pack = await exportPack(root, `SAMPLE-${path}-pack`, run, { includeOriginals: true })
    const report = await json(`${root}/${pack.files.json}`)
    assert.equal(report.status, 'draft')
    assert.ok(report.records.every(record => record.fields.number.normalized.value === number))
    const exported = await workbook(`${root}/${pack.files.xlsx}`)
    if (path.endsWith('.csv')) {
      const encoding = path === 'clean.csv' ? 'utf-8' : 'gb18030'
      assert.equal(report.extracted.inventory.find(entry => entry.fileId === 'file-2' && entry.unit === 'file').encoding, encoding)
      assert.equal(cells(exported.getWorksheet('Inventory')).find(row => row[0] === 'file-2' && row[1] === 'file')[7], encoding)
      assert.ok((await readFile(`${root}/${pack.files.markdown}`, 'utf8')).includes(encoding))
    }
    const identifiers = exported.getWorksheet('Fields').getRows(2, exported.getWorksheet('Fields').rowCount - 1).filter(row => row.getCell(5).value === 'number' && row.getCell(4).value === '')
    assert.equal(identifiers.length, 2)
    for (const row of identifiers) assert.equal(row.getCell(6).value, number)
    for (const [i, name] of paths.entries()) {
      assert.deepEqual(await readFile(`${root}/${name}`), before[i])
      assert.equal(data.files[i].sha256, hash(before[i]))
    }
  }
})

function confirmation(data, field, before, after = before) {
  return { recordId: data.records[0].id, field, before, after, confirmedBy: 'SAMPLE human reviewer', confirmedAt: '2026-11-11T01:00:00Z' }
}

test('draft pack writes Markdown/XLSX/JSON with textual red flags, versions, inventory, disclaimers and separate field layers', async t => {
  const root = await project(t)
  const data = await load(root)
  const run = reconcile(data)
  const before = JSON.stringify(run)
  const result = await exportPack(root, 'SAMPLE-pack', run)
  assert.equal(JSON.stringify(run), before)
  assert.equal(result.status, 'draft')
  assert.equal(result.packKind, 'summary-only')
  assert.deepEqual(result.counts, { records: 1, mismatches: 1, pendingKeyFields: 8, originals: 0 })
  assert.deepEqual(Object.keys(result).sort(), ['counts', 'directory', 'files', 'packKind', 'status'])
  assert.doesNotMatch(JSON.stringify(result), /108\.00|SAMPLE 示例买方|12345678901234567890/)
  const report = await json(`${root}/${result.files.json}`)
  assert.equal(report.rulesVersion, 'invoice-gate/1')
  assert.equal(report.externalVerification, 'not-checked')
  assert.equal(report.fullyConfirmed, false)
  assert.deepEqual(report.extracted, run.extracted)
  assert.deepEqual(report.records, run.records)
  assert.deepEqual(report.unexecutedRules, run.unexecutedRules)
  assert.equal(report.originals[0].packPath, null)
  assert.deepEqual(report.mismatches.map(rule => [rule.ruleId, rule.expected, rule.actual, rule.difference]), [['amount-tax-total', '106.00', '108.00', '2.00']])
  assert.equal(report.evidence.find(e => e.field === 'total').availability, 'referenced-not-bundled')
  assert.equal(report.evidence.find(e => e.field === 'total').source.path, '/records/0/fields/total')
  const md = await readFile(`${root}/${result.files.markdown}`, 'utf8')
  for (const text of ['DRAFT / 草稿', 'SAMPLE', '非真实票据', 'amount-tax-total', '106.00', '108.00', '2.00', 'Expected', 'Actual', 'Difference', 'not-configured', 'not-implemented', 'Extracted raw', 'Normalized', 'Confirmed (human)', packDisclaimer]) assert.ok(md.includes(text), text)
  assert.doesNotMatch(md, /全部已核对/)
  assert.match(packDisclaimer, /authenticity, payment or reimbursability/)
  assert.match(packDisclaimer, /not an accounting-archive certification/)
  assert.match(packDisclaimer, /SHA-256 only detects file change/)
  const book = await workbook(`${root}/${result.files.xlsx}`)
  const mismatch = cells(book.getWorksheet('Rules')).find(row => row[0] === 'amount-tax-total')
  assert.deepEqual(mismatch.slice(0, 2), ['amount-tax-total', 'mismatch'])
  assert.deepEqual(mismatch.slice(5, 8), ['106.00', '108.00', '2.00'])
  assert.ok(cells(book.getWorksheet('Summary')).some(row => row.includes(packDisclaimer)))
  assert.deepEqual(cells(book.getWorksheet('Inventory')).map(row => row.slice(0, 3)), data.inventory.map(entry => [entry.fileId, entry.unit, entry.status]))
})

test('20-digit identifiers survive XLSX string round-trip in raw, normalized and human-confirmed layers', async t => {
  const root = await project(t, ['clean.csv'])
  const data = await load(root, ['clean.csv'])
  const run = reconcile(data, {}, { schemaVersion: 1, entries: [confirmation(data, 'number', number)] })
  await exportPack(root, 'SAMPLE-identifiers', run)
  const book = await workbook(`${root}/SAMPLE-identifiers/report.xlsx`)
  const sheet = book.getWorksheet('Fields')
  const row = sheet.getRows(2, sheet.rowCount - 1).find(row => row.getCell(5).value === 'number')
  assert.equal(row.getCell(6).value, number)
  assert.equal(JSON.parse(row.getCell(8).value).value, number)
  assert.equal(JSON.parse(row.getCell(9).value).raw, number)
  for (const col of [6, 8, 9]) {
    assert.equal(row.getCell(col).type, ExcelJS.ValueType.String)
    assert.equal(row.getCell(col).numFmt, '@')
  }
  const exported = await ingest(`${root}/SAMPLE-identifiers`, [{ path: 'report.xlsx', kind: 'ledger', sheet: 'Fields', mapping: { number: 'Extracted raw' } }])
  assert.ok(exported.records.some(record => record.fields.number.raw === number))
  const report = await json(`${root}/SAMPLE-identifiers/export-report.json`)
  assert.equal(report.records[0].fields.number.confirmed.value, number)
})

test('original copies have relative pointers, exact hashes and bytes; originals are never modified', async t => {
  const root = await project(t, ['mismatch.json', 'clean.csv', 'invoice.xml', 'text.pdf'])
  const names = ['mismatch.json', 'clean.csv', 'invoice.xml', 'text.pdf']
  const before = await Promise.all(names.map(name => readFile(`${root}/${name}`)))
  const data = await load(root, names)
  const result = await exportPack(root, 'SAMPLE-originals', reconcile(data), { includeOriginals: true })
  assert.equal(result.packKind, 'with-originals')
  assert.equal(result.counts.originals, names.length)
  const report = await json(`${root}/${result.files.json}`)
  for (const [i, copy] of report.originals.entries()) {
    assert.match(copy.packPath, /^originals\/\d+\.[a-z]+$/)
    const bytes = await readFile(`${root}/SAMPLE-originals/${copy.packPath}`)
    assert.deepEqual(bytes, before[i])
    assert.equal(hash(bytes), copy.sha256)
    assert.deepEqual(await readFile(`${root}/${names[i]}`), before[i])
  }
  assert.ok(report.evidence.every(e => ['bundled', 'no-source'].includes(e.availability)))
  const md = await readFile(`${root}/SAMPLE-originals/report.md`, 'utf8')
  assert.match(md, /with-originals/)
  assert.match(md, /originals\/0001.json/)
})

test('every non-arithmetic red flag also has expected/actual/difference/rule id text; line evidence and labels survive', async t => {
  const root = await project(t)
  const sample = {
    date: '2026-11-01', number, buyer: 'SAMPLE 示例买方', seller: 'SAMPLE 示例卖方',
    amount: '100.00', tax: '6.00', total: '108.00', currency: 'CNY', materialType: 'SAMPLE 非真实票据',
  }
  const ticket = { fields: sample, lineItems: [{ total: '105.00' }] }
  await writeFile(`${root}/SAMPLE-tickets.json`, JSON.stringify({ schemaVersion: 1, type: 'tickets', label: 'SAMPLE 非真实票据', records: [ticket, ticket, { fields: { ...sample, number: 'SAMPLE-UNMATCHED' } }] }))
  await writeFile(`${root}/SAMPLE-ledger.json`, JSON.stringify({ schemaVersion: 1, type: 'ledger', label: 'SAMPLE 非真实票据', records: [{ fields: { ...sample, number: 'SAMPLE-LEDGER-ONLY' } }] }))
  const data = await ingest(root, [
    { path: 'SAMPLE-tickets.json', kind: 'ticket' }, { path: 'SAMPLE-tickets.json', kind: 'ticket' },
    { path: 'SAMPLE-ledger.json', kind: 'ledger' },
  ])
  const run = reconcile(data, { buyerWhitelist: [], period: { start: '2026-11-02', end: '2026-11-30' } })
  await exportPack(root, 'SAMPLE-all-red-flags', run)
  const report = await json(`${root}/SAMPLE-all-red-flags/export-report.json`)
  assert.ok(report.evidence.some(e => e.lineItem === 0 && e.source?.path === '/records/0/lineItems/0/total'))
  assert.equal(report.records.length, data.records.length)
  const md = await readFile(`${root}/SAMPLE-all-red-flags/report.md`, 'utf8')
  const rules = cells((await workbook(`${root}/SAMPLE-all-red-flags/report.xlsx`)).getWorksheet('Rules'))
  for (const rule of report.mismatches) {
    const expected = rule.expected === null ? '不适用／无法计算' : typeof rule.expected === 'string' ? rule.expected : JSON.stringify(rule.expected)
    assert.ok(md.includes(rule.ruleId), rule.ruleId)
    assert.ok(rules.some(row => row[0] === rule.ruleId && row[1] === 'mismatch' && row[5] === expected && row[6] === (rule.actual ?? '不适用／无法计算') && row[7] === (rule.difference ?? '不适用／无法计算')), rule.ruleId)
  }
  for (const id of ['duplicate-number', 'duplicate-file-hash', 'buyer-whitelist', 'date-period', 'ledger-match', 'line-items-total']) assert.ok(report.mismatches.some(rule => rule.ruleId === id), id)
})

test('real sheet/cell/raw, XML path/raw, PDF page/excerpt and missing-source evidence are preserved', async t => {
  const root = await project(t, ['ledger.xlsx', 'invoice.xml', 'text.pdf'])
  const data = await load(root, ['ledger.xlsx', 'invoice.xml', 'text.pdf'])
  data.records[0].fields.buyer.source = null
  const run = reconcile(data)
  await exportPack(root, 'SAMPLE-evidence', run)
  const report = await json(`${root}/SAMPLE-evidence/export-report.json`)
  const evidence = report.evidence
  assert.ok(evidence.some(e => e.source?.sheet === '示例台账 SAMPLE' && e.source.cell === 'B2' && e.source.raw === number))
  assert.ok(evidence.some(e => e.source?.path === '/Invoice/total' && typeof e.source.raw === 'string'))
  assert.ok(evidence.some(e => e.source?.page === 1 && e.source.excerpt?.includes('Total')))
  assert.ok(evidence.some(e => e.source === null && e.pointer === '无来源／待核' && e.availability === 'no-source'))
  const md = await readFile(`${root}/SAMPLE-evidence/report.md`, 'utf8')
  for (const token of ['示例台账 SAMPLE', 'B2', '/Invoice/total', 'excerpt', '无来源／待核', 'formula-without-cache']) assert.ok(md.includes(token), token)
  const fields = cells((await workbook(`${root}/SAMPLE-evidence/report.xlsx`)).getWorksheet('Fields'))
  assert.ok(fields.some(row => row[10] === '无来源／待核'))
})

test('human correction audit stays separate and rules re-run; forged status and normalized amounts cannot alter exports', async t => {
  const root = await project(t)
  const data = await load(root)
  const run = reconcile(data, {}, { schemaVersion: 1, entries: [confirmation(data, 'total', '108.00', '106.00')] })
  run.fullyConfirmed = true
  run.pendingKeyFields = []
  run.results = []
  run.records[0].fields.total.normalized.value = '999.00'
  await exportPack(root, 'SAMPLE-reviewed', run)
  const report = await json(`${root}/SAMPLE-reviewed/export-report.json`)
  assert.equal(report.status, 'draft')
  assert.ok(report.pendingKeyFields.length)
  assert.equal(report.extracted.records[0].fields.total.raw, '108.00')
  assert.equal(report.records[0].fields.total.normalized.value, '108.00')
  assert.equal(report.records[0].fields.total.confirmed.raw, '106.00')
  assert.deepEqual(report.corrections, run.corrections)
  assert.equal(report.results.find(rule => rule.ruleId === 'amount-tax-total').outcome, 'pass')
  const book = await workbook(`${root}/SAMPLE-reviewed/report.xlsx`)
  const total = cells(book.getWorksheet('Fields')).find(row => row[4] === 'total')
  assert.equal(total[5], '108.00')
  assert.equal(JSON.parse(total[7]).value, '108.00')
  assert.equal(JSON.parse(total[8]).raw, '106.00')
  assert.ok(cells(book.getWorksheet('Corrections')).some(row => row[3] === '"108.00"' && row[4] === '106.00'))
})

test('locally confirmed clean pack still says external not-checked and keeps the disclaimer', async t => {
  const root = await project(t, ['clean.csv'])
  const data = await load(root, ['clean.csv'])
  const corrections = { schemaVersion: 1, entries: fieldNames.map(name => confirmation(data, name, data.records[0].fields[name].raw)) }
  const run = reconcile(data, {}, corrections)
  assert.equal(run.fullyConfirmed, true)
  const result = await exportPack(root, 'SAMPLE-clean', run)
  assert.equal(result.status, 'locally-confirmed')
  const report = await json(`${root}/${result.files.json}`)
  assert.equal(report.externalVerification, 'not-checked')
  assert.equal(report.mismatches.length, 0)
  assert.equal(report.packDisclaimer, packDisclaimer)
})

test('missing/refused inputs remain in summary inventory; originals export fails rather than silently omitting a file', async t => {
  const root = await project(t, ['mismatch.json', 'sample.ofd'])
  const data = await load(root, ['mismatch.json', 'missing.json', 'sample.ofd'])
  await exportPack(root, 'SAMPLE-exceptions', reconcile(data))
  const report = await json(`${root}/SAMPLE-exceptions/export-report.json`)
  assert.deepEqual(report.extracted.files, data.files)
  assert.deepEqual(report.extracted.inventory, data.inventory)
  assert.equal(report.status, 'draft')
  const md = await readFile(`${root}/SAMPLE-exceptions/report.md`, 'utf8')
  assert.match(md, /sample\.ofd.*不支持 OFD.*请提供/)
  assert.match(md, /missing\.json.*文件不存在或无法读取.*请检查/)
  const book = await workbook(`${root}/SAMPLE-exceptions/report.xlsx`)
  assert.ok(cells(book.getWorksheet('Inventory')).some(row => row[3] === 'ofd-out-of-mvp-use-xml-pdf-or-ocr-json' && row[8].includes('不支持 OFD')))
  assert.ok(cells(book.getWorksheet('Files')).some(row => row[1] === 'missing.json' && row[7].includes('读取权限')))
  await assert.rejects(exportPack(root, 'SAMPLE-failed', reconcile(data), { includeOriginals: true }), /original-hash-unavailable/)
  assert.deepEqual((await readdir(root)).sort(), ['SAMPLE-exceptions', 'mismatch.json', 'sample.ofd'].sort())
})

test('read/write path confinement rejects traversal, absolute paths and symlink escape', async t => {
  withoutFdPaths(t)
  const root = await project(t)
  const outside = await project(t)
  const run = reconcile(await load(root))
  await symlink(outside, `${root}/escape`)
  await symlink(`${outside}/mismatch.json`, `${root}/linked.json`)
  for (const directory of ['../SAMPLE-outside', `${outside}/pack`, 'escape/pack', 'escape', '.', 'a/../pack', 'bad\0path']) {
    await assert.rejects(exportPack(root, directory, run))
  }
  for (const path of ['../mismatch.json', `${outside}/mismatch.json`, 'escape/mismatch.json', 'linked.json']) {
    const forged = structuredClone(run)
    forged.extracted.files[0].path = path
    await assert.rejects(exportPack(root, 'SAMPLE-forbidden', forged, { includeOriginals: true }))
  }
  assert.deepEqual(await readdir(outside), ['mismatch.json'])
  assert.ok(!(await readdir(root)).some(name => name.startsWith('.invoice-gate-')))
})

test('existing packs are immutable and late XLSX failure leaves no partial pack or staging directory', async t => {
  withoutFdPaths(t)
  const root = await project(t)
  const data = await load(root)
  const run = reconcile(data)
  await exportPack(root, 'SAMPLE-good', run)
  const snapshot = await Promise.all(['report.md', 'report.xlsx', 'export-report.json'].map(name => readFile(`${root}/SAMPLE-good/${name}`)))
  await assert.rejects(exportPack(root, 'SAMPLE-good', run), /export-directory-exists/)
  const long = structuredClone(data)
  long.records[0].label = 'SAMPLE ' + 'x'.repeat(32768)
  await assert.rejects(exportPack(root, 'SAMPLE-late-failure', reconcile(long)), /xlsx-cell-limit-exceeded/)
  await mkdir(`${root}/SAMPLE-empty`)
  await assert.rejects(exportPack(root, 'SAMPLE-empty', run), /export-directory-exists/)
  assert.deepEqual((await readdir(root)).sort(), ['SAMPLE-empty', 'SAMPLE-good', 'mismatch.json'].sort())
  for (const [i, name] of ['report.md', 'report.xlsx', 'export-report.json'].entries()) assert.deepEqual(await readFile(`${root}/SAMPLE-good/${name}`), snapshot[i])
})

test('changed or removed originals abort copying and preserve a previous good pack', async t => {
  withoutFdPaths(t)
  const root = await project(t)
  const run = reconcile(await load(root))
  await exportPack(root, 'SAMPLE-good', run, { includeOriginals: true })
  const before = await readFile(`${root}/SAMPLE-good/export-report.json`)
  await writeFile(`${root}/mismatch.json`, 'SAMPLE changed synthetic file')
  await assert.rejects(exportPack(root, 'SAMPLE-changed', run, { includeOriginals: true }), /original-changed-since-ingest/)
  await rm(`${root}/mismatch.json`)
  await assert.rejects(exportPack(root, 'SAMPLE-removed', run, { includeOriginals: true }), /input-unreadable/)
  assert.deepEqual(await readFile(`${root}/SAMPLE-good/export-report.json`), before)
  assert.deepEqual(await readdir(root), ['SAMPLE-good'])
})

test('report escaping and XLSX text cells keep literal formulas inert without dropping raw content', async t => {
  const root = await project(t)
  const data = await load(root)
  const raw = '=HYPERLINK("https://invalid.example", "SAMPLE") | <script>\n```'
  data.records[0].fields.buyer.raw = raw
  data.records[0].fields.buyer.source = { file: 'mismatch.json', raw, path: '/records/0/fields/buyer' }
  await exportPack(root, 'SAMPLE-literal', reconcile(data))
  const report = await json(`${root}/SAMPLE-literal/export-report.json`)
  assert.equal(report.extracted.records[0].fields.buyer.raw, raw)
  const md = await readFile(`${root}/SAMPLE-literal/report.md`, 'utf8')
  assert.match(md, /&#124; &lt;script&gt;/)
  assert.doesNotMatch(md, /<script>|```/)
  const book = await workbook(`${root}/SAMPLE-literal/report.xlsx`)
  for (const sheet of book.worksheets) sheet.eachRow(row => row.eachCell(cell => assert.equal(cell.type, ExcelJS.ValueType.String)))
})

test('export is local with a compact return value, repeatable JSON/Markdown, and validated options/version', async t => {
  const root = await project(t)
  const run = reconcile(await load(root))
  for (const [object, key] of [[http, 'request'], [https, 'request'], [net, 'connect'], [net, 'createConnection'], [globalThis, 'fetch']]) {
    t.mock.method(object, key, () => { throw new Error('network forbidden') })
  }
  await exportPack(root, 'SAMPLE-one', run)
  await exportPack(root, 'SAMPLE-two', run)
  for (const name of ['export-report.json', 'report.md']) assert.deepEqual(await readFile(`${root}/SAMPLE-one/${name}`), await readFile(`${root}/SAMPLE-two/${name}`))
  for (const options of [null, [], { includeOriginals: 'yes' }, { extra: true }]) await assert.rejects(exportPack(root, 'SAMPLE-invalid', run, options), /invalid-export-options/)
  await assert.rejects(exportPack(root, 'SAMPLE-invalid', { ...run, rulesVersion: 'unknown' }), /unsupported-rules-version/)
})

test('fd paths disabled: nested export copies hash-checked originals and publishes all three private files', async t => {
  withoutFdPaths(t)
  const root = await project(t)
  await mkdir(root + '/nested')
  await mkdir(root + '/outputs')
  await copyFile(root + '/mismatch.json', root + '/nested/SAMPLE.json')
  await symlink('nested', root + '/local')
  const before = await readFile(root + '/nested/SAMPLE.json'), cwd = process.cwd()
  const run = reconcile(await load(root, ['local/SAMPLE.json']))
  const pack = await exportPack(root, 'outputs/SAMPLE-pack', run, { includeOriginals: true })
  const report = await json(root + '/' + pack.files.json)
  assert.equal(report.mismatches[0].differenceFen, '200')
  assert.equal(report.originals[0].sha256, hash(before))
  assert.deepEqual(await readFile(root + '/outputs/SAMPLE-pack/' + report.originals[0].packPath), before)
  assert.deepEqual(await readFile(root + '/nested/SAMPLE.json'), before)
  for (const name of Object.values(pack.files)) assert.equal((await stat(root + '/' + name)).mode & 0o777, 0o600)
  assert.match(await readFile(root + '/' + pack.files.markdown, 'utf8'), /DRAFT.*草稿/)
  const book = await workbook(root + '/' + pack.files.xlsx)
  assert.ok(cells(book.getWorksheet('Fields')).some(row => row.includes(number)))
  assert.equal(process.cwd(), cwd)
})

test('fd paths disabled: export refuses parent substitution before entry and relocation before publish', async t => {
  withoutFdPaths(t)
  for (const when of ['before', 'moved-before', 'during-copy', 'after']) {
    const root = await project(t), outside = await project(t)
    await mkdir(root + '/nested')
    const run = reconcile(await load(root))
    const hook = childHook(t, `(() => {
      const fs = require('node:fs')
      const replace = () => { fs.renameSync(${JSON.stringify(root + '/nested')}, ${JSON.stringify(outside + '/pinned')}); fs.symlinkSync(${JSON.stringify(outside)} + (${JSON.stringify(when)} === 'moved-before' ? '/pinned' : ''), ${JSON.stringify(root + '/nested')}) }
      if (${JSON.stringify(when)} === 'during-copy') {
        if (process.argv[1].endsWith('mismatch.json')) { fs.renameSync(${JSON.stringify(root + '/nested')}, ${JSON.stringify(outside + '/pinned')}); fs.mkdirSync(${JSON.stringify(root + '/nested')}) }
      } else if (${JSON.stringify(when)} !== 'after') {
        const chdir = process.chdir.bind(process)
        process.chdir = part => { if (part === 'nested') replace(); chdir(part) }
      } else {
        const write = fs.writeFileSync
        fs.writeFileSync = (name, ...args) => { const result = write(name, ...args); if (String(name).endsWith('/report.xlsx')) replace(); return result }
      }
    })()`, when !== 'during-copy')
    await assert.rejects(exportPack(root, 'nested/SAMPLE-pack', run, { includeOriginals: true }), /path-outside-project/)
    hook.mock.restore()
    assert.deepEqual(await readdir(outside + '/pinned'), [])
    assert.deepEqual((await readdir(outside)).sort(), ['mismatch.json', 'pinned'])
  }
})

test('fd paths disabled: copied-original reads refuse ancestor substitution and stay pinned after entry', async t => {
  withoutFdPaths(t)
  for (const when of ['before', 'after']) {
    const root = await project(t), outside = await project(t)
    await mkdir(root + '/nested')
    await copyFile(root + '/mismatch.json', root + '/nested/SAMPLE.json')
    await writeFile(outside + '/SAMPLE.json', 'SAMPLE OUTSIDE 非真实票据')
    const before = await readFile(root + '/nested/SAMPLE.json')
    const run = reconcile(await load(root, ['nested/SAMPLE.json']))
    const hook = childHook(t, `(() => {
      const fs = require('node:fs'), chdir = process.chdir.bind(process)
      process.chdir = part => {
        if (part !== 'nested') return chdir(part)
        if (${JSON.stringify(when)} === 'after') chdir(part)
        fs.renameSync(${JSON.stringify(root + '/nested')}, ${JSON.stringify(root + '/pinned')})
        fs.symlinkSync(${JSON.stringify(outside)}, ${JSON.stringify(root + '/nested')})
        if (${JSON.stringify(when)} === 'before') chdir(part)
      }
    })()`)
    if (when === 'before') await assert.rejects(exportPack(root, 'SAMPLE-pack', run, { includeOriginals: true }), /path-outside-project/)
    else {
      await exportPack(root, 'SAMPLE-pack', run, { includeOriginals: true })
      assert.deepEqual(await readFile(root + '/SAMPLE-pack/originals/0001.json'), before)
    }
    hook.mock.restore()
    assert.deepEqual(await readFile(root + '/pinned/SAMPLE.json'), before)
    assert.equal(await readFile(outside + '/SAMPLE.json', 'utf8'), 'SAMPLE OUTSIDE 非真实票据')
  }
})

test('fd paths disabled: late publish failure cleans staged exports and preserves a previous good pack', async t => {
  withoutFdPaths(t)
  const root = await project(t), run = reconcile(await load(root))
  await exportPack(root, 'SAMPLE-good', run, { includeOriginals: true })
  const before = await readFile(root + '/SAMPLE-good/report.xlsx')
  childHook(t, `require('node:fs').renameSync = () => { throw new Error('SAMPLE injected publish failure') }`, true)
  await assert.rejects(exportPack(root, 'SAMPLE-failed', run, { includeOriginals: true }), /SAMPLE injected publish failure/)
  assert.deepEqual(await readFile(root + '/SAMPLE-good/report.xlsx'), before)
  assert.deepEqual((await readdir(root)).sort(), ['SAMPLE-good', 'mismatch.json'])
})
