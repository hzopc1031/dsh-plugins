# Changelog

## 0.1.0 — unreleased

- Add a local CNY invoice/ledger verification gate and evidence packs, available from the `feat/invoice-gate` git branch; not published to npm.
- Read explicitly mapped CSV/XLSX, documented structured/OCR JSON, labelled PDF text and the documented XML dialect. Inventory failures/skips and refuse OFD and scans without OCR JSON.
- Keep originals read-only with SHA-256, identifiers as strings, blanks distinct from zero and formula-only fields unchecked; execute no macros, links or formulas.
- Check exact integer-fen arithmetic, supplied line totals, duplicate numbers/hashes, optional buyers/dates and number-based ledger matches. List unexecuted and unimplemented rules; never delete, merge or repair invoices automatically.
- Separate extracted, normalized and human-confirmed values with before/after correction history. Pending key fields, input exceptions and mismatches prevent full confirmation; external verification remains not-checked.
- Atomically export draft-aware Markdown, XLSX text cells and JSON, with optional hash-checked original copies, real source pointers and textual expected/actual/difference/rule-id details. Preserve existing packs on failure.
- Provide `/invoice-gate` and three prefixed summary-only tools with project confinement, agent-scoped restrictions and guards. Reject model rewrite hooks and arbitrary PTC code during a run. No model calls, outbound network, auto-upload, Remote API or extra web panel.
- Include synthetic ingest/rule/export/native-tool integration tests, package checks, bilingual usage/schema docs and binding MVP decisions. Check a live isolated Linux DSH 0.2.2-rc.1 profile with synthetic samples.
- State limits explicitly: no OCR, authenticity/payment/reimbursement verification or accounting-archive certification.
