# dsh-invoice-gate

**Under development, version 0.1.0. Not published to npm.**

A local verification gate + evidence pack for invoices and spreadsheets, under development. Local ingest, deterministic checks and evidence exports are available through confined DSH tools and `/invoice-gate` commands. 本地导入、确定性核对和证据包导出已接入 DSH 工具与命令。

Requires Node.js >=22 and DSH `>=0.2.1-rc.5 <0.3.0`. API reference: DSH `0.2.2-rc.1`, source commit `fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159`.

This is not OCR or tax-bureau verification (验真). The model must never invent or rewrite amounts, tax, totals or identifiers. There is no amount-rewrite tool. Ingest reads explicitly selected local files, hashes originals and inventories failures without modifying originals. It makes no model calls and uses no outbound network; nothing is uploaded automatically.

The library accepts explicitly mapped CSV/XLSX, documented structured/OCR JSON, labelled PDF text layers and the fixture-backed Invoice XML dialect. OFD and images/scanned PDFs without OCR JSON are refused. Read [docs/inputs.md](docs/inputs.md) for the API, JSON schema, supported XML shape and limitations. `ingest` returns raw evidence for local processing; never dump its result into model context.

`reconcile(ingestResult, options?, corrections?)` checks integer-fen arithmetic, line totals, duplicate numbers/hashes, optional buyer/period rules and number-based ledger matches. Raw, normalized and human-confirmed values remain separate; optional corrections JSON carries before/after provenance. Missing fields stay unchecked and block full confirmation. Read [docs/reconciliation.md](docs/reconciliation.md) for the result contract, rules and correction schema. The full library result must stay out of model context.

`exportPack(projectDir, newRelativeDirectory, result, { includeOriginals: false })` atomically writes Markdown, XLSX text cells and JSON, with optional hash-checked original copies. Packs show textual red flags, source pointers, inventories, separate value layers and draft status for unresolved runs. Existing directories are refused. Its return value contains only paths, status and counts. Read [docs/exports.md](docs/exports.md) for the contract and limits. The DSH export tool returns the same compact summary inside the run status.

Arithmetic checks do not establish authenticity, payment or reimbursability. An evidence pack does not establish accounting-archive compliance. SHA-256 detects file changes; it does not prove a ticket is genuine.

The complete binding scope and deferred behavior are in [docs/decisions.md](docs/decisions.md). Tools return counts, run ids, status and file paths only; full reports, original text and amount tables stay in local files. There is no verbose opt-in or correction-writing tool.

To install this local checkout into a disposable profile from the repository root:

```sh
dsh plugin --profile invoice-gate-demo add ./packages/dsh-invoice-gate
```

The bundle inserts Cordis id `invoice-gate`. Use `/invoice-gate` or `/invoice-gate help` in a command-capable DSH interface. Read [docs/tools.md](docs/tools.md) for the manifest, commands and three tools. The slash command is the thin UI; no client bundle or Remote API is registered.

Create a local manifest selecting existing files, then use `/invoice-gate start SAMPLE-run.json`, `/invoice-gate ingest`, `/invoice-gate check`, `/invoice-gate export SAMPLE-pack`, `/invoice-gate status`, and `/invoice-gate stop`. Start pins the current project directory and masks other tools for this agent until stop; a guard also blocks scoped tools, descendant calls and PTC `run_code`. Use the native executor for model tool calls; slash commands need no model. The plugin does not change the host executor. A run is in memory; stop or plugin/session disposal clears it and leaves exported files intact.

To build and check the independent package:

```sh
cd packages/dsh-invoice-gate
npm ci --omit=optional
npm test
npm run verify-pack
```

Prebuilt `lib/` and declarations are committed; installation has no lifecycle build hooks. MIT © 2026 hzopc1031.

Optional PDF rendering dependencies are unnecessary for text extraction and were omitted in testing. PDF.js may print missing-canvas/polyfill warnings; this package does not render PDFs.
