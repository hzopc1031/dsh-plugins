# Changelog

## 0.1.0 (unreleased)

- Retain Chrome's sandbox on the first launch; retry once with `--no-sandbox`
  only for recognized sandbox startup failures. Record actual launch arguments,
  sandbox outcome and fallback reason; continue to require trusted local decks.
- Add a Chinese `export-report.md` sidecar and readable tool summaries with
  requested/actual font fallback diagnostics, failed-page reasons and screenshot
  evidence paths (or explicit absence). Refuse missing required HanziPen SC
  with a Chinese error rather than treating a fallback font as success.
- Add atomic `export-progress.json` feedback through the tool's `exportDeck()`
  path: launch, page capture, assembly and terminal state, with errors and report
  paths. Preserve the previous PPTX when progress or report publication fails.
- Test sandbox retry/cancellation, Chinese sidecars, font fallback and failed
  progress. Recheck installed Linux DSH 0.2.2-rc.1 with offline scale-1 exports,
  failed-page evidence and missing-HanziPen refusal; retain samples outside Git.
- Add the prebuilt `html-deck-export` DSH bundle, bilingual help, and one
  deterministic `html_deck_export` tool with a conversation-scoped workbench.
- Detect supported local 歸藏, hash/query, generic section and fixed-canvas
  decks; reject articles without a deck contract.
- Capture full 16:9 viewports with isolated system Chrome, font/image readiness,
  final static entrance/pipeline states, and hidden chrome that preserves layout.
- Preserve fixed design canvases, align runtime notes by slide ID, report
  preview/live differences, clipping, missing resources and actual fonts, and
  refuse unavailable 王虹 handwritten fonts.
- Write image-based PPTX with multiline Chinese notes and per-page JSON reports;
  retain failure evidence and preserve completed PPTX files on failed attempts.
- Block network by default; support explicit GET/HEAD asset opt-in, scale 1/2,
  PNG/JPEG and JPEG quality. Confine tool paths to the selected project, apply
  scoped restriction/guards, and propagate cancellation to Chrome.
- Verify official 歸藏 notes/report round trips, loaded-font gating, OOXML,
  output containment, atomic replacement and offline/opt-in behavior. Load in
  DSH 0.2.2-rc.1 and export four local samples; verify LibreOffice PDF page counts.
  PowerPoint/WPS and real HanziPen rendering remain unverified on this box.
