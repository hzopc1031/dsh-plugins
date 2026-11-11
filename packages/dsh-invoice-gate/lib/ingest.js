import { createHash } from 'node:crypto';
import childProcess from 'node:child_process';
import { realpath, stat } from 'node:fs/promises';
import { basename, dirname, extname, isAbsolute, parse, relative, resolve, sep } from 'node:path';
import ExcelJS from 'exceljs';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
export const fieldNames = ['date', 'number', 'buyer', 'seller', 'amount', 'tax', 'total', 'currency', 'materialType'];
class Refusal extends Error {
}
function refuse(message) { throw new Refusal(message); }
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const inside = (root, path) => { const rel = relative(root, path); return rel !== '..' && !rel.startsWith('..' + sep) && !isAbsolute(rel); };
// Walk from the filesystem root in a private cwd so ancestor replacement cannot redirect a read.
const confinedReader = `
const fs = require('node:fs')
const path = require('node:path')
const same = (a, b) => a.dev === b.dev && a.ino === b.ino
try {
  const parts = process.argv[1].split(path.sep)
  for (const part of parts.slice(0, -1)) {
    const directory = fs.openSync(part, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW)
    try {
      const expected = fs.fstatSync(directory, { bigint: true })
      process.chdir(part)
      if (!same(expected, fs.statSync('.', { bigint: true }))) process.exit(2)
    } finally { fs.closeSync(directory) }
  }
  const fd = fs.openSync(parts.at(-1), fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK)
  try {
    if (!fs.fstatSync(fd).isFile()) process.exit(3)
    fs.writeFileSync(1, fs.readFileSync(fd))
  } finally { fs.closeSync(fd) }
} catch (error) { process.exitCode = error.code === 'ELOOP' ? 2 : 1 }
`;
export async function readOriginal(root, path) {
    if (typeof path !== 'string' || !path || isAbsolute(path) || path.split(/[\\/]/).includes('..') || path.includes('\0'))
        refuse('path-outside-project');
    const target = resolve(root, path);
    const parent = await realpath(dirname(target));
    if (!inside(root, parent))
        refuse('path-outside-project');
    const anchor = parse(root).root;
    return await new Promise((accept, reject) => {
        const child = childProcess.spawn(process.execPath, ['--input-type=commonjs', '--eval', confinedReader, '--', relative(anchor, resolve(parent, basename(target)))], {
            cwd: anchor, stdio: ['ignore', 'pipe', 'ignore'], env: { ...process.env, NODE_OPTIONS: '' },
        });
        const chunks = [];
        child.stdout.on('data', (chunk) => chunks.push(chunk));
        child.stdout.on('error', reject);
        child.on('error', reject);
        child.on('close', code => {
            if (code === 0)
                accept(Buffer.concat(chunks));
            else if (code === 2 || code === 3)
                reject(new Refusal(code === 2 ? 'path-outside-project' : 'not-a-regular-file'));
            else
                reject(new Error('input-read-or-parse-failed'));
        });
    });
}
function field(raw, source) {
    if (raw !== null && typeof raw !== 'string')
        refuse('fields-must-be-strings-or-null');
    return { raw, source, review: 'pending' };
}
function emptyFields() {
    return Object.fromEntries(fieldNames.map(name => [name, field(null, null)]));
}
function unreadable(source, issue) {
    return { raw: null, source, review: 'unreadable', issue };
}
const hasIssue = (fields) => Object.values(fields).some(value => value.issue);
function tableCell(value, source, name) {
    if (value && typeof value === 'object' && ('formula' in value || 'sharedFormula' in value)) {
        const formula = 'formula' in value ? value.formula : value.sharedFormula;
        const result = value.result;
        if (result === undefined || result === null)
            return unreadable({ ...source, raw: formula ?? null }, 'formula-without-cache');
        return tableCell(result, { ...source, formula }, name);
    }
    if (value && typeof value === 'object') {
        if (value instanceof Date) {
            if (name !== 'date' || !Number.isFinite(value.getTime()))
                return unreadable(source, 'unexpected-date-cell');
            return field(value.toISOString().slice(0, 10), { ...source, raw: value.toISOString() });
        }
        if ('richText' in value)
            return tableCell(value.richText.map(part => part.text).join(''), source, name);
        if ('hyperlink' in value)
            return tableCell(value.text, source, name);
        return unreadable(source, 'unsupported-cell-value');
    }
    const raw = value === null || value === undefined ? null : String(value);
    source = { ...source, raw };
    if (name === 'number' && typeof value === 'number')
        return unreadable(source, 'identifier-must-be-text');
    if (typeof value === 'string' && /^\s*=/.test(value))
        return unreadable(source, 'formula-without-cache');
    return field(raw, source);
}
function csvRows(text) {
    const rows = [];
    let cells = [], cell = '', quoted = false, closed = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (quoted) {
            if (c === '"' && text[i + 1] === '"') {
                cell += '"';
                i++;
            }
            else if (c === '"') {
                quoted = false;
                closed = true;
            }
            else
                cell += c;
        }
        else if (c === ',' || c === '\r' || c === '\n') {
            cells.push(cell);
            cell = '';
            closed = false;
            if (c !== ',') {
                if (c === '\r' && text[i + 1] === '\n')
                    i++;
                rows.push({ cells });
                cells = [];
            }
        }
        else if (c === '"' && cell === '' && !closed)
            quoted = true;
        else if (closed || c === '"') {
            rows.push({ cells: [...cells, cell], issue: 'malformed-csv' });
            return rows;
        }
        else
            cell += c;
    }
    if (cell || cells.length || closed || quoted)
        rows.push({ cells: [...cells, cell], ...(quoted ? { issue: 'truncated-csv' } : {}) });
    return rows;
}
function parseTable(rows, file, input, result, sheet, csvIssues) {
    const at = { fileId: file.id, ...(sheet === undefined ? {} : { sheet }) };
    const header = rows[0] ?? [];
    const mapping = input.mapping;
    let mappingError;
    const columns = new Map();
    if (!object(mapping) || Object.keys(mapping).length === 0)
        mappingError = 'explicit-column-mapping-required';
    else
        for (const [name, label] of Object.entries(mapping)) {
            if (!fieldNames.includes(name) || typeof label !== 'string' || !label) {
                mappingError = 'invalid-column-mapping';
                break;
            }
            const matches = header.flatMap((value, index) => value === label ? [index] : []);
            if (matches.length !== 1) {
                mappingError = 'missing-or-ambiguous-mapped-header';
                break;
            }
            columns.set(name, matches[0]);
        }
    if (!rows.length)
        mappingError = 'empty-table';
    if (mappingError) {
        const entry = sheet === undefined ? file : result.inventory.find(entry => entry.fileId === file.id && entry.unit === 'sheet' && entry.sheet === sheet);
        entry.status = 'refused';
        entry.reason = mappingError;
    }
    for (const [index, row] of rows.entries()) {
        const entry = { ...at, unit: 'row', row: index + 1, status: 'parsed' };
        result.inventory.push(entry);
        if (csvIssues?.has(index + 1)) {
            entry.status = 'failed';
            entry.reason = csvIssues.get(index + 1);
            continue;
        }
        if (mappingError) {
            entry.status = 'skipped';
            entry.reason = mappingError;
            continue;
        }
        if (index === 0) {
            entry.status = 'skipped';
            entry.reason = 'header';
            continue;
        }
        if (row.every(value => value === null || value === undefined || value === '')) {
            entry.status = 'skipped';
            entry.reason = 'blank-row';
            continue;
        }
        if (!sheet && row.length !== header.length) {
            entry.status = 'failed';
            entry.reason = 'csv-column-count';
            continue;
        }
        const fields = emptyFields();
        for (const [name, column] of columns) {
            const source = { file: file.path, raw: null, row: index + 1, ...(sheet ? { sheet, cell: `${columnName(column + 1)}${index + 1}` } : { path: `/rows/${index + 1}/columns/${column + 1}` }) };
            fields[name] = tableCell(row[column] ?? null, source, name);
        }
        if (hasIssue(fields)) {
            entry.status = 'partial';
            entry.reason = 'unreadable-fields';
        }
        result.records.push({ id: `${file.id}:${sheet ?? 'csv'}:${index + 1}`, fileId: file.id, kind: input.kind, fields });
    }
}
function columnName(column) {
    let name = '';
    for (; column > 0; column = Math.floor((column - 1) / 26))
        name = String.fromCharCode(65 + (column - 1) % 26) + name;
    return name;
}
function jsonFields(value, file, path) {
    if (!object(value) || Object.keys(value).some(key => !fieldNames.includes(key)))
        refuse('invalid-json-fields');
    const fields = emptyFields();
    for (const [name, entry] of Object.entries(value)) {
        let raw = entry;
        const source = { file: file.path, raw: null, path: `${path}/${name}` };
        if (object(entry)) {
            if (!Object.hasOwn(entry, 'raw') || Object.keys(entry).some(key => !['raw', 'page', 'box'].includes(key)))
                refuse('invalid-ocr-field');
            raw = entry.raw;
            source.path += '/raw';
            if (entry.page !== undefined) {
                if (!Number.isSafeInteger(entry.page) || entry.page < 1)
                    refuse('invalid-ocr-page');
                source.page = entry.page;
            }
            if (entry.box !== undefined) {
                if (!Array.isArray(entry.box) || entry.box.length !== 4 || !entry.box.every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0)
                    || entry.box[2] < entry.box[0] || entry.box[3] < entry.box[1])
                    refuse('invalid-ocr-box');
                source.box = entry.box;
            }
        }
        fields[name] = field(raw, { ...source, raw: typeof raw === 'string' ? raw : null });
    }
    return fields;
}
function parseJson(data, file, result) {
    const doc = JSON.parse(decode(data));
    if (!object(doc) || doc.schemaVersion !== 1 || !['tickets', 'ocr', 'ledger'].includes(doc.type)
        || !Array.isArray(doc.records) || Object.keys(doc).some(key => !['schemaVersion', 'type', 'label', 'records'].includes(key))
        || (doc.label !== undefined && typeof doc.label !== 'string'))
        refuse('unsupported-json-schema');
    if (file.originalFileId && doc.type !== 'ocr')
        refuse('sidecar-requires-ocr-schema');
    if (!doc.records.length)
        refuse('empty-json-records');
    for (const [index, value] of doc.records.entries()) {
        const entry = { fileId: file.id, unit: 'row', row: index + 1, status: 'parsed' };
        result.inventory.push(entry);
        try {
            if (!object(value) || Object.keys(value).some(key => !['fields', 'lineItems', 'label'].includes(key))
                || (value.label !== undefined && typeof value.label !== 'string'))
                refuse('invalid-json-record');
            const fields = jsonFields(value.fields, file, `/records/${index}/fields`);
            let lineItems;
            if (value.lineItems !== undefined) {
                if (!Array.isArray(value.lineItems))
                    refuse('invalid-line-items');
                lineItems = value.lineItems.map((item, i) => jsonFields(item, file, `/records/${index}/lineItems/${i}`));
            }
            result.records.push({ id: `${file.id}:json:${index + 1}`, fileId: file.id,
                ...(file.originalFileId ? { originalFileId: file.originalFileId } : {}),
                kind: doc.type === 'ledger' ? 'ledger' : 'ticket', fields,
                ...(typeof value.label === 'string' || typeof doc.label === 'string' ? { label: (value.label ?? doc.label) } : {}),
                ...(lineItems ? { lineItems } : {}) });
        }
        catch (error) {
            entry.status = error instanceof Refusal ? 'refused' : 'failed';
            entry.reason = error instanceof Refusal ? error.message : 'invalid-json-record';
        }
    }
}
// shortcut: only the documented Invoice XML dialect; add a fixture before supporting another structure.
function parseXml(data, file, result) {
    const text = decode(data);
    if (/<!DOCTYPE|<!ENTITY/i.test(text))
        refuse('xml-dtd-and-entities-refused');
    if (XMLValidator.validate(text) !== true)
        refuse('malformed-xml');
    const doc = new XMLParser({ parseTagValue: false, parseAttributeValue: false, ignoreAttributes: false, trimValues: false, processEntities: false }).parse(text);
    const invoice = doc.Invoice;
    if (!object(invoice) || Object.keys(doc).some(key => !['?xml', 'Invoice'].includes(key))
        || invoice['@_schemaVersion'] !== '1' || Object.keys(invoice).some(key => !['@_schemaVersion', 'Label', ...fieldNames, 'lineItems'].includes(key)))
        refuse('unknown-xml-structure');
    const values = Object.fromEntries(Object.entries(invoice).filter(([key]) => fieldNames.includes(key)));
    const fields = xmlFields(values, file, '/Invoice');
    let lineItems;
    if (invoice.lineItems !== undefined) {
        if (!object(invoice.lineItems) || Object.keys(invoice.lineItems).some(key => key !== 'item'))
            refuse('unknown-xml-line-items');
        const items = invoice.lineItems.item === undefined ? [] : Array.isArray(invoice.lineItems.item) ? invoice.lineItems.item : [invoice.lineItems.item];
        lineItems = items.map((item, i) => xmlFields(item, file, `/Invoice/lineItems/item[${i + 1}]`));
    }
    if (invoice.Label !== undefined && typeof invoice.Label !== 'string')
        refuse('invalid-xml-label');
    result.inventory.push({ fileId: file.id, unit: 'row', row: 1, status: 'parsed' });
    result.records.push({ id: `${file.id}:xml:1`, fileId: file.id, kind: 'ticket', fields, ...(invoice.Label ? { label: invoice.Label } : {}), ...(lineItems ? { lineItems } : {}) });
}
function xmlFields(value, file, path) {
    if (!object(value) || Object.keys(value).some(key => !fieldNames.includes(key)))
        refuse('unknown-xml-fields');
    const fields = emptyFields();
    for (const [name, raw] of Object.entries(value))
        fields[name] = field(raw, { file: file.path, path: `${path}/${name}`, raw: typeof raw === 'string' ? raw : null });
    return fields;
}
// shortcut: one labelled ticket per page, add layout fixtures before supporting other layouts.
const pdfLabels = {
    date: ['Date', '开票日期'], number: ['Number', '发票号码'], buyer: ['Buyer', '购买方'], seller: ['Seller', '销售方'],
    amount: ['Amount', '金额'], tax: ['Tax', '税额'], total: ['Total', '价税合计'], currency: ['Currency', '币种'], materialType: ['MaterialType', '材料类型'],
};
async function parsePdf(data, file, result, sidecar) {
    // A missing EOF may otherwise be silently recovered by the PDF reader.
    if (!data.subarray(-1024).toString('latin1').includes('%%EOF'))
        refuse('truncated-pdf');
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const task = getDocument({ data: new Uint8Array(data), isEvalSupported: false, useSystemFonts: false,
        disableFontFace: true, useWorkerFetch: false, stopAtErrors: true, verbosity: 0 });
    try {
        const pdf = await task.promise;
        for (let page = 1; page <= pdf.numPages; page++) {
            const entry = { fileId: file.id, unit: 'page', page, status: 'parsed' };
            result.inventory.push(entry);
            try {
                if (sidecar) {
                    entry.status = 'skipped';
                    entry.reason = 'explicit-ocr-sidecar';
                    continue;
                }
                const content = await (await pdf.getPage(page)).getTextContent();
                const text = content.items.map(item => 'str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : '').join('');
                if (!text.trim()) {
                    entry.status = 'refused';
                    entry.reason = 'no-text-layer-provide-ocr-json';
                    continue;
                }
                const fields = emptyFields();
                for (const name of fieldNames) {
                    const labels = pdfLabels[name].join('|');
                    const matches = [...text.matchAll(new RegExp(`(?:^|\\n)[ \\t]*(?:${labels})[ \\t]*[:：][ \\t]*([^\\n]*)`, 'g'))];
                    if (matches.length === 1) {
                        const raw = matches[0][1].trim();
                        fields[name] = field(raw, { file: file.path, raw, page, excerpt: matches[0][0].trim() });
                    }
                    else if (matches.length > 1)
                        fields[name] = unreadable({ file: file.path, raw: null, page }, 'ambiguous-pdf-label');
                }
                if (!Object.values(fields).some(value => value.source)) {
                    entry.status = 'refused';
                    entry.reason = 'unrecognized-pdf-labels-provide-ocr-json';
                    continue;
                }
                if (hasIssue(fields)) {
                    entry.status = 'partial';
                    entry.reason = 'ambiguous-pdf-label';
                }
                result.records.push({ id: `${file.id}:pdf:${page}`, fileId: file.id, kind: 'ticket', fields });
            }
            catch {
                entry.status = 'failed';
                entry.reason = 'pdf-page-read-failed';
            }
        }
    }
    finally {
        await task.destroy();
    }
}
function decode(data) { return new TextDecoder('utf-8', { fatal: true }).decode(data).replace(/^\uFEFF/, ''); }
function decodeCsv(data) {
    const bom = data.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]));
    try {
        return { text: decode(data), encoding: 'utf-8' };
    }
    catch {
        if (!bom) {
            try {
                return { text: new TextDecoder('gb18030', { fatal: true }).decode(data), encoding: 'gb18030' };
            }
            catch { /* Never replace financial evidence with guessed characters. */ }
        }
        refuse('csv-encoding-invalid-utf8-or-gb18030');
    }
}
/** Local library result contains raw evidence; never return it directly to the host model. */
export async function ingest(projectDir, inputs) {
    if (typeof projectDir !== 'string' || !Array.isArray(inputs))
        throw new Error('project-directory-and-input-list-required');
    const root = await realpath(projectDir);
    if (!(await stat(root)).isDirectory())
        throw new Error('project-directory-required');
    const result = { files: [], inventory: [], records: [] };
    async function load(input, id, originalFileId) {
        const file = { id, path: object(input) && typeof input.path === 'string' ? input.path : '', sha256: null, status: 'parsed', ...(originalFileId ? { originalFileId } : {}) };
        result.files.push(file);
        const start = result.inventory.length;
        let encoding;
        try {
            if (!object(input))
                refuse('invalid-input');
            const data = await readOriginal(root, input.path);
            file.sha256 = createHash('sha256').update(data).digest('hex');
            if (!['ticket', 'ledger'].includes(input.kind))
                refuse('invalid-input-kind');
            if ((input.sheet !== undefined && typeof input.sheet !== 'string') || (input.ocrJson !== undefined && typeof input.ocrJson !== 'string'))
                refuse('invalid-input-options');
            const ext = extname(file.path).toLowerCase();
            if (originalFileId && ext !== '.json')
                refuse('ocr-sidecar-must-be-json');
            const original = originalFileId ? result.files.find(file => file.id === originalFileId) : file;
            if ((input.ocrJson !== undefined || originalFileId) && !['.pdf', '.png', '.jpg', '.jpeg', '.tif', '.tiff', '.bmp', '.webp'].includes(extname(original.path).toLowerCase()))
                refuse('ocr-sidecar-only-for-pdf-or-images');
            if (ext === '.csv') {
                const decoded = decodeCsv(data);
                encoding = decoded.encoding;
                const rows = csvRows(decoded.text);
                parseTable(rows.map(row => row.cells), file, input, result, undefined, new Map(rows.flatMap((row, i) => row.issue ? [[i + 1, row.issue]] : [])));
            }
            else if (ext === '.xlsx') {
                const workbook = new ExcelJS.Workbook();
                await workbook.xlsx.load(data);
                if (!workbook.worksheets.length)
                    refuse('empty-workbook');
                if (input.sheet !== undefined && !workbook.getWorksheet(input.sheet))
                    result.inventory.push({ fileId: id, unit: 'sheet', status: 'refused', reason: 'selected-sheet-not-found' });
                for (const sheet of workbook.worksheets) {
                    const selected = input.sheet === undefined || sheet.name === input.sheet;
                    result.inventory.push({ fileId: id, unit: 'sheet', sheet: sheet.name, status: selected ? 'parsed' : 'skipped', ...(selected ? {} : { reason: 'sheet-not-selected' }) });
                    const rows = Array.from({ length: sheet.rowCount }, (_, i) => Array.from({ length: sheet.columnCount }, (_, j) => sheet.getRow(i + 1).getCell(j + 1).value));
                    if (selected)
                        parseTable(rows, file, input, result, sheet.name);
                    else
                        for (let row = 1; row <= rows.length; row++)
                            result.inventory.push({ fileId: id, unit: 'row', sheet: sheet.name, row, status: 'skipped', reason: 'sheet-not-selected' });
                }
            }
            else if (ext === '.json')
                parseJson(data, file, result);
            else if (ext === '.xml')
                parseXml(data, file, result);
            else if (ext === '.pdf')
                await parsePdf(data, file, result, input.ocrJson !== undefined);
            else if (ext === '.ofd')
                refuse('ofd-out-of-mvp-use-xml-pdf-or-ocr-json');
            else if (['.png', '.jpg', '.jpeg', '.tif', '.tiff', '.bmp', '.webp'].includes(ext)) {
                result.inventory.push({ fileId: id, unit: 'page', page: 1, status: input.ocrJson !== undefined ? 'skipped' : 'refused', reason: input.ocrJson !== undefined ? 'explicit-ocr-sidecar' : 'raster-image-provide-ocr-json' });
            }
            else
                refuse('unsupported-format');
        }
        catch (error) {
            file.status = error instanceof Refusal ? 'refused' : 'failed';
            file.reason = error instanceof Refusal ? error.message : 'input-read-or-parse-failed';
        }
        const entries = result.inventory.slice(start);
        if (file.status === 'parsed' && entries.some(entry => ['failed', 'refused', 'partial'].includes(entry.status))) {
            file.status = result.records.some(record => record.fileId === id) ? 'partial' : entries.some(entry => entry.status === 'failed') ? 'failed' : 'refused';
            file.reason = 'see-unit-inventory';
        }
        result.inventory.push({ fileId: id, unit: 'file', status: file.status, ...(file.reason ? { reason: file.reason } : {}), ...(encoding ? { encoding } : {}) });
        if (object(input) && typeof input.ocrJson === 'string') {
            await load({ path: input.ocrJson, kind: 'ticket' }, `${id}:ocr`, id);
            const sidecar = result.files.at(-1);
            if (sidecar.status !== 'parsed' && file.status === 'parsed') {
                file.status = 'partial';
                file.reason = 'ocr-sidecar-failed';
                const entry = result.inventory.find(entry => entry.fileId === id && entry.unit === 'file');
                entry.status = file.status;
                entry.reason = file.reason;
            }
        }
    }
    for (const [index, input] of inputs.entries())
        await load(input, `file-${index + 1}`);
    return result;
}
