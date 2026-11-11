import { createHash } from 'node:crypto';
import childProcess from 'node:child_process';
import { realpath, stat } from 'node:fs/promises';
import { basename, dirname, extname, isAbsolute, parse, relative, resolve, sep } from 'node:path';
import ExcelJS from 'exceljs';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
export const fieldNames = ['date', 'number', 'buyer', 'seller', 'amount', 'tax', 'total', 'currency', 'materialType'];
class Refusal extends Error {
}
class InputFailure extends Error {
}
function refuse(message) { throw new Refusal(message); }
const reasonMessages = {
    'ofd-out-of-mvp-use-xml-pdf-or-ocr-json': '不支持 OFD。请提供电子发票 XML、带文本层的 PDF，或按 docs/inputs.md 提供 OCR JSON。',
    'raster-image-provide-ocr-json': '图片不能直接提取票据字段。请自行识别后提供 OCR JSON，并用 ocrJson 指定；本插件不做 OCR。',
    'no-text-layer-provide-ocr-json': 'PDF 此页没有可用文本层，可能为扫描页。请提供 OCR JSON 并用 ocrJson 指定；本插件不做 OCR。',
    'unrecognized-pdf-labels-provide-ocr-json': 'PDF 此页有文本，但无法识别票据字段标签。请按 docs/inputs.md 提供 OCR JSON，勿猜测金额。',
    'ambiguous-pdf-label': 'PDF 此页存在重复字段标签，无法唯一取值。请人工核对并提供 OCR JSON。',
    'pdf-page-read-failed': 'PDF 此页读取失败。请检查原文件是否损坏或加密，重新导出可读 PDF 或提供 OCR JSON。',
    'pdf-read-failed': 'PDF 无法解析。请检查文件是否损坏或加密，重新导出完整可读的 PDF。',
    'truncated-pdf': 'PDF 缺少结束标记，可能已截断。请重新复制或导出完整 PDF。',
    'unknown-xml-structure': '无法识别 XML 票据结构。请按 docs/inputs.md 的 Invoice schemaVersion="1" 结构转换，或提供字段 JSON。',
    'malformed-xml': 'XML 格式损坏或未闭合。请重新导出完整 XML，并检查标签是否配对。',
    'xml-dtd-and-entities-refused': 'XML 含 DTD 或实体声明，已拒绝解析。请提供不含这些声明的票据 XML 或字段 JSON。',
    'unknown-xml-line-items': 'XML 明细结构不受支持。请按 docs/inputs.md 的 lineItems/item 结构提供。',
    'unknown-xml-fields': 'XML 字段结构不受支持。请按 docs/inputs.md 提供平铺的文本字段。',
    'invalid-xml-label': 'XML 示例标签不是文本。请将 Label 改为文本后重新导入。',
    'unsupported-format': '不支持此文件格式。请提供 CSV、XLSX、文档规定的 JSON、文本层 PDF 或电子发票 XML。',
    'path-outside-project': '路径越界或符号链接不安全，已拒绝读取。请将普通文件放入所选项目，使用无 .. 的项目相对路径，勿使用文件符号链接。',
    'not-a-regular-file': '输入不是普通文件。请提供项目内的普通文件，勿选择目录、管道或设备。',
    'input-unreadable': '文件不存在或无法读取。请检查项目相对路径、读取权限，以及父目录是否存在。',
    'input-read-or-parse-failed': '文件读取或解析失败。请检查读取权限、文件完整性及 docs/inputs.md 中的格式要求。',
    'malformed-json': 'JSON 格式损坏或已截断。请检查 JSON 语法并重新导出完整文件。',
    'malformed-xlsx': 'XLSX 无法解析，可能损坏、截断或格式不符。请重新导出完整的 .xlsx 文件。',
    'explicit-column-mapping-required': '缺少明确列映射。请在清单 mapping 中指定字段和对应表头，插件不会猜列。',
    'invalid-column-mapping': '列映射无效。请使用 docs/inputs.md 中的字段名，并将 mapping 值设为非空表头文本。',
    'missing-or-ambiguous-mapped-header': '映射的表头不存在或重复。请核对 mapping 与所选工作表表头，使每个表头唯一匹配。',
    'empty-table': '表格为空。请提供含表头与数据行的表格并指定 mapping。',
    'empty-workbook': 'XLSX 没有工作表。请重新导出包含数据工作表的 .xlsx 文件。',
    'selected-sheet-not-found': '找不到指定工作表。请核对清单 sheet 的完整名称，或移除 sheet 以导入所有工作表。',
    'csv-encoding-invalid-utf8-or-gb18030': 'CSV 编码无效：无法严格按 UTF-8／GB18030 解码（UTF-8 BOM 文件必须为 UTF-8）。请重新另存为 UTF-8 CSV，勿混用编码。',
    'input-encoding-invalid-utf8': '文件不是有效 UTF-8。请将 JSON／XML 另存为 UTF-8；GB18030 回退仅适用于 CSV。',
    'identifier-must-be-text': '票号为数值类型，已拒绝作为标识符使用。请从原件核对完整票号，在 XLSX 中存为文本或在 JSON 中使用带引号的字符串；勿转换已丢失精度的数值。',
    'fields-must-be-strings-or-null': '字段必须为字符串或 null。请按 docs/inputs.md 将金额等字段写为文本，缺失值用 null，勿猜填。',
    'formula-without-cache': '公式没有可用缓存值，未执行也未猜算。请人工核对原件，另行提供已核对的静态值。',
    'unexpected-date-cell': '日期单元格类型与映射不符或日期无效。请核对列映射和日期格式。',
    'unsupported-cell-value': '单元格不是受支持的存储值。请核对原件后提供文本或静态值。',
    'unreadable-fields': '本行有无法读取的字段。请按字段说明核对原件后重新提供输入。',
    'truncated-csv': 'CSV 引号未闭合，文件可能截断。请重新导出完整 CSV。',
    'malformed-csv': 'CSV 引号格式错误。请重新导出正确转义的 CSV。',
    'csv-column-count': 'CSV 本行列数与表头不一致。请检查分隔符、引号及文件完整性。',
    'invalid-input': '输入条目无效。请在清单 inputs 中提供含 path、kind 的对象。',
    'invalid-input-kind': '输入 kind 无效。请使用 ticket 或 ledger。',
    'invalid-input-options': '输入选项无效。请将 sheet、ocrJson 设为字符串。',
    'invalid-json-fields': 'JSON fields 含未知字段或不是对象。请按 docs/inputs.md 提供字段对象。',
    'invalid-json-record': 'JSON 记录结构无效。请按 docs/inputs.md 检查 fields、lineItems 和 label。',
    'invalid-ocr-field': 'OCR 字段结构无效。请提供 raw 及可选 page、box，勿添加未知字段。',
    'invalid-ocr-page': 'OCR 页码无效。请提供从 1 开始的整数页码。',
    'invalid-ocr-box': 'OCR 坐标无效。请提供四个非负数且右下坐标不小于左上坐标，勿编造位置。',
    'unsupported-json-schema': 'JSON 文档结构不受支持。请按 docs/inputs.md 提供 schemaVersion 1、type 和 records。',
    'empty-json-records': 'JSON records 为空。请提供实际提取的记录，勿编造字段。',
    'invalid-line-items': 'JSON lineItems 必须为数组。请按 docs/inputs.md 修正结构。',
    'ocr-sidecar-must-be-json': 'OCR 附件必须为 .json 文件。请用 ocrJson 指向字段 JSON。',
    'ocr-sidecar-only-for-pdf-or-images': 'OCR 附件仅能关联 PDF 或图片。请移除该关联并直接导入结构化文件。',
    'sidecar-requires-ocr-schema': 'OCR 附件的 type 必须为 ocr。请按 docs/inputs.md 提供 OCR JSON。',
    'ocr-sidecar-failed': '关联 OCR JSON 导入失败。请查看该附件的清单说明并修正后重新导入。',
    'see-unit-inventory': '文件含拒绝、失败或待核单元。请逐项查看下列工作表／页／行说明，修正后重新导入。',
    'sheet-not-selected': '此工作表或行未被选中。若需导入，请修改清单 sheet。',
    'explicit-ocr-sidecar': '已选择 OCR JSON，此原件页不直接提取字段。请查看关联 JSON 的导入结果。',
    'header': '表头行，仅用于明确列映射。',
    'blank-row': '空行，未生成票据记录。',
};
function inputMessage(file, entry, reason) {
    const unit = [entry.sheet === undefined ? '' : `工作表 ${JSON.stringify(entry.sheet)}`, entry.page === undefined ? '' : `第 ${entry.page} 页`, entry.row === undefined ? '' : `第 ${entry.row} 行`, entry.cell ?? '', entry.path ?? ''].filter(Boolean).join('，');
    return `文件 ${JSON.stringify(file.path)}${unit ? `（${unit}）` : ''}：${reasonMessages[reason] ?? '此单元无法处理。请按 docs/inputs.md 检查输入结构后重新导入。'}`;
}
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
                reject(new InputFailure('input-unreadable'));
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
    return { raw: null, source, review: 'unreadable', issue, message: inputMessage({ path: source.file }, source, issue) };
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
            entry.message = Object.values(fields).flatMap(value => value.message ? [value.message] : []).join('；');
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
        if (name === 'number' && typeof raw === 'number')
            refuse('identifier-must-be-text');
        fields[name] = field(raw, { ...source, raw: typeof raw === 'string' ? raw : null });
    }
    return fields;
}
function parseJson(data, file, result) {
    const text = decode(data);
    let doc;
    try {
        doc = JSON.parse(text);
    }
    catch {
        throw new InputFailure('malformed-json');
    }
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
    catch {
        throw new InputFailure('pdf-read-failed');
    }
    finally {
        await task.destroy();
    }
}
function decode(data) {
    try {
        return new TextDecoder('utf-8', { fatal: true }).decode(data).replace(/^\uFEFF/, '');
    }
    catch {
        refuse('input-encoding-invalid-utf8');
    }
}
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
            if (!['.csv', '.xlsx'].includes(ext) && input.mapping !== undefined && (!object(input.mapping)
                || Object.entries(input.mapping).some(([name, label]) => !fieldNames.includes(name) || typeof label !== 'string' || !label)))
                refuse('invalid-column-mapping');
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
                try {
                    await workbook.xlsx.load(data);
                }
                catch {
                    throw new InputFailure('malformed-xlsx');
                }
                if (!workbook.worksheets.length)
                    refuse('empty-workbook');
                if (input.sheet !== undefined && !workbook.getWorksheet(input.sheet))
                    result.inventory.push({ fileId: id, unit: 'sheet', sheet: input.sheet, status: 'refused', reason: 'selected-sheet-not-found' });
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
            file.reason = error instanceof Refusal || error instanceof InputFailure ? error.message
                : ['ENOENT', 'EACCES', 'EPERM', 'ENOTDIR'].includes(error?.code ?? '') ? 'input-unreadable' : 'input-read-or-parse-failed';
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
        if (file.reason)
            file.message = inputMessage(file, {}, file.reason);
        for (const entry of result.inventory.slice(start).filter(entry => entry.fileId === id)) {
            if (entry.reason && !entry.message)
                entry.message = inputMessage(file, entry, entry.reason);
        }
    }
    for (const [index, input] of inputs.entries())
        await load(input, `file-${index + 1}`);
    return result;
}
