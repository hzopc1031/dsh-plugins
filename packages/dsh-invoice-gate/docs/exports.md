# Local evidence pack writer

`exportPack(projectDir, directory, reconciliationResult, options?)` writes a new pack directory inside the project. It uses the installed ExcelJS dependency, local filesystem and SHA-256 only. No model, DSH service or network connection is needed. DSH commands and tools call this library; see [tools.md](tools.md).

```js
import { ingest, reconcile, exportPack } from 'dsh-invoice-gate'

const project = '/absolute/project'
const data = await ingest(project, [{ path: 'SAMPLE-tickets.json', kind: 'ticket' }])
const run = reconcile(data)
const summary = await exportPack(project, 'SAMPLE-pack-01', run, {
  includeOriginals: true, // default false
})
// summary contains only relative paths, status, kind and counts.
// Keep data, run and the report files local; they contain financial evidence.
```

The directory must be a **new relative path**; its parent must already exist. Absolute paths, `..`, escaping symlinks, non-directory parents and existing destinations (including symlinks and empty directories) are refused. Use a new name for each export. Outputs never overwrite originals or a previous pack. Private Node processes pin ancestors in their working directory without `/proc/self/fd` or `/dev/fd`. The writer checks directory device/inode across entry, its canonical location and all ancestor identities before publishing by rename; copied originals use the confined read-only reader and must match their ingest SHA-256. Staging is removed on failure. Tests force both fd paths to fail on Linux; native macOS/Windows have not been tested. The final parent and copied source leaf must not be symlinks.

The writer creates a private staging directory beside the destination, writes all three reports and optional originals there, then publishes the completed directory with one rename. Errors remove staging and leave existing packs unchanged. This is single-operator publication, not a concurrent multi-writer protocol or power-loss durability guarantee; do not move project directories while an export runs. XLSX's row/cell limits cause an explicit failure rather than silent truncation.

## Contents

- `report.md`: text report with status, disclaimer, every rule outcome, separate field layers, complete inventory, file hashes, corrections audit, pending fields and unexecuted/unimplemented rules. Mismatches show **rule id, expected, actual and difference**. Difference is actual minus expected; a nonnumeric/unavailable difference explicitly says `不适用／无法计算`.
- `report.xlsx`: the same eight sections as worksheets: Summary, Rules, Fields, Inventory, Files, Corrections, Pending, Unexecuted. All populated cells use string values and Excel text format (`@`), including 20-digit identifiers and integer-fen strings. Raw identifiers are literal strings without added quote characters. Raw nulls say `未提取（null）`; blanks remain blank. Normalized and confirmed columns hold separate JSON objects, including exact fen, issues and human confirmation metadata. Formula-like raw strings are inert text; no formula is written or recalculated. Excel/LibreOffice desktop validation has not been performed in this task.
- `export-report.json`: schema version 1, the full freshly derived reconciliation result (rules version, extracted files/inventory/records, normalized/confirmed fields, corrections, options, rule outcomes, unexecuted rules, pending key fields, confirmation gate and external status), plus pack kind/status/disclaimer, counts, explicit mismatch list, flattened evidence and an originals mapping. Fen and identifiers stay strings. Same inputs/options/corrections produce identical JSON and Markdown contents; ZIP/container timestamps mean XLSX bytes need not be identical.
- Optional `originals/0001.ext`, etc.: exact read-only-source copies, with relative `packPath` pointers in the originals mapping and Files table. The original project path, file id and ingest hash remain separately recorded. Export filenames use ordinal numbers, so repeated source selections are not merged. Each copy must match its ingest SHA-256. Missing hashes, missing/unreadable originals, changed files or unsafe source paths abort the entire export. Even refused-but-readable files are copied when requested; they remain refused in the inventory.

`packKind` is `with-originals` or `summary-only`. Summary-only packs do not re-read originals; their evidence availability is `referenced-not-bundled`, and the report explicitly says current source availability was not rechecked. A pack with originals marks sources `bundled`. A field without evidence has `no-source` and the explicit pointer `无来源／待核`. Coordinate-free evidence also says `无来源／待核`. Actual sheet/cell/raw, JSON/XML path/raw, or PDF page/excerpt metadata is preserved exactly; OCR coordinates remain user assertions. Copy paths are resolved relative to the pack, source paths relative to the project. No source coordinates are inferred from export workbook cells.

Field layers stay separate in all formats: **extracted raw**, **normalized**, **human-confirmed**, field-review state and the original evidence pointer. Optional line items use their existing zero-based index. Corrections retain before/after/reviewer/time audit entries; they neither replace extraction nor fabricate an original source coordinate. SAMPLE / 示例 / 非真实票据 labels remain visible.

## Status and model boundary

The exporter re-runs the current rules from `result.extracted`, `result.options` and `result.corrections`; edited/stale result flags, normalized values or rule lists are ignored. Unknown rules versions are refused. Corrections must be supplied by a human local-file workflow, never a model rewrite hook. This library cannot authenticate the reviewer identity.

`status: draft` is visibly **DRAFT / 草稿** whenever reconciliation leaves mismatches, pending/unreadable key fields, required unchecked rules or unresolved ingest exceptions. Clean, human-confirmed runs use `locally-confirmed` / 本地字段核对完成（外部核验未执行）. Empty runs remain draft. Neither status removes the disclaimer; external verification is always `not-checked`.

The pack **does not prove authenticity, payment or reimbursability**, and **is not an accounting-archive certification**. **SHA-256 only detects file change**; it does not establish that a ticket is genuine.

The returned `ExportSummary` contains only directory/report paths, pack kind, status and counts of records/mismatches/pending key fields/copied originals. It contains no amount table, buyer/seller names, invoice numbers or original text. Future DSH tools must preserve this boundary and must not return full report contents or the reconciliation object into model context. Nothing is uploaded automatically.
