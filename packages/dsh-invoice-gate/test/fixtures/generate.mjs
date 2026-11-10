// Synthetic SAMPLE / 非真实票据 only. Run from the package directory.
import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import ExcelJS from 'exceljs'
const require = createRequire(import.meta.url)
const JSZip = require(require.resolve('jszip', { paths: [require.resolve('exceljs')] }))
const dir = new URL('./', import.meta.url)
const save = (name, data) => writeFile(new URL(name, dir), data)
const number = '12345678901234567890'
const headers = ['开票日期', '发票号码', '购买方', '销售方', '金额', '税额', '价税合计', '币种', '材料类型']
const clean = ['2026-11-01', number, 'SAMPLE 示例买方', 'SAMPLE 示例卖方', '100.00', '6.00', '106.00', 'CNY', '非真实票据 SAMPLE']
await save('clean.csv', '\uFEFF' + [headers, clean].map(row => row.join(',')).join('\n') + '\n')
await save('duplicate-a.csv', '示例,SAMPLE duplicate hash / 非真实票据\n')
await save('duplicate-b.csv', '示例,SAMPLE duplicate hash / 非真实票据\n')
await save('ledger.csv', [headers, clean, ['2026-11-02', 'SAMPLE-LEDGER-ONLY', 'SAMPLE 示例买方', 'SAMPLE 示例卖方', '20.00', '0.00', '20.00', 'CNY', '非真实票据 SAMPLE']].map(row => row.join(',')).join('\n'))
const fields = Object.fromEntries(['date', 'number', 'buyer', 'seller', 'amount', 'tax', 'total', 'currency', 'materialType'].map((key, i) => [key, clean[i]]))
const json = (type, records) => JSON.stringify({ schemaVersion: 1, type, label: 'SAMPLE 示例 / 非真实票据', records }, null, 2) + '\n'
await save('tickets.json', json('tickets', [{ fields, lineItems: [{ total: '106.00', materialType: 'SAMPLE 非真实票据' }] }, { fields: { ...fields, number: 'SAMPLE-TICKET-ONLY', amount: '30.00', tax: '0.00', total: '30.00' } }]))
await save('mismatch.json', json('tickets', [{ fields: { ...fields, total: '108.00' } }]))
await save('ocr.json', json('ocr', [{ fields: Object.fromEntries(Object.entries(fields).map(([name, raw]) => [name, { raw, page: 1, box: [0, 0, 100, 20] }])) }]))
await save('invoice.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<Invoice schemaVersion="1"><Label>SAMPLE 示例 非真实票据</Label>' + Object.entries(fields).map(([key, value]) => `<${key}>${value}</${key}>`).join('') + '<lineItems><item><total>106.00</total></item></lineItems></Invoice>\n')
await save('unknown.xml', '<Unknown><Label>SAMPLE 示例 非真实票据</Label><number>' + number + '</number></Unknown>\n')
await save('sample.ofd', Buffer.from('OFD SAMPLE 非真实票据 — intentionally unsupported'))
await save('scan.png', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=', 'base64'))
const workbook = new ExcelJS.Workbook()
const sheet = workbook.addWorksheet('示例台账 SAMPLE')
sheet.addRow(headers); sheet.addRow(clean)
sheet.addRow([...clean.slice(0, 4), '', '0.00', '', 'CNY', 'SAMPLE blank amount'])
sheet.addRow([...clean.slice(0, 1), 12345678901234567000, ...clean.slice(2, 6), { formula: 'HYPERLINK("https://example.invalid/SAMPLE", "SAMPLE")' }, 'CNY', 'SAMPLE no cache'])
sheet.addRow([...clean.slice(0, 6), { formula: '100+6', result: 106 }, 'CNY', 'SAMPLE cached'])
sheet.getCell('I7').value = { text: 'SAMPLE external link', hyperlink: 'https://example.invalid/SAMPLE' }
workbook.addWorksheet('跳过 SAMPLE').addRow(['SAMPLE 非真实票据'])
const zip = await JSZip.loadAsync(await workbook.xlsx.writeBuffer())
zip.file('xl/vbaProject.bin', 'SAMPLE inert macro payload / 非真实票据')
zip.file('xl/externalLinks/externalLink1.xml', '<?xml version="1.0"?><externalLink xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><externalBook r:id="rId1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/></externalLink>')
zip.file('xl/externalLinks/_rels/externalLink1.xml.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/externalLinkPath" Target="https://example.invalid/SAMPLE.xlsx" TargetMode="External"/></Relationships>')
await save('ledger.xlsx', await zip.generateAsync({ type: 'nodebuffer' }))
assert.equal(sheet.getCell('B2').value, number)

function pdf(pages) {
  const objects = []
  const add = text => { objects.push(Buffer.from(text, 'latin1')); return objects.length }
  add('<< /Type /Catalog /Pages 2 0 R >>')
  add(`<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, i) => `${4 + i * 2} 0 R`).join(' ')}] >>`)
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
  for (const lines of pages) {
    const stream = lines ? 'BT /F1 11 Tf 40 760 Td 16 TL\n' + lines.map(line => `(${line}) Tj T*`).join('\n') + '\nET' : 'q 10 0 0 10 40 700 cm /Im1 Do Q'
    add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> /XObject << /Im1 ${4 + pages.length * 2} 0 R >> >> /Contents ${objects.length + 2} 0 R >>`)
    add(`<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`)
  }
  add('<< /Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length 3 >>\nstream\n\x00\x00\x00\nendstream')
  const chunks = [Buffer.from('%PDF-1.4\n% SAMPLE synthetic non-real invoice\n')]
  const offsets = [0]
  for (const [index, obj] of objects.entries()) {
    offsets.push(Buffer.concat(chunks).length)
    chunks.push(Buffer.from(`${index + 1} 0 obj\n`), obj, Buffer.from('\nendobj\n'))
  }
  const xref = Buffer.concat(chunks).length
  chunks.push(Buffer.from(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` + offsets.slice(1).map(offset => String(offset).padStart(10, '0') + ' 00000 n \n').join('') + `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`))
  const data = Buffer.concat(chunks)
  assert.equal(data.subarray(xref, xref + 4).toString(), 'xref')
  return data
}
const lines = ['SAMPLE synthetic non-real invoice', 'Date: 2026-11-01', `Number: ${number}`, 'Buyer: SAMPLE Buyer', 'Seller: SAMPLE Seller', 'Amount: 100.00', 'Tax: 6.00', 'Total: 106.00', 'Currency: CNY', 'MaterialType: SAMPLE non-real invoice']
await save('text.pdf', pdf([lines]))
await save('scan.pdf', pdf([null]))
await save('mixed.pdf', pdf([lines, null]))
await save('edge-labels.pdf', pdf([['SAMPLE synthetic non-real invoice', `Number: ${number}`, 'Amount: 100.00', 'Amount: 200.00', 'Tax:', 'Total: 108.00', 'Currency: CNY']]))
console.log('SAMPLE fixtures generated; identifier and PDF offset assertions passed')
