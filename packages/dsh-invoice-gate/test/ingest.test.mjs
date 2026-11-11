import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import childProcess from 'node:child_process'
import fs from 'node:fs'
import fsPromises from 'node:fs/promises'
import { chmod, copyFile, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { syncBuiltinESMExports } from 'node:module'
import { fileURLToPath } from 'node:url'
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import { ingest, fieldNames } from '../index.js'

const fixtures = fileURLToPath(new URL('./fixtures/', import.meta.url))
const number = '12345678901234567890'
const mapping = Object.fromEntries(fieldNames.map((name, i) => [name, ['开票日期', '发票号码', '购买方', '销售方', '金额', '税额', '价税合计', '币种', '材料类型'][i]]))
const input = (path, extra = {}) => ({ path, kind: 'ticket', ...extra })
async function temp(t) {
  await mkdir('.tmp', { recursive: true })
  const root = await mkdtemp(fileURLToPath(new URL('../.tmp/ingest-', import.meta.url)))
  t.after(() => rm(root, { recursive: true, force: true }))
  return root
}
const hash = data => createHash('sha256').update(data).digest('hex')
function readerHook(t, script) {
  const spawn = childProcess.spawn
  return t.mock.method(childProcess, 'spawn', (command, args, options) => {
    const injected = [...args]
    const index = injected.indexOf('--eval') + 1
    assert.ok(index > 0)
    injected[index] = script + '\n' + injected[index]
    return spawn(command, injected, options)
  })
}

test('Chinese CSV mapping, blank amounts, strings and logical row inventory', async t => {
  const result = await ingest(fixtures, [input('clean.csv', { mapping, kind: 'ledger' })])
  assert.equal(result.files[0].status, 'parsed')
  const record = result.records[0]
  assert.equal(record.kind, 'ledger')
  assert.equal(record.fields.number.raw, number)
  assert.equal(typeof record.fields.number.raw, 'string')
  assert.equal(record.fields.amount.raw, '100.00')
  assert.equal(record.fields.number.source.row, 2)
  assert.equal(record.fields.date.review, 'pending')
  assert.deepEqual(result.inventory.filter(e => e.unit === 'row').map(e => [e.row, e.status]), [[1, 'skipped'], [2, 'parsed']])
  const root = await temp(t)
  await writeFile(root + '/rows.csv', '票号,金额,说明\r\n00001,,"SAMPLE,\n非真实票据"\r\n,,\r\n00002,0.00,SAMPLE\r\n')
  const rows = await ingest(root, [input('rows.csv', { mapping: { number: '票号', amount: '金额' } })])
  assert.equal(rows.records.length, 2)
  assert.equal(rows.records[0].fields.number.raw, '00001')
  assert.equal(rows.records[0].fields.amount.raw, '')
  assert.equal(rows.records[1].fields.amount.raw, '0.00')
  assert.equal(rows.inventory.find(e => e.row === 3).reason, 'blank-row')
})

test('mapping is mandatory and ambiguous/missing columns refuse every row', async t => {
  for (const map of [undefined, {}, { amount: '不存在' }, { unknown: '金额' }]) {
    const result = await ingest(fixtures, [input('clean.csv', { mapping: map })])
    assert.equal(result.records.length, 0)
    assert.equal(result.files[0].status, 'refused')
    assert.equal(result.inventory.filter(e => e.unit === 'row').length, 2)
  }
  const root = await temp(t)
  await writeFile(root + '/duplicate.csv', '金额,金额\n100,100\n')
  const result = await ingest(root, [input('duplicate.csv', { mapping: { amount: '金额' } })])
  assert.ok(result.inventory.some(e => e.reason === 'missing-or-ambiguous-mapped-header'))
})

test('UTF-8 with/without BOM, GBK and four-byte GB18030 preserve Chinese fields, quoted CSV and text ids', async t => {
  const root = await temp(t)
  const utf8 = (await readFile(fixtures + 'clean.csv', 'utf8')).replace(/^\uFEFF/, '')
  await writeFile(root + '/utf8.csv', utf8)
  await writeFile(root + '/utf8-bom.csv', '\uFEFF' + utf8)
  await writeFile(root + '/utf8-four-byte.csv', utf8.replace('SAMPLE 示例买方', 'SAMPLE 示例买方𠮷'))
  for (const name of ['gbk.csv', 'gb18030.csv']) await copyFile(fixtures + name, root + '/' + name)
  await writeFile(root + '/ascii.csv', 'Number,Amount,Tax,Total,Label\n12345678901234567890,,0.00,0.00,"SAMPLE, non-real invoice"\n')
  const names = ['utf8.csv', 'utf8-bom.csv', 'gbk.csv', 'utf8-four-byte.csv', 'gb18030.csv', 'ascii.csv']
  const before = await Promise.all(names.map(name => readFile(root + '/' + name)))
  const result = await ingest(root, names.map(name => input(name, { mapping: name === 'ascii.csv'
    ? { number: 'Number', amount: 'Amount', tax: 'Tax', total: 'Total', materialType: 'Label' } : mapping })))
  assert.ok(result.files.every(file => file.status === 'parsed'))
  assert.deepEqual(result.inventory.filter(e => e.unit === 'file').map(e => e.encoding), ['utf-8', 'utf-8', 'gb18030', 'utf-8', 'gb18030', 'utf-8'])
  const values = record => Object.fromEntries(fieldNames.map(name => [name, record.fields[name].raw]))
  assert.deepEqual(values(result.records[1]), values(result.records[0]))
  assert.deepEqual(values(result.records[2]), values(result.records[0]))
  assert.deepEqual(values(result.records[4]), values(result.records[3]))
  assert.equal(result.records[4].fields.buyer.raw, 'SAMPLE 示例买方𠮷')
  for (const record of result.records) assert.equal(record.fields.number.raw, number)
  assert.equal(result.records[5].fields.amount.raw, '')
  assert.equal(result.records[5].fields.materialType.raw, 'SAMPLE, non-real invoice')
  for (const [i, name] of names.entries()) {
    assert.equal(result.files[i].sha256, hash(before[i]))
    assert.deepEqual(await readFile(root + '/' + name), before[i])
  }
})

test('invalid mixed CSV bytes and invalid UTF-8 after a BOM are refused, hashed and inventoried', async t => {
  const root = await temp(t)
  const valid = Buffer.from('Number,Label\n12345678901234567890,SAMPLE 示例 非真实票据')
  await writeFile(root + '/mixed.csv', Buffer.concat([valid, Buffer.from([0xff, 0x81])]))
  await writeFile(root + '/bom-gbk.csv', Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), await readFile(fixtures + 'gbk.csv')]))
  await writeFile(root + '/gbk.json', Buffer.concat([Buffer.from('{"SAMPLE":"'), Buffer.from([0xca, 0xbe, 0xc0, 0xfd]), Buffer.from('"}')] ))
  const result = await ingest(root, ['mixed.csv', 'bom-gbk.csv', 'gbk.json'].map(name => input(name, { mapping })))
  assert.equal(result.records.length, 0)
  assert.equal(result.files.length, 3)
  assert.ok(result.files.every(file => file.sha256))
  assert.deepEqual(result.inventory.slice(0, 2).map(e => [e.unit, e.status, e.reason, e.encoding]), [
    ['file', 'refused', 'csv-encoding-invalid-utf8-or-gb18030', undefined],
    ['file', 'refused', 'csv-encoding-invalid-utf8-or-gb18030', undefined],
  ])
  assert.equal(result.files[2].status, 'failed')
})

test('XLSX preserves text identifiers, cached values and formula-only fields; inventories blank and unselected rows', async () => {
  const result = await ingest(fixtures, [input('ledger.xlsx', { kind: 'ledger', mapping, sheet: '示例台账 SAMPLE' })])
  assert.equal(result.files[0].status, 'partial')
  assert.equal(result.records.length, 5)
  assert.equal(result.records[0].fields.number.raw, number)
  assert.equal(result.records[0].fields.number.source.cell, 'B2')
  assert.equal(result.records[0].fields.number.source.sheet, '示例台账 SAMPLE')
  assert.equal(result.records[1].fields.amount.raw, '')
  assert.equal(result.records[2].fields.total.issue, 'formula-without-cache')
  assert.equal(result.records[2].fields.total.raw, null)
  assert.equal(result.records[2].fields.total.review, 'unreadable')
  assert.equal(result.records[2].fields.number.issue, 'identifier-must-be-text')
  assert.equal(result.records[3].fields.total.raw, '106')
  assert.equal(result.records[3].fields.total.source.formula, '100+6')
  assert.ok(result.inventory.some(e => e.row === 6 && e.reason === 'blank-row'))
  assert.ok(result.inventory.some(e => e.sheet === '跳过 SAMPLE' && e.unit === 'row' && e.reason === 'sheet-not-selected'))
})

test('JSON and OCR schema preserve raw values, supplied coordinates, labels and line items', async () => {
  const result = await ingest(fixtures, [input('tickets.json'), input('ocr.json'), input('mismatch.json')])
  assert.equal(result.records.length, 4)
  for (const file of result.files) assert.equal(file.status, 'parsed')
  assert.equal(result.records[0].fields.number.raw, number)
  assert.equal(result.records[0].lineItems[0].total.raw, '106.00')
  assert.match(result.records[0].label, /非真实票据/)
  const ocr = result.records[2].fields.total
  assert.equal(ocr.raw, '106.00')
  assert.equal(ocr.source.path, '/records/0/fields/total/raw')
  assert.equal(ocr.source.page, 1)
  assert.deepEqual(ocr.source.box, [0, 0, 100, 20])
  assert.equal(result.records[0].fields.total.source.page, undefined)
  assert.equal(result.records[3].fields.amount.raw, '100.00')
  assert.equal(result.records[3].fields.tax.raw, '6.00')
  assert.equal(result.records[3].fields.total.raw, '108.00')
})

test('invalid JSON rows are inventoried independently; amounts/ids must never be numeric JSON', async t => {
  const root = await temp(t)
  await writeFile(root + '/rows.json', JSON.stringify({ schemaVersion: 1, type: 'ocr', records: [
    { fields: { number, amount: '' } }, { fields: { number: 123 } },
    { fields: { amount: { raw: '1.00', page: 0 } } },
    { fields: { amount: { raw: '1.00', box: [2, 0, 1, 2] } } },
    { fields: { total: '106.00' }, lineItems: [null] },
  ] }))
  const result = await ingest(root, [input('rows.json')])
  assert.equal(result.files[0].status, 'partial')
  assert.equal(result.records.length, 1)
  assert.equal(result.records[0].fields.amount.raw, '')
  assert.equal(result.records[0].fields.tax.raw, null)
  assert.equal(result.records[0].fields.tax.source, null)
  assert.equal(result.inventory.filter(e => e.unit === 'row' && e.status === 'refused').length, 4)
})

test('fixture-backed XML preserves ids and paths, refuses unknown structures and DTDs', async t => {
  const result = await ingest(fixtures, [input('invoice.xml'), input('unknown.xml')])
  assert.equal(result.records.length, 1)
  assert.equal(result.records[0].fields.number.raw, number)
  assert.equal(result.records[0].fields.number.source.path, '/Invoice/number')
  assert.equal(result.records[0].lineItems[0].total.raw, '106.00')
  assert.equal(result.files[1].reason, 'unknown-xml-structure')
  const root = await temp(t)
  await writeFile(root + '/entities.xml', '<!DOCTYPE Invoice [<!ENTITY secret SYSTEM "file:///etc/passwd">]><Invoice schemaVersion="1"><number>&secret;</number></Invoice>')
  const refused = await ingest(root, [input('entities.xml')])
  assert.equal(refused.files[0].reason, 'xml-dtd-and-entities-refused')
})

test('PDF text yields labelled amounts and page excerpts; no-text pages are refused individually', async () => {
  const result = await ingest(fixtures, [input('text.pdf'), input('scan.pdf'), input('mixed.pdf')])
  assert.equal(result.records.length, 2)
  assert.equal(result.files[0].status, 'parsed')
  assert.equal(result.records[0].fields.number.raw, number)
  assert.equal(result.records[0].fields.amount.raw, '100.00')
  assert.equal(result.records[0].fields.tax.raw, '6.00')
  assert.equal(result.records[0].fields.total.raw, '106.00')
  assert.equal(result.records[0].fields.total.source.page, 1)
  assert.match(result.records[0].fields.total.source.excerpt, /Total: 106.00/)
  assert.equal(result.records[0].fields.total.source.box, undefined)
  assert.equal(result.files[1].status, 'refused')
  assert.equal(result.files[2].status, 'partial')
  const pages = result.inventory.filter(e => e.unit === 'page')
  assert.deepEqual(pages.map(e => [e.page, e.status]), [[1, 'parsed'], [1, 'refused'], [1, 'parsed'], [2, 'refused']])
  assert.equal(pages[1].reason, 'no-text-layer-provide-ocr-json')
})

test('OFD and raster are clearly refused; explicit OCR sidecars retain both originals and provenance', async () => {
  const refused = await ingest(fixtures, [input('sample.ofd'), input('scan.png')])
  assert.match(refused.files[0].reason, /ofd-out-of-mvp/)
  assert.equal(refused.inventory.find(e => e.unit === 'page').reason, 'raster-image-provide-ocr-json')
  const result = await ingest(fixtures, [input('scan.pdf', { ocrJson: 'ocr.json' }), input('scan.png', { ocrJson: 'ocr.json' })])
  assert.equal(result.files.length, 4)
  assert.ok(result.files.every(file => file.sha256 && file.status === 'parsed'))
  assert.equal(result.records.length, 2)
  assert.equal(result.records[0].originalFileId, 'file-1')
  assert.equal(result.records[0].fileId, 'file-1:ocr')
  assert.equal(result.records[0].fields.number.source.file, 'ocr.json')
  assert.ok(result.inventory.filter(e => e.unit === 'page').every(e => e.reason === 'explicit-ocr-sidecar'))
  const missing = await ingest(fixtures, [input('scan.png', { ocrJson: 'missing.json' })])
  assert.equal(missing.files[0].reason, 'ocr-sidecar-failed')
  assert.equal(missing.files[1].status, 'failed')
})

test('PDF duplicate labels are unreadable and blank labels never consume the following line', async () => {
  const result = await ingest(fixtures, [input('edge-labels.pdf')])
  assert.equal(result.files[0].status, 'partial')
  assert.equal(result.records[0].fields.amount.raw, null)
  assert.equal(result.records[0].fields.amount.issue, 'ambiguous-pdf-label')
  assert.equal(result.records[0].fields.tax.raw, '')
  assert.equal(result.records[0].fields.total.raw, '108.00')
})

test('explicit sidecars are inventoried even when the original is unreadable or the combination is unsupported', async () => {
  const result = await ingest(fixtures, [input('missing.pdf', { ocrJson: 'ocr.json' }), input('clean.csv', { ocrJson: 'ocr.json', mapping })])
  assert.equal(result.files.length, 4)
  assert.equal(result.files[0].status, 'failed')
  assert.equal(result.files[1].status, 'parsed')
  assert.equal(result.files[2].reason, 'ocr-sidecar-only-for-pdf-or-images')
  assert.equal(result.files[3].reason, 'ocr-sidecar-only-for-pdf-or-images')
  assert.equal(result.inventory.filter(e => e.unit === 'file').length, 4)
  const wrongSchema = await ingest(fixtures, [input('scan.pdf', { ocrJson: 'tickets.json' })])
  assert.equal(wrongSchema.files[1].reason, 'sidecar-requires-ocr-schema')
})

test('JS callers receive safe input validation and missing sheets remain inventoried', async () => {
  await assert.rejects(ingest(fixtures, null), /input-list-required/)
  const result = await ingest(fixtures, [null, input('clean.csv', { kind: 'unknown' }), input('ledger.xlsx', { mapping, sheet: 'missing SAMPLE' })])
  assert.equal(result.files.length, 3)
  assert.equal(result.files[0].reason, 'invalid-input')
  assert.equal(result.files[1].reason, 'invalid-input-kind')
  assert.equal(result.files[2].status, 'refused')
  assert.ok(result.inventory.some(e => e.reason === 'selected-sheet-not-found'))
  assert.equal(result.inventory.filter(e => e.unit === 'file').length, 3)
})

test('every original hash matches, duplicate hashes survive, originals stay bit-identical and ingest is deterministic', async () => {
  const paths = ['clean.csv', 'ledger.xlsx', 'tickets.json', 'ocr.json', 'text.pdf', 'scan.pdf', 'invoice.xml', 'unknown.xml', 'sample.ofd', 'scan.png', 'duplicate-a.csv', 'duplicate-b.csv']
  const before = await Promise.all(paths.map(path => readFile(fixtures + path)))
  const inputs = paths.map(path => input(path, { mapping }))
  const first = await ingest(fixtures, inputs)
  assert.deepEqual(await ingest(fixtures, inputs), first)
  for (const [i, path] of paths.entries()) {
    assert.equal(first.files[i].sha256, hash(before[i]))
    assert.deepEqual(await readFile(fixtures + path), before[i])
    assert.ok(first.inventory.some(e => e.fileId === first.files[i].id && e.unit === 'file'))
  }
  assert.equal(first.files.at(-1).sha256, first.files.at(-2).sha256)
  assert.equal(first.files.length, paths.length)
})

test('path traversal, absolute paths, file/directory symlink escapes and sidecar escapes cannot read outside project', async t => {
  const root = await temp(t)
  await mkdir(root + '/project')
  await copyFile(fixtures + 'tickets.json', root + '/outside.json')
  await copyFile(fixtures + 'scan.png', root + '/project/scan.png')
  await symlink(root + '/outside.json', root + '/project/link.json')
  await symlink(root, root + '/project/dir')
  const result = await ingest(root + '/project', [input('../outside.json'), input(root + '/outside.json'), input('link.json'), input('dir/outside.json'), input('scan.png', { ocrJson: '../outside.json' })])
  assert.equal(result.records.length, 0)
  for (const file of result.files.filter(f => f.path !== 'scan.png')) {
    assert.equal(file.sha256, null)
    assert.equal(file.reason, 'path-outside-project')
  }
  assert.equal(result.files.find(f => f.path === 'scan.png').reason, 'ocr-sidecar-failed')
})

test('with both fd-path filesystems unavailable, nested reads stay confined, hashed and read-only', async t => {
  const root = await temp(t)
  await mkdir(root + '/project/nested', { recursive: true })
  const before = await readFile(fixtures + 'clean.csv')
  await writeFile(root + '/project/nested/SAMPLE.csv', before)
  await writeFile(root + '/outside.csv', before)
  await symlink(root, root + '/project/escape')
  await symlink(root + '/outside.csv', root + '/project/link.csv')
  await symlink('nested', root + '/project/local')
  const denyFdPath = path => /^\/(?:proc\/self\/fd|dev\/fd)(?:\/|$)/.test(String(path))
  const mocks = []
  for (const object of [fs, fsPromises]) for (const name of ['realpath', 'readlink', 'open', 'realpathSync', 'readlinkSync', 'openSync']) {
    if (typeof object[name] !== 'function') continue
    const original = object[name]
    mocks.push(t.mock.method(object, name, function (path, ...args) {
      if (denyFdPath(path)) throw Object.assign(new Error('fd paths unavailable'), { code: 'ENOENT' })
      return original.call(this, path, ...args)
    }))
  }
  syncBuiltinESMExports()
  t.after(() => { for (const mock of mocks) mock.mock.restore(); syncBuiltinESMExports() })
  assert.throws(() => fs.realpathSync('/proc/self/fd/0'), /unavailable/)
  assert.throws(() => fs.realpathSync('/dev/fd/0'), /unavailable/)
  readerHook(t, `(() => {
    const fs = require('node:fs')
    for (const name of ['realpathSync', 'readlinkSync', 'openSync']) {
      const original = fs[name]
      fs[name] = (path, ...args) => {
        if (/^\\/(?:proc\\/self\\/fd|dev\\/fd)(?:\\/|$)/.test(String(path))) throw Object.assign(new Error('fd paths unavailable'), { code: 'ENOENT' })
        return original(path, ...args)
      }
    }
    require('node:assert/strict').throws(() => fs.realpathSync('/proc/self/fd/3'))
    require('node:assert/strict').throws(() => fs.realpathSync('/dev/fd/3'))
  })()`)
  const cwd = process.cwd()
  const result = await ingest(root + '/project', [
    input('nested/SAMPLE.csv', { mapping }), input('local/SAMPLE.csv', { mapping }),
    ...['../outside.csv', root + '/outside.csv', 'escape/outside.csv', 'link.csv', 'nested/../../outside.csv'].map(path => input(path, { mapping })),
  ])
  assert.equal(process.cwd(), cwd)
  assert.equal(result.records.length, 2)
  assert.ok(result.records.every(record => record.fields.number.raw === number))
  assert.ok(result.files.slice(0, 2).every(file => file.sha256 === hash(before) && file.status === 'parsed'))
  assert.ok(result.files.slice(2).every(file => file.sha256 === null && file.reason === 'path-outside-project'))
  assert.equal(result.inventory.filter(e => e.unit === 'file').length, 7)
  assert.deepEqual(await readFile(root + '/project/nested/SAMPLE.csv'), before)
  assert.deepEqual(await readFile(root + '/outside.csv'), before)
})

test('ancestor replacement before chdir is refused; replacement after chdir cannot redirect a read', async t => {
  const root = await temp(t)
  await mkdir(root + '/outside')
  await writeFile(root + '/outside/SAMPLE.csv', 'Number,Label\nSAMPLE-OUTSIDE,非真实票据\n')
  for (const when of ['before', 'after']) {
    const project = root + '/' + when
    await mkdir(project + '/nested', { recursive: true })
    const before = await readFile(fixtures + 'clean.csv')
    await writeFile(project + '/nested/SAMPLE.csv', before)
    const hook = readerHook(t, `(() => {
      const fs = require('node:fs')
      const path = require('node:path')
      const chdir = process.chdir.bind(process)
      process.chdir = part => {
        if (part !== 'nested') return chdir(part)
        const parent = process.cwd()
        if (${JSON.stringify(when)} === 'after') chdir(part)
        fs.renameSync(path.join(parent, part), path.join(parent, 'pinned'))
        fs.symlinkSync(path.join(parent, '../outside'), path.join(parent, part))
        if (${JSON.stringify(when)} === 'before') chdir(part)
      }
    })()`)
    const result = await ingest(project, [input('nested/SAMPLE.csv', { mapping })])
    hook.mock.restore()
    if (when === 'before') {
      assert.equal(result.records.length, 0)
      assert.equal(result.files[0].sha256, null)
      assert.equal(result.files[0].status, 'refused')
    } else {
      assert.equal(result.files[0].status, 'parsed')
      assert.equal(result.files[0].sha256, hash(before))
      assert.equal(result.records[0].fields.number.raw, number)
    }
    assert.deepEqual(await readFile(project + '/pinned/SAMPLE.csv'), before)
  }
})

test('missing, unreadable, malformed and truncated inputs are inventoried without exposing contents', async t => {
  const root = await temp(t)
  await writeFile(root + '/private.json', 'SAMPLE-PRIVATE must not appear in errors')
  await chmod(root + '/private.json', 0)
  await writeFile(root + '/bad.json', '{"SAMPLE-PRIVATE":')
  await writeFile(root + '/bad.xml', '<Invoice><SAMPLE-PRIVATE>')
  await writeFile(root + '/bad.xlsx', 'SAMPLE-PRIVATE truncated zip')
  await writeFile(root + '/bad.pdf', '%PDF-1.4 SAMPLE-PRIVATE')
  await writeFile(root + '/bad.csv', '票号,金额\nSAMPLE-OK,1.00\nSAMPLE-PRIVATE,"1')
  const result = await ingest(root, ['missing.json', 'private.json', 'bad.json', 'bad.xml', 'bad.xlsx', 'bad.pdf', 'bad.csv'].map(path => input(path, { mapping: { number: '票号', amount: '金额' } })))
  assert.equal(result.files.length, 7)
  assert.ok(result.files.every(file => ['failed', 'refused', 'partial'].includes(file.status)))
  assert.equal(result.files[1].sha256, null)
  assert.equal(result.files[5].reason, 'truncated-pdf')
  assert.ok(result.inventory.some(e => e.row === 3 && e.reason === 'truncated-csv'))
  assert.equal(result.records[0].fields.number.raw, 'SAMPLE-OK')
  assert.ok(!JSON.stringify(result.inventory).includes('SAMPLE-PRIVATE'))
  assert.ok(!JSON.stringify(result.files).includes('SAMPLE-PRIVATE'))
})

test('ledger and ticket fixtures share string ids; parser leaves unmatched sides and mismatches intact', async () => {
  const result = await ingest(fixtures, [input('ledger.csv', { kind: 'ledger', mapping }), input('tickets.json'), input('mismatch.json')])
  assert.deepEqual(result.records.map(r => [r.kind, r.fields.number.raw]), [
    ['ledger', number], ['ledger', 'SAMPLE-LEDGER-ONLY'], ['ticket', number], ['ticket', 'SAMPLE-TICKET-ONLY'], ['ticket', number],
  ])
  assert.equal(result.records.at(-1).fields.total.raw, '108.00')
})

test('ingest needs no outbound network or model; macros, links and formulas are inert', async t => {
  const deny = () => { assert.fail('unexpected outbound network') }
  t.mock.method(globalThis, 'fetch', deny)
  t.mock.method(http, 'request', deny)
  t.mock.method(https, 'request', deny)
  t.mock.method(net.Socket.prototype, 'connect', deny)
  const result = await ingest(fixtures, [input('ledger.xlsx', { mapping }), input('text.pdf'), input('invoice.xml'), input('ocr.json')])
  assert.ok(result.records.length > 0)
  assert.ok(!result.files.some(f => f.status === 'failed'))
  assert.equal(result.records[2].fields.total.raw, null)
  assert.equal(result.records[3].fields.total.raw, '106')
})
