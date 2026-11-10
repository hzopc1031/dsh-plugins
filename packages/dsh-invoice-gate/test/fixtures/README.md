# SAMPLE / 示例 / 非真实票据

Every file here is synthetic. Names, dates, identifiers and amounts describe test cases, never real invoices. The one-pixel image and image-only PDF are synthetic raster refusals; their label is recorded here because they contain no text layer. `generate.mjs` recreates these fixtures using the package's pinned libraries; run `node test/fixtures/generate.mjs` from the package directory. Its assertions verify identifier preservation and PDF cross-reference offsets.

- `clean.csv`, `invoice.xml`, `text.pdf`: 100.00 + 6.00 = 106.00, 20-digit **string** identifier.
- `tickets.json` + `ledger.csv`: shared identifier and one unmatched record on each side, retained for later reconciliation tests.
- `mismatch.json`: 100.00 + 6.00 vs original total 108.00. Ingest must preserve 108.00. Rules come later.
- `ocr.json`: documented user-supplied raw fields and asserted page/box metadata.
- `ledger.xlsx`: Chinese headers, text identifier, blanks, numeric identifier refusal, formula with/without cache, hyperlink, blank row and unselected sheet. An inert `vbaProject.bin` marker and an external-link relationship exercise nonexecution; this is not executable VBA or a claim of testing Office.
- `duplicate-a.csv`, `duplicate-b.csv`: bit-identical files retained independently.
- `unknown.xml`, `sample.ofd`, `scan.png`, `scan.pdf`: explicit refusals. `mixed.pdf`: labelled first page plus refused image-only second page.
- `edge-labels.pdf`: repeated amount labels and blank tax; no adjacent label can become the blank tax value.

No fixtures or generators are shipped in the npm package.
