# Changelog

## 0.1.0

- Scaffold the installable `html-deck-export` DSH bundle with bilingual help.
- Added static detection of supported local deck formats and notes.
- Added the adapter-facing Chrome viewport capture engine with offline defaults,
  canonical resource containment, readiness checks, failure evidence, font diagnostics,
  cancellation, and scale/format controls.
- Add ordered viewport capture adapters with runtime notes for 歸藏 preview,
  hash/query, generic DOM and fixed canvases; record preview/live differences.
- Finalize inspected entrance/pipeline states after font readiness, preserve
  chrome layout, report clipping, and refuse unavailable 王虹 handwritten fonts.
- Report missing local non-document resources explicitly so source-provided
  static fallbacks can run; keep path escapes and broken images fatal.
- Add image-only 16:9 PPTX assembly with multiline speaker notes and per-page
  export reports, including font diagnostics, preview differences and failure evidence.
- Confine output filenames to the export directory, flush staged writes and
  atomically replace files; preserve completed PPTX files on failed attempts.
- Verify OOXML, Chinese notes, PNG/JPEG byte totals, smaller capture settings,
  path escapes, assembly errors, report-write failures and cancellation.
