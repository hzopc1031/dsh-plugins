# Changelog

## 0.1.0 — in development

- Scaffold the DSH bundle with a help-only `/invoice-gate` command.
- Preserve the binding MVP decisions in `docs/decisions.md`.
- Add TypeScript build, smoke tests and package allowlist verification.
- Add confined, read-only CSV/XLSX, structured/OCR JSON, labelled PDF text and fixture-backed XML ingest with SHA-256 and exception inventory.
- Preserve string identifiers, blanks, cached formula values and source pointers; refuse OFD and scans without OCR JSON.
- Add synthetic fixtures and ingest tests; document supported input schemas and limits.
- Add deterministic BigInt integer-fen rules, explicit unchecked/unimplemented results, duplicate reporting, optional buyer/period checks and number-based ledger reconciliation.
- Keep extracted, normalized and human-confirmed values separate, validate corrections JSON provenance, and gate full confirmation on key reviews, rule outcomes and ingest exceptions.
- Add synthetic reconciliation tests and document the rules/result/corrections contract.
- Evidence export, DSH ingest/check/export tools and UI remain unimplemented.
