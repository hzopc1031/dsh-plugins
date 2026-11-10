import { createHash } from 'node:crypto'
import { constants } from 'node:fs'
import { lstat, mkdir, mkdtemp, open, realpath, rename, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path'
import ExcelJS from 'exceljs'
import { fieldNames, type Source } from './ingest.js'
import { reconcile, rulesVersion, type ReconciliationResult } from './reconcile.js'

export const packDisclaimer = '本包不证明票据真实、已付款或可报销，不是会计档案合规认证。SHA-256 仅用于检测文件变化，不证明票据真实。This pack does not prove authenticity, payment or reimbursability and is not an accounting-archive certification. SHA-256 only detects file change.'
const noSource = '无来源／待核'
export interface ExportOptions { includeOriginals?: boolean }
export interface ExportSummary {
  directory: string
  files: { markdown: string; xlsx: string; json: string }
  packKind: 'with-originals' | 'summary-only'
  status: 'draft' | 'locally-confirmed'
  counts: { records: number; mismatches: number; pendingKeyFields: number; originals: number }
}
const inside = (root: string, path: string) => { const rel = relative(root, path); return rel !== '..' && !rel.startsWith('..' + sep) && !isAbsolute(rel) }
function localPath(path: string): void {
  if (typeof path !== 'string' || !path || isAbsolute(path) || path.includes('\0') || path.split(/[\\/]/).includes('..')) throw new Error('path-outside-project')
}
async function absent(path: string): Promise<void> {
  try { await lstat(path) } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw error }
  throw new Error('export-directory-exists-use-new-directory')
}
function sourceText(source: Source | null): string {
  if (!source) return noSource
  const located = (source.sheet !== undefined && source.cell !== undefined) || source.path !== undefined || (source.page !== undefined && source.excerpt !== undefined)
  return (located ? '' : noSource + ' ') + JSON.stringify(source)
}
type Table = { name: string; headers: string[]; rows: string[][] }
const valueText = (value: unknown): string => value === null || value === undefined ? '不适用／无法计算' : typeof value === 'string' ? value : JSON.stringify(value)
const md = (value: string): string => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('|', '&#124;').replaceAll('`', '&#96;').replace(/\r\n|\r|\n/g, '<br>')

/** Local-only writer. Never pass the full reconciliation result into model context. */
export async function exportPack(projectDir: string, directory: string, input: ReconciliationResult, options: ExportOptions = {}): Promise<ExportSummary> {
  if (!options || typeof options !== 'object' || Array.isArray(options) || Object.keys(options).some(key => key !== 'includeOriginals') || (options.includeOriginals !== undefined && typeof options.includeOriginals !== 'boolean')) throw new Error('invalid-export-options')
  localPath(directory)
  if (input.rulesVersion !== rulesVersion) throw new Error('unsupported-rules-version')
  // Derive status and values again so stale or edited result flags cannot certify a draft.
  const run = reconcile(input.extracted, input.options, input.corrections)
  const root = await realpath(projectDir)
  const destination = resolve(root, directory)
  if (destination === root || !inside(root, destination)) throw new Error('path-outside-project')
  const parentPath = dirname(destination)
  if (!inside(root, await realpath(parentPath))) throw new Error('path-outside-project')
  const parent = await open(parentPath, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW)
  let stage: string | undefined
  try {
    if (!inside(root, await realpath(`/proc/self/fd/${parent.fd}`))) throw new Error('path-outside-project')
    const anchoredParent = `/proc/self/fd/${parent.fd}`
    const target = `${anchoredParent}/${basename(destination)}`
    await absent(target)
    stage = await mkdtemp(`${anchoredParent}/.invoice-gate-`)
    const originals: { fileId: string; sourcePath: string; sha256: string | null; packPath: string | null }[] = []
    if (options.includeOriginals) await mkdir(`${stage}/originals`)
    for (const [index, file] of run.extracted.files.entries()) {
      let packPath: string | null = null
      if (options.includeOriginals) {
        localPath(file.path)
        if (!file.sha256) throw new Error('original-hash-unavailable')
        const original = resolve(root, file.path)
        if (!inside(root, await realpath(original))) throw new Error('path-outside-project')
        const handle = await open(original, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)
        let bytes: Buffer
        try {
          if (!(await handle.stat()).isFile() || !inside(root, await realpath(`/proc/self/fd/${handle.fd}`))) throw new Error('unsafe-original-path')
          bytes = await handle.readFile()
        } finally { await handle.close() }
        if (createHash('sha256').update(bytes).digest('hex') !== file.sha256) throw new Error('original-changed-since-ingest')
        const extension = extname(file.path)
        packPath = `originals/${String(index + 1).padStart(4, '0')}${/^\.[a-z0-9]{1,10}$/i.test(extension) ? extension : '.bin'}`
        await writeFile(`${stage}/${packPath}`, bytes, { flag: 'wx', mode: 0o600 })
      }
      originals.push({ fileId: file.id, sourcePath: file.path, sha256: file.sha256, packPath })
    }
    const packKind = options.includeOriginals ? 'with-originals' as const : 'summary-only' as const
    const status = run.fullyConfirmed ? 'locally-confirmed' as const : 'draft' as const
    const statusText = run.fullyConfirmed ? '本地字段核对完成（外部核验未执行）' : 'DRAFT / 草稿：本地核对未完成；请查看差异、待核字段与导入清单'
    const mismatches = run.results.filter(rule => rule.outcome === 'mismatch')
    const counts = { records: run.records.length, mismatches: mismatches.length, pendingKeyFields: run.pendingKeyFields.length, originals: originals.filter(file => file.packPath !== null).length }
    const evidence = run.extracted.records.flatMap(record => [record.fields, ...(record.lineItems ?? [])].flatMap((fields, index) => fieldNames.map(field => ({
      recordId: record.id, lineItem: index === 0 ? null : index - 1, field,
      source: fields[field].source, pointer: sourceText(fields[field].source),
      availability: fields[field].source ? (options.includeOriginals ? 'bundled' : 'referenced-not-bundled') : 'no-source',
    }))))
    function ruleEvidence(recordIds: string[], fileIds: string[]): string {
      const sources = evidence.filter(item => recordIds.includes(item.recordId)).map(item => `${item.recordId} ${item.lineItem === null ? '' : `line[${item.lineItem}] `}${item.field}: ${item.pointer}`)
      for (const id of fileIds) {
        const file = originals.find(file => file.fileId === id)
        sources.push(file ? `${id}: ${JSON.stringify(file)}` : noSource)
      }
      return sources.join('\n') || noSource
    }
    const tables: Table[] = [
      { name: 'Summary', headers: ['项目 / Key', '值 / Value'], rows: [
        ['Status', statusText], ['Pack kind', packKind], ['Rules version', run.rulesVersion], ['External verification', run.externalVerification],
        ['Disclaimer', packDisclaimer], ['Counts', JSON.stringify(counts)],
        ['Evidence', options.includeOriginals ? '原件副本已按导入时 SHA-256 校验；见 Files 中相对路径。' : '仅摘要；原件未附带，来源路径相对于项目，未重新检查当前文件。'],
        ['Difference', 'actual − expected；非数值差异为不适用／无法计算'],
      ] },
      { name: 'Rules', headers: ['Rule id', 'Outcome', 'Record ids', 'File ids', 'Field', 'Expected', 'Actual', 'Difference', 'Expected fen', 'Actual fen', 'Difference fen', 'Reason', 'Evidence'], rows: run.results.map(rule => [rule.ruleId, rule.outcome, JSON.stringify(rule.recordIds), JSON.stringify(rule.fileIds), rule.field ?? '', valueText(rule.expected), valueText(rule.actual), valueText(rule.difference), rule.expectedFen ?? '', rule.actualFen ?? '', rule.differenceFen ?? '', rule.reason ?? '', ruleEvidence(rule.recordIds, rule.fileIds)]) },
      { name: 'Fields', headers: ['Record id', 'Kind', 'Label', 'Line item (zero-based)', 'Field', 'Extracted raw', 'Extracted review', 'Normalized', 'Confirmed (human)', 'Field review', 'Evidence'], rows: run.records.flatMap((record, index) => [record.fields, ...(record.lineItems ?? [])].flatMap((fields, group) => fieldNames.map(name => {
        const original = group === 0 ? run.extracted.records[index]!.fields[name] : run.extracted.records[index]!.lineItems![group - 1]![name]
        return [record.id, record.kind, record.label ?? '', group === 0 ? '' : String(group - 1), name, original.raw ?? '未提取（null）', original.review, JSON.stringify(fields[name].normalized), fields[name].confirmed ? JSON.stringify(fields[name].confirmed) : '未确认', fields[name].review, sourceText(original.source)]
      }))) },
      { name: 'Inventory', headers: ['File id', 'Unit', 'Status', 'Reason', 'Sheet', 'Row', 'Page'], rows: run.extracted.inventory.map(entry => [entry.fileId, entry.unit, entry.status, entry.reason ?? '', entry.sheet ?? '', entry.row === undefined ? '' : String(entry.row), entry.page === undefined ? '' : String(entry.page)]) },
      { name: 'Files', headers: ['File id', 'Project relative source', 'SHA-256', 'Status', 'Reason', 'Original file id', 'Pack relative copy'], rows: run.extracted.files.map((file, index) => [file.id, file.path, file.sha256 ?? noSource, file.status, file.reason ?? '', file.originalFileId ?? '', originals[index]!.packPath ?? '未附带／待核']) },
      { name: 'Corrections', headers: ['Record id', 'Line item (zero-based)', 'Field', 'Before', 'After', 'Confirmed by (asserted)', 'Confirmed at (asserted)'], rows: run.corrections.entries.map(entry => [entry.recordId, entry.lineItem === undefined ? '' : String(entry.lineItem), entry.field, JSON.stringify(entry.before), entry.after, entry.confirmedBy, entry.confirmedAt]) },
      { name: 'Pending', headers: ['Record id', 'Line item (zero-based)', 'Field', 'Review'], rows: run.pendingKeyFields.map(entry => [entry.recordId, entry.lineItem === undefined ? '' : String(entry.lineItem), entry.field, entry.review]) },
      { name: 'Unexecuted', headers: ['Rule id', 'Outcome', 'Record ids', 'Reason'], rows: run.unexecutedRules.map(rule => [rule.ruleId, rule.outcome, JSON.stringify(rule.recordIds), rule.reason ?? '']) },
    ]
    const report = { schemaVersion: 1, packKind, status, statusText, packDisclaimer, ...run, counts, originals, evidence, mismatches }
    await writeFile(`${stage}/export-report.json`, JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 })
    const markdown = `# Invoice Gate verification pack\n\n**${statusText}**\n\n${packDisclaimer}\n\n` + tables.map(table => `## ${table.name}\n\n| ${table.headers.map(md).join(' | ')} |\n| ${table.headers.map(() => '---').join(' | ')} |\n` + table.rows.map(row => `| ${row.map(md).join(' | ')} |`).join('\n')).join('\n\n') + '\n'
    await writeFile(`${stage}/report.md`, markdown, { flag: 'wx', mode: 0o600 })
    const workbook = new ExcelJS.Workbook()
    for (const table of tables) {
      if (table.rows.length >= 1048576) throw new Error('xlsx-row-limit-exceeded')
      const sheet = workbook.addWorksheet(table.name)
      for (const row of [table.headers, ...table.rows]) {
        if (row.some(cell => cell.length > 32767)) throw new Error('xlsx-cell-limit-exceeded')
        const added = sheet.addRow(row)
        added.eachCell(cell => { cell.numFmt = '@' })
      }
      sheet.views = [{ state: 'frozen', ySplit: 1 }]
      sheet.columns.forEach(column => { column.width = 28 })
    }
    await writeFile(`${stage}/report.xlsx`, Buffer.from(await workbook.xlsx.writeBuffer()), { flag: 'wx', mode: 0o600 })
    if (!inside(root, await realpath(anchoredParent))) throw new Error('path-outside-project')
    await absent(target)
    // shortcut: single-operator rename; add no-replace coordination before supporting concurrent writers.
    await rename(stage, target)
    stage = undefined
    const relativeDir = relative(root, destination).split(sep).join('/')
    return { directory: relativeDir, files: { markdown: `${relativeDir}/report.md`, xlsx: `${relativeDir}/report.xlsx`, json: `${relativeDir}/export-report.json` }, packKind, status, counts }
  } finally {
    try { if (stage) await rm(stage, { recursive: true, force: true }) } finally { await parent.close() }
  }
}
