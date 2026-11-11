# Changelog

## 0.1.1 - 2026-11-11

- 修正 DSH 版本声明为 `>=0.2.1-rc.5 <0.3.0-0`，采用官方包含预发布版本的校验规则，并排除 0.3.0 预发布版本。
- 放宽 DSH peer 范围，显式覆盖 rc.5 / rc.1 的标准 npm semver 安装校验；开发依赖保持原版本。
- 同步锁文件自身版本、打包断言及当前版本标识；兼容性声明不等于逐版本功能验证。

## 0.1.0 — unreleased

- Decode CSV strictly as UTF-8 then GB18030 (including GBK), preserve encoding in inventories and exports, and keep JSON manifests UTF-8.
- Read confined originals/manifests/confirmations without procfs/fd paths; test forced fd-path failures and ancestor replacement on Linux. Extend the same private-cwd approach to export/status writes and copied-original reads; recheck ancestor identity before atomic publication. Native macOS/Windows were not run.
- Write an atomic Chinese per-run status Markdown file and matching command recap; keep model-tool results compact. Explain refusals with actual source locations, safe Chinese messages and next steps.
- Keep ExcelJS 4.4.0 and override its uuid to 11.1.1. Package-root production audit on 2026-11-11 reports zero findings; document the separate consumer-root override requirement. Verify CommonJS v4 compatibility, XLSX text identifiers and preservation of previous packs on failure.
- Recheck all 76 tests and package contents, including forced fd-path failures in real export/status subprocesses, replacement refusals and failure preservation. Run GBK, mismatch and OFD-refusal samples in disposable Linux DSH 0.2.2-rc.1 with fd paths disabled and no model. Command-only result cards remain absent; local status files and packs carry the results.

- Add a local CNY invoice/ledger verification gate and evidence packs, available from `main`; not published to npm.
- Read explicitly mapped CSV/XLSX, documented structured/OCR JSON, labelled PDF text and the documented XML dialect. Inventory failures/skips and refuse OFD and scans without OCR JSON.
- Keep originals read-only with SHA-256, identifiers as strings, blanks distinct from zero and formula-only fields unchecked; execute no macros, links or formulas.
- Check exact integer-fen arithmetic, supplied line totals, duplicate numbers/hashes, optional buyers/dates and number-based ledger matches. List unexecuted and unimplemented rules; never delete, merge or repair invoices automatically.
- Separate extracted, normalized and human-confirmed values with before/after correction history. Pending key fields, input exceptions and mismatches prevent full confirmation; external verification remains not-checked.
- Atomically export draft-aware Markdown, XLSX text cells and JSON, with optional hash-checked original copies, real source pointers and textual expected/actual/difference/rule-id details. Preserve existing packs on failure.
- Provide `/invoice-gate` and three prefixed summary-only tools with project confinement, agent-scoped restrictions and guards. Reject model rewrite hooks and arbitrary PTC code during a run. No model calls, outbound network, auto-upload, Remote API or extra web panel.
- Include synthetic ingest/rule/export/native-tool integration tests, package checks, bilingual usage/schema docs and binding MVP decisions. Check a live isolated Linux DSH 0.2.2-rc.1 profile with synthetic samples.
- State limits explicitly: no OCR, authenticity/payment/reimbursement verification or accounting-archive certification.
