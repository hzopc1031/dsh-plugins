# Local ingest library (task 2)

This library extracts evidence only. The separate [reconciliation library](reconciliation.md) provides integer-fen rules and human confirmations; export and DSH ingest tools are later tasks. No extracted amount or identifier is rewritten, corrected or inferred. No model or network call is required. Arithmetic is not authenticity, payment or reimbursability; evidence does not establish accounting-archive compliance.

```js
import { ingest } from 'dsh-invoice-gate'
const result = await ingest('/absolute/project/directory', [
  { path: 'ledger.csv', kind: 'ledger', mapping: {
    date: '开票日期', number: '发票号码', buyer: '购买方', seller: '销售方',
    amount: '金额', tax: '税额', total: '价税合计', currency: '币种', materialType: '材料类型',
  } },
  { path: 'tickets.json', kind: 'ticket' },
  { path: 'scan.pdf', kind: 'ticket', ocrJson: 'ocr.json' },
])
```

`ingest(projectDir, inputs)` accepts a list of files, never recursively scans directories, and reads originals only. Relative paths must stay inside the canonical project directory. Absolute input paths, `..` components and escaping symlinks are rejected; final-component symlinks are refused. Confined reads use a private Node process whose working directory pins each ancestor from the filesystem root. Each directory must be a non-symlink and retain its device/inode across entry; the final file is opened read-only with `O_NOFOLLOW` and checked as a regular file. In-project directory aliases are canonicalized before traversal. The host working directory never changes, no shell is used, and neither `/proc/self/fd` nor `/dev/fd` is needed. Tests force both fd-path filesystems to fail on Linux; native macOS and Windows have not been run. A missing or invalid project directory rejects the call; individual input failures are inventoried and subsequent inputs continue. Export and status writes use the same private-cwd approach without fd paths; see [exports.md](exports.md).

`result.files` includes every requested original and explicit OCR sidecar, SHA-256 (or `null` when unreadable), status and safe reason codes. `result.inventory` includes file, worksheet, page and logical row outcomes: `parsed`, `partial`, `skipped`, `refused`, `failed`. Blank rows, headers, unselected sheets/rows and malformed rows have reasons. A damaged file whose pages/rows cannot be enumerated has a file failure; the parser does not invent a count. `result.records` retains accepted rows/pages; partial results must not be treated as a complete run. Repeated files/hashes and invoice numbers remain present; this layer does not deduplicate.

Each record contains `id`, `fileId`, `kind`, `fields`, optional `label` and `lineItems`. Sidecar records additionally link `originalFileId`. Field names are `date`, `number`, `buyer`, `seller`, `amount`, `tax`, `total`, `currency`, `materialType`. Each extracted field contains:

- `raw`: string or `null`; missing fields are `null`, never zero. An empty JSON/CSV string stays empty. An empty XLSX cell is `null`.
- `source`: file and original raw value, plus only actual coordinates available from the input: CSV logical row/column path; XLSX sheet/cell; JSON pointer; XML path; PDF page/excerpt; user-supplied OCR page/box. Missing fields have `source: null` (无来源／待核). OCR coordinates are user assertions, not verified geometry.
- `review`: `pending` or `unreadable`; extraction never confirms a field. `issue` explains unusable spreadsheet values or ambiguous PDF labels. No normalization, confirmed values, rule results or external verification are fabricated here.

**The full library result contains financial evidence and must not be returned directly to the host model.** Future tools must reduce this to counts, ids and paths. Safe inventory error reasons omit original field contents and parser exception text.

## CSV / XLSX

UTF-8 CSV (optional BOM), GBK and GB18030 are accepted. A UTF-8 BOM requires valid UTF-8; otherwise strict UTF-8 is tried first, then strict GB18030 (which covers GBK). ASCII stays UTF-8. The file inventory entry's `encoding` is `utf-8` or `gb18030`, naming the decoder used rather than guessing which legacy encoding produced the bytes. Invalid bytes yield `csv-encoding-invalid-utf8-or-gb18030`, with the failure and original hash inventoried; no replacement decoding is used. JSON (including manifests and OCR fields) and XML retain their UTF-8 requirement.

CSV uses a comma delimiter, RFC-style quoted fields, escaped quotes and multiline fields. Row numbers are logical record numbers including header. Explicit field-to-exact-header mapping is mandatory; missing/duplicate mapped headers refuse the table. No templates or column guessing. Extra columns remain in the hashed original and are not extracted. Malformed CSV rows are failures; a quote error can make the remaining logical row boundaries unknowable.

XLSX uses the first row of each selected sheet as headers. Optional `sheet` selects an exact worksheet name; otherwise all sheets are attempted with the same explicit mapping. Hidden sheets are inventoried too. Numeric identifier cells are **unreadable** (`identifier-must-be-text`), because leading zeros or digits may already be lost; format invoice-number cells as text before supplying the file. Stored numeric amount values are preserved as decimal strings without doing arithmetic. Excel date cells are returned as ISO dates with their stored date representation in the source; text dates remain unchanged.

Macros, hyperlinks, external links and formulas are never executed or refreshed. Only a formula's cached result is read; `source.formula` retains formula text when there is a cached value. No cache yields `raw: null`, `review: unreadable`, `issue: formula-without-cache`, and formula text in `source.raw`. CSV values starting with `=` receive the same issue. Unsupported cell objects are unreadable. XLSM/XLS/OFD are unsupported; no Office process is started.

## Structured JSON / user-supplied OCR JSON v1

The following is the complete accepted envelope. All examples are synthetic **SAMPLE / 示例 / 非真实票据**. JSON numeric amounts/identifiers are refused, never coerced through JS numbers. `schemaVersion` is the number `1`; `type` is `tickets`, `ledger`, or `ocr`. It determines the record kind, regardless of the caller's table `kind`. `records` is a nonempty array. `label` is optional at envelope or record level; a record label overrides the envelope label. Unknown keys at each level are refused.

```json
{
  "schemaVersion": 1,
  "type": "ocr",
  "label": "SAMPLE 示例 非真实票据",
  "records": [{
    "fields": {
      "date": "2026-11-01",
      "number": { "raw": "12345678901234567890", "page": 1, "box": [0, 0, 100, 20] },
      "buyer": "SAMPLE 示例买方",
      "seller": "SAMPLE 示例卖方",
      "amount": { "raw": "100.00" },
      "tax": "6.00",
      "total": "108.00",
      "currency": "CNY",
      "materialType": "SAMPLE 非真实票据"
    },
    "lineItems": [{ "total": "108.00", "materialType": "SAMPLE 非真实票据" }]
  }]
}
```

`fields` and each optional `lineItems` element are objects using only the field names above; fields may be omitted. A field is either a string, `null`, or `{ "raw": string | null, "page"?: positive integer, "box"?: [left, top, right, bottom] }`. Boxes must contain four finite nonnegative numbers with ordered corners. Box units and coordinate system belong to the user's OCR source and are not inferred. Coordinates are retained verbatim and not validated against page dimensions. No values are synthesized for missing fields. An invalid record is inventoried and other valid records survive.

For images/scans, explicitly supply `ocrJson` on the original input. Both original and sidecar are hashed and confined; sidecar must use `type: "ocr"`. With a PDF sidecar, PDF pages are enumerated and marked skipped in favor of that sidecar; no PDF/OCR records are auto-merged. A missing/invalid sidecar leaves a partial original and a failed/refused sidecar. Standalone OCR JSON is also accepted. No OCR engine is bundled.

## Text-layer PDF

PDF.js extracts text only, with evaluation disabled, no rendering or actions, and no remote assets configured. Each page is inventoried separately. One ticket per labelled page is supported. Exact line labels followed by `:` or `：` are:

| Field | Accepted labels |
| --- | --- |
| date | Date / 开票日期 |
| number | Number / 发票号码 |
| buyer | Buyer / 购买方 |
| seller | Seller / 销售方 |
| amount | Amount / 金额 |
| tax | Tax / 税额 |
| total | Total / 价税合计 |
| currency | Currency / 币种 |
| materialType | MaterialType / 材料类型 |

Repeated labels make that field unreadable; absent labels remain missing. Arbitrary visual layouts, line-item reconstruction and unlabelled numbers are not guessed. A page without extractable text is refused with `no-text-layer-provide-ocr-json`; unrecognized labels yield `unrecognized-pdf-labels-provide-ocr-json`. Provide structured OCR JSON for unsupported layouts. Truncated PDFs lacking EOF are refused. No text dump is logged.

## Electronic-invoice XML

Only the narrow **Invoice v1 fixture dialect** below is supported. This is an explicit interchange shape, **not a claim of compatibility with a national/tax-bureau/vendor XML standard**. Add a representative synthetic fixture before adding another structure. It uses one `<Invoice schemaVersion="1">` root, optional `<Label>`, optional field elements with the same exact names as JSON, and optional `<lineItems><item>…field elements…</item></lineItems>`. Values stay strings. Nested field objects, duplicate scalar elements, namespaces, unknown elements/attributes, DTDs and declared entities are refused. Entity references are not expanded. Unknown XML is refused clearly (`unknown-xml-structure`); nothing is inferred from arbitrary XML.

```xml
<Invoice schemaVersion="1">
  <Label>SAMPLE 示例 非真实票据</Label>
  <number>12345678901234567890</number>
  <buyer>SAMPLE 示例买方</buyer><seller>SAMPLE 示例卖方</seller>
  <date>2026-11-01</date><currency>CNY</currency>
  <amount>100.00</amount><tax>6.00</tax><total>106.00</total>
  <materialType>SAMPLE 非真实票据</materialType>
  <lineItems><item><total>106.00</total></item></lineItems>
</Invoice>
```

OFD is explicitly out of MVP. Raster images without OCR JSON are refused. No mailbox, account login, scraping, auto-upload, tax verification or amount-rewrite API exists.
