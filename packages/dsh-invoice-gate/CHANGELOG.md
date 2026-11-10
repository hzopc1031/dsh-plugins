# Changelog

## 0.1.0 — in development

- Scaffold the DSH bundle and `/invoice-gate` help.
- Preserve the binding MVP decisions in `docs/decisions.md`.
- Add TypeScript build, smoke tests and package allowlist verification.
- Add confined, read-only CSV/XLSX, structured/OCR JSON, labelled PDF text and fixture-backed XML ingest with SHA-256 and exception inventory.
- Preserve string identifiers, blanks, cached formula values and source pointers; refuse OFD and scans without OCR JSON.
- Add synthetic fixtures and ingest tests; document supported input schemas and limits.
- Add deterministic BigInt integer-fen rules, explicit unchecked/unimplemented results, duplicate reporting, optional buyer/period checks and number-based ledger reconciliation.
- Keep extracted, normalized and human-confirmed values separate, validate corrections JSON provenance, and gate full confirmation on key reviews, rule outcomes and ingest exceptions.
- Add synthetic reconciliation tests and document the rules/result/corrections contract.
- Add confined, atomic Markdown/XLSX/JSON packs, optional hash-checked original copies and explicit summary-only/draft status.
- Preserve textual red flags, evidence pointers, string identifiers, separate value layers, corrections, inventories, unexecuted rules and verification disclaimers in exports; add export tests and API docs.
- Wire three prefixed summary-only ingest/check/export tools and a thin slash-command UI for start/status/stop and model-free runs.
- Pin human-selected local manifests and corrections, restrict the owning agent’s tools, guard alternate execution paths and reject model rewrite/verbose hooks; keep errors redacted.
- Test native DSH execution, scope/disposal, path escapes, immutable originals, payload privacy, rewrite rejection and network-free operation. No Remote API or web panel.
