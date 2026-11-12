# Changelog

## 0.1.1 - 2026-11-12

- 合并内网代理 / CA 诊断分支与 main 的 DSH 0.2.2-rc.1 兼容修复（merge intranet proxy/CA diagnostics with main's 0.2.2-rc.1 compatibility）；本包沿用 main 版本及 engines / peer 范围。
- 本包无额外运行时改动；保留原功能及历史发布记录。

## 0.1.1 - 2026-11-11

- 修正 DSH 版本声明为 `>=0.2.1-rc.5 <0.3.0-0`，采用官方包含预发布版本的校验规则，并排除 0.3.0 预发布版本。
- 放宽 DSH peer 范围，显式覆盖 rc.5 / rc.1 的标准 npm semver 安装校验；开发依赖保持原版本。
- 同步锁文件自身版本、打包断言及当前版本标识；兼容性声明不等于逐版本功能验证。

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
