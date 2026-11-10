# dsh-invoice-gate

**Under development, version 0.1.0. Not published to npm.**

A local verification gate + evidence pack for invoices and spreadsheets, under development. A local ingest library is available; the DSH command still provides help only. 核对规则、证据导出、DSH 导入工具和界面尚未实现。

Requires Node.js >=22 and DSH `>=0.2.1-rc.5 <0.3.0`. API reference: DSH `0.2.2-rc.1`, source commit `fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159`.

This is not OCR or tax-bureau verification (验真). The model must never invent or rewrite amounts, tax, totals or identifiers. There is no amount-rewrite tool. Ingest reads explicitly selected local files, hashes originals and inventories failures without modifying originals. It makes no model calls and uses no outbound network; nothing is uploaded automatically.

The library accepts explicitly mapped CSV/XLSX, documented structured/OCR JSON, labelled PDF text layers and the fixture-backed Invoice XML dialect. OFD and images/scanned PDFs without OCR JSON are refused. Read [docs/inputs.md](docs/inputs.md) for the API, JSON schema, supported XML shape and limitations. `ingest` returns raw evidence for local processing; never dump its result into model context.

Arithmetic checks do not establish authenticity, payment or reimbursability. An evidence pack does not establish accounting-archive compliance. SHA-256 detects file changes; it does not prove a ticket is genuine.

The complete binding scope and deferred behavior are in [docs/decisions.md](docs/decisions.md). Future tools must return counts, ids and file paths by default, without full reports, original text or amount tables in the model context.

To install this local checkout into a disposable profile from the repository root:

```sh
dsh plugin --profile invoice-gate-demo add ./packages/dsh-invoice-gate
```

The bundle inserts Cordis id `invoice-gate`. Use `/invoice-gate` or `/invoice-gate help` in a command-capable DSH interface. Other actions return an explicit not-implemented error. No client bundle, tools or Remote API are registered yet.

To build and check the independent package:

```sh
cd packages/dsh-invoice-gate
npm ci --omit=optional
npm test
npm run verify-pack
```

Prebuilt `lib/` and declarations are committed; installation has no lifecycle build hooks. MIT © 2026 hzopc1031.

Optional PDF rendering dependencies are unnecessary for text extraction and were omitted in testing. PDF.js may print missing-canvas/polyfill warnings; this package does not render PDFs.
