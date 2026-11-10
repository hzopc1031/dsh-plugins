# dsh-html-deck-export

**Unreleased 0.1.0 — feature branch only; not published to npm.**

This DSH plugin registers `html_deck_export` and `/html-deck-export` help/workbench.
It exports finished local HTML decks in supported formats to **image-based
16:9 PPTX**, with speaker notes and a per-page `export-report.json`.
HTML remains the source of truth. Nothing is uploaded automatically.
It does not generate decks, produce editable shapes, preserve animations,
or accept every HTML file.
Feishu already previews HTML; this exporter is for cases that specifically need PPTX.

**0.1.0 已提供受限 DSH 导出工具和本地 API。** 使用
`/html-deck-export start` 进入当前项目的导出工作台，将受支持格式的定稿 HTML 演示稿
导出为 **16:9 图片版 PPTX**，附讲稿备注和逐页报告。
HTML 始终是源文件，不会自动上传。不生成演示稿、不输出可编辑形状、
不保留动画，也不承诺兼容所有 HTML。

Requires Node.js >=22 and DSH `>=0.2.1-rc.5 <0.3.0`. APIs are checked against
DSH `0.2.2-rc.1`, source revision `fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159`.
The installed CLI successfully loaded the plugin in a disposable Linux web profile.
Command, tool restriction and guard APIs are also exercised with rc.5 host libraries.

Install the prebuilt feature branch into your chosen profile (replace `web` as needed):

```sh
dsh plugin --profile web add "github:hzopc1031/dsh-plugins#feat/html-deck-export&path:/packages/dsh-html-deck-export"
```

This branch is not merged into `main`. Built `lib/` is committed; installation
needs no build permission or lifecycle hook. Restart DSH after installation.
To uninstall, run `dsh plugin --profile web remove dsh-html-deck-export`.
Uninstalling removes the plugin; user PPTX files, reports and evidence remain in
their selected project directories.

Build and inspect the local tarball from this package directory:

```sh
npm ci
npm test
npm run verify-pack
npm pack --ignore-scripts
```

From the repository root, install that tarball into a chosen DSH profile:

```sh
dsh plugin --profile <name> add ./packages/dsh-html-deck-export/dsh-html-deck-export-0.1.0.tgz
```

The bundle inserts Cordis id `html-deck-export` with empty configuration.
It ships prebuilt `lib/`, pinned `puppeteer-core` and `pptxgenjs`. It has no lifecycle
install hooks or browser downloads. No client entry or Remote API is needed.

Select a local project in DSH, then run `/html-deck-export start`. This snapshots
the current `workingDirectory.get(session)` directory (or `session.header.cwd`
when that service is absent) as the allowed root. Only this conversation is
restricted to `html_deck_export`; other conversations retain their tools.
Use a DSH native tool executor: this workbench also denies `run_code` code
transports, so PTC-only conversations must switch to native tools first.
Ask DSH to export the finished deck with arguments such as:

```json
{
  "inputPath": "deck/index.html",
  "exportDirectory": "exports/review",
  "fileName": "review.pptx",
  "scale": 1,
  "format": "jpeg",
  "quality": 70
}
```

The export directory must already exist. Relative paths resolve from the
workbench root; absolute paths must stay within it. HTML, directly linked
detection scripts/styles and browser assets are checked lexically and through
realpath, including directory `index.html` and symlinks. The project root is
also the resource boundary, allowing sibling assets inside that project.
Supported contracts are 歸藏 preview, `#/N`, `?slide=N`, clearly fixed canvases
and top-level `section.slide` pages. Articles without a deck contract are refused.

Defaults are 1920×1080, scale 2, PNG and blocked network. Optional scale 1 or
JPEG with quality 1..100 reduces image bytes; quality applies only to JPEG.
Only explicit `allowNetwork: true` enables remote HTTP(S) GET/HEAD resource
reads. Write methods, WebSocket connections, form submissions, remote document
navigation, workers, popups and downloads remain blocked. No shell, login,
posting, publishing, model invocation or arbitrary browser callback is exposed.
Run trusted local decks only; disabled Chrome sandboxing and path checks do
not make hostile JavaScript safe.

The tool returns `pptxPath`, `reportPath` and the full report. Inspect its font,
resource, clipping and preview warnings before sharing the PPTX. Failed pages
prevent PPTX publication; inspect `export-report.json` and its evidence paths.
Use a separate existing directory per job; successful files can replace earlier
outputs there. `/html-deck-export stop` cancels this workbench's exports and
releases its tool restriction. Stopping the plugin or disposing the agent also
cancels captures and removes the restriction. Start again to pick a changed
project directory. No paths/history/settings are persisted by the plugin;
PPTX, report and evidence live in the selected user project, outside the
installed package, and survive package deletion or replacement.

无参数的 `/html-deck-export` 仅显示帮助。`start` 限制当前会话只用导出工具，
`stop` 取消导出并恢复工具。输入、素材和输出限于进入时的当前项目目录，输出目录
须已存在，报告不可写进插件安装目录。默认离线；仅显式 `allowNetwork: true`
允许远程 HTTP(S) GET/HEAD 素材读取。请审阅报告中的字体、资源和预览差异警告。

Static detection is available as `detectDeck(path)` from
`dsh-html-deck-export/detect`. Pass a local `.html`/`.htm` file or a directory
containing `index.html`. It returns the canonical input path, format,
one-based slides in DOM order, selectors, navigation URLs, available notes,
declared/fixed design size, and warnings. 歸藏 uses `?mode=preview&slide=N`;
hash decks use `#/N`. Generic slides use DOM activation during capture. Nested sections, marked clones, overview containers,
and templates are excluded. HTML without a slide contract is rejected.

Detection reads markup and directly linked local JavaScript/CSS; it never
executes deck code, fetches network resources, launches Chrome, or writes PPTX.
Pass `detectDeck(path, { resourceRoot })` to confine those reads to a canonical
root; the DSH tool always supplies its project root, including through adapters.
It supports explicit balanced markup, paired positive `data-export-width` /
`data-export-height`, and unambiguous simple fixed-pixel CSS. A detected size
is preserved as design metadata; capture must verify computed dimensions and
overflow. No default viewport is substituted for a fixed design canvas.

Static notes come from literal `window.__SPEAKER_NOTES__` maps or arrays
(including a local variable assignment), then `data-notes`, then `aside.notes`.
Array entries align by `id` to `data-slide-id`, never by array position.
String fields and lists of strings in structured notes become separate lines.
Absent notes remain absent. Computed JavaScript notes are flagged with
`runtimeNotes` and a warning; imported code, dynamic slides, the full
CSS cascade, and browser HTML repair also require runtime verification.
HTML notes decode numeric and common XML/HTML entities; capture must read
the actual DOM for other named entities and any runtime note updates.

Detector tests read the official magazine/swiss, 灵感 starter, and 王虹 fixtures
in place under `/workspace/dev/vendor/`; these local acceptance tests require
those checkouts. The MIT synthetic fixtures under `test/fixtures/` cover generic
slides, fixed canvas, and article rejection. No vendor themes are copied or
included in the npm package.

The capture engine is available to adapters from `dsh-html-deck-export/capture`:

```js
import { createCaptureEngine } from 'dsh-html-deck-export/capture'
const engine = await createCaptureEngine('/absolute/deck/directory', {
  scale: 2, // 1 or 2; changes pixel density, not layout dimensions
  format: 'png', // or 'jpeg' with quality: 1..100
  allowNetwork: false,
  signal: abortController.signal,
})
try {
  const page = await engine.capture('index.html', async browserPage => {
    // Trusted adapter: activate the intended slide here before readiness checks.
  })
  // Check page.status before consuming page.image. Failed images are evidence only.
} finally {
  await engine.close()
}
```

Chrome resolves from `CHROME_PATH`, otherwise `/usr/bin/google-chrome`. No user
profile is reused. `--no-sandbox` and `--disable-gpu` are required in the desktop
sandboxes on this box; sRGB is forced. Run only trusted local decks: this Chrome
configuration disables the OS sandbox and is not a security boundary for hostile
JavaScript. Each engine uses a temporary profile removed on close. Pass an
`AbortSignal` for cancellation and always close the engine in `finally`.

The viewport defaults to 1920×1080, deviceScaleFactor 2. A custom `viewport`
must also be 16:9; use a known fixed design size when appropriate. Neither scale
nor format changes the viewport or the deck's CSS design canvas. Only the full
viewport is captured, never a tall page or a section crop. Document overflow
produces a clipping warning. Deck adapters check slide geometry and report clipping.

After adapter preparation, capture hides `#nav`, `#hint`, and
`[data-export-chrome]` with `visibility:hidden`, preserving flex layout. It awaits
`document.fonts.ready`, image decoding, two animation frames (one paint), and a
150ms network-idle stability wait, then rechecks fonts/images. `timeoutMs` defaults to 15000;
`stabilityMs` is configurable. This does not settle arbitrary animation timelines;
the deck adapter finalizes the inspected format contracts after these waits.

Outbound HTTP(S) is blocked by default, including loopback. A dead proxy also
blocks sockets such as WebSocket; non-proxied WebRTC is disabled. Only explicit
`allowNetwork: true` permits HTTP(S) assets, including webfonts; remote document
navigation remains blocked. Local files
and child assets work offline. Every file request is checked against the chosen
canonical directory, including symlinks. Outside resources fail the page. Capture
documents apply CSP to block popups, downloads, and workers so they cannot bypass
page interception. Decks requiring those features are outside this engine's
current contract. Missing images fail; blocked resources, script errors, font
load errors and primary-font fallback are explicit warnings. Capture reports
computed font stacks and actual rendered font families from Chrome's DevTools
CSS API; these are diagnostics, not a guarantee of glyph coverage. The deck adapter fails 王虹 capture when its required handwritten font is unavailable.

Results contain status, URL, successful image bytes, warnings, font families,
elapsed time, and error text/best-effort screenshot evidence on failure. The
engine also exposes viewport, scale, format/quality, network policy and browser
version for the export report. The capture engine writes no output files.
Image bytes and rendering can vary across Chrome versions and machines.

Deck capture is available from `dsh-html-deck-export/adapters`:

```js
import { captureDeck } from 'dsh-html-deck-export/adapters'
const run = await captureDeck('/absolute/deck/index.html', {
  scale: 2, format: 'png', allowNetwork: false, signal: abortController.signal,
  // resourceRoot: '/absolute/deck-project', // explicitly allow sibling assets
})
for (const page of run.pages) {
  // status === 'captured': page.image is the full viewport PNG/JPEG.
  // status === 'failed': bytes is zero; image/error are failure evidence.
  console.log(page.index, page.id, page.status, page.notes, page.warnings)
}
```

The adapter closes Chrome in `finally` and returns every page in DOM order,
including failures. It writes no files. `run` contains the detected deck,
viewport, scale, format/quality, network policy, browser version, total successful
image bytes and elapsed time. Each page includes runtime notes, note source,
fonts, warnings and `renderState` (navigation, bounds, animation final-state
checks and chrome visibility), ready for the JSON/PPTX writer.

- 歸藏 opens each one-based `?mode=preview&slide=N` URL and verifies its runtime
  page index. Capture includes the entire composited viewport and any canvas
  outside the section. After fonts/images settle, it finishes finite Web
  Animations, pauses infinite CSS animations and forces the inspected entrance,
  pipeline and Swiss static-reveal targets visible. It does not call `go` or
  reconstruct animation timelines. JavaScript/Canvas backgrounds follow the
  source's preview mode. `renderState.preview` records low-power mode,
  background canvas counts and differences from live playback. In the official
  Swiss example, preview hides background canvases; the magazine example keeps
  its static effect canvases. These are preview images, not a promise of visual
  identity with live animation. Source preview rules that hide nav/hint with
  `display:none` are changed in memory to `visibility:hidden`, preserving their
  original display and flex space. Named `.chrome`, `.chrome-min`, `.gz-chrome`
  and `.foot` containers and the Swiss embedded swipe hint are also hidden with
  visibility rules and recorded as page chrome. The source files are never modified.
- Hash and query contracts navigate via `#/N` and `?slide=N`. DOM decks can
  expose `window.__goTo(i, { skipAnim: true })`, with **zero-based** `i`. Otherwise
  the adapter activates the chosen detected section and removes peer pages from
  layout. It preserves design dimensions and refuses invisible or overlapping
  pages. Arbitrary custom navigation is outside this contract.
- Runtime `window.__SPEAKER_NOTES__` entries match `data-slide-id`, including
  shuffled arrays of records. They take precedence over runtime `data-notes`
  and `aside.notes`; Chinese line breaks and browser-decoded entities survive.
  Nested-page notes are excluded and note asides are hidden without reflow.
- 王虹 requires 1920×1080 and a loaded/available `HanziPen SC` when requested
  by its CSS. An explicit `data-wanghong-font-ready` marker must be `true` if
  present. Missing HanziPen fails on this Linux box. The synthetic readiness
  fixture tests the success path with Noto; it makes no handwritten-font
  fidelity claim.
- Fixed canvases retain their CSS size. Non-1920 canvases/viewports and detected
  clipping produce warnings; no design canvas is stretched to fill the image.
  Asset access defaults to the HTML directory. Decks using `../assets` need an
  explicit `resourceRoot` containing both HTML and assets; lexical/realpath
  containment checks still apply. The DSH tool must confine that root to its
  authorized input boundary.

Offline capture warns explicitly about blocked Google Fonts, fallback fonts,
missing local scripts/styles and other failed resources. Missing non-document
resources are warnings so a deck's own static fallback can run (both official
歸藏 fixtures lack their optional local `motion.min.js` here). Missing images
still fail decoding; document failures and path escapes fail. Fix/embed resources
in the source for fidelity, or explicitly opt into `allowNetwork: true` for
remote assets. The choice is recorded; the adapter never enables network itself.
A warning-bearing image must be reviewed before it is treated as faithful.

The capture engine also accepts a third `finalize(page)` callback after its
readiness waits and before font diagnostics/screenshotting; deck adapters use
this for final-state validation. It is for trusted adapter code only.

Write a captured deck using `dsh-html-deck-export/export`:

```js
import { captureDeck } from 'dsh-html-deck-export/adapters'
import { exportCapturedDeck } from 'dsh-html-deck-export/export'

const controller = new AbortController()
const run = await captureDeck('/absolute/deck/index.html', {
  scale: 2, format: 'png', signal: controller.signal,
  // Smaller output: scale: 1, format: 'jpeg', quality: 65
  // Network stays blocked unless allowNetwork: true is explicitly supplied.
})
const result = await exportCapturedDeck(run, '/absolute/existing/export-directory', {
  fileName: 'deck.pptx', signal: controller.signal,
})
console.log(result.pptxPath, result.reportPath)
```

Each PPTX page contains one full-bleed image in a 16:9 slide; speaker notes go
into the notes pane, including Chinese line breaks. Images retain their original
PNG/JPEG bytes. No existing PPTX is read, merged or used as a source.

The writer accepts only a plain `.pptx` filename, without directory components
or absolute paths. The export directory must already exist. `export-report.json`
is fixed within that directory; existing output symlinks are replaced as directory
entries, never followed. Use a separate export directory per job: the report
describes the most recent attempt, including failures, and replaces the previous
report. The caller must confine the chosen export directory to its authorized
output boundary; the DSH tool enforces its project-root boundary.

The report records detected format, page count, viewport, scale, image format,
quality (`null` for PNG or Chrome's unspecified JPEG default), browser version,
network mode, per-page successful image bytes, font warnings and actual families,
notes, render state and preview/live differences. `totalBytes` sums successful
image bytes; `pptxBytes` measures the published ZIP including OOXML overhead.
`elapsedMs` includes capture and assembly/report preparation; `captureElapsedMs`
is also retained. Screenshot sizes vary with content, fonts and Chrome.

Every detected page must be present in order. If a page failed, no partial PPTX
is published: the writer saves a failed report, writes available screenshots to
a unique `.html-deck-export-*` evidence directory, and rejects with the report
path. `failedPages` includes reasons and relative evidence paths when available;
evidence bytes do not count as successful image bytes. Missing screenshot evidence
does not remove a failed page. Fix the source and export again.

PPTX and report files are staged within the export directory, flushed with
`fsync`, and renamed individually. Assembly, report-write and pre-publication
cancellation failures leave the previous PPTX intact. A failed report sets
`pptxBytes: 0` even if an older good PPTX remains. These are individual atomic
file replacements, not a crash-atomic transaction across both files; the report
is published before the PPTX. Pass the same signal to capture and writing;
capture cancellation closes Chrome and writer cancellation prevents publication.
Successful staging directories are removed; failed-page evidence is retained.

Export tests use Python 3's standard-library ZIP and XML parsers to check OOXML,
relationships, full-bleed images, byte identity/order and multiline Chinese notes.
Both official 歸藏 examples also round-trip their ordered notes and preview
differences through the PPTX and report. On this Linux box, the loaded DSH profile
produced magazine (8 pages), Swiss (8), an owned MIT generic fixture (1), and the
灵感 starter (3), all offline at scale 1 PNG. Each slide's embedded image was
extracted and contact sheets reviewed. LibreOffice Impress 25.2.3.2 imported all
four PPTX files and exported PDFs with matching page counts. PowerPoint and WPS
are unavailable here and were not opened; their application compatibility remains
unverified. The real 王虹 fixture fails because HanziPen SC is unavailable;
the synthetic loaded-font alias test verifies the gate, not handwritten fidelity.

MIT © 2026 hzopc1031. No fixture themes, scripts, or assets are bundled.
