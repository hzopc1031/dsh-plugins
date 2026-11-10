# dsh-html-deck-export

**Incomplete scaffold, version 0.1.0. Export is not implemented yet.**

This DSH plugin currently registers only `/html-deck-export` help. The planned
MVP exports finished local HTML decks in supported formats to **image-based
16:9 PPTX**, with speaker notes and a per-page `export-report.json`.
HTML remains the source of truth. Nothing is uploaded automatically.
It does not generate decks, produce editable shapes, preserve animations,
or accept every HTML file.

**当前为未完成的脚手架（0.1.0），尚不能导出。** 仅注册
`/html-deck-export` 帮助命令。计划将受支持格式的本地定稿 HTML 演示稿
导出为 **16:9 图片版 PPTX**，附讲稿备注和逐页报告。
HTML 始终是源文件，不会自动上传。不生成演示稿、不输出可编辑形状、
不保留动画，也不承诺兼容所有 HTML。

Requires Node.js >=22 and DSH `>=0.2.1-rc.5 <0.3.0`. APIs are checked against
DSH `0.2.2-rc.1`, source revision `fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159`.
The scaffold uses command APIs already used by the sibling rc.5 packages;
later export APIs may require revisiting this range.

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
It ships prebuilt `lib/` and a pinned `puppeteer-core` driver. It has no lifecycle
install hooks, browser downloads, model tool, or client entry at this stage.

Static detection is available as `detectDeck(path)` from
`dsh-html-deck-export/detect`. Pass a local `.html`/`.htm` file or a directory
containing `index.html`. It returns the canonical input path, format,
one-based slides in DOM order, selectors, navigation URLs, available notes,
declared/fixed design size, and warnings. 歸藏 uses `?mode=preview&slide=N`;
hash decks use `#/N`. Generic slides require DOM activation by the later
capture implementation. Nested sections, marked clones, overview containers,
and templates are excluded. HTML without a slide contract is rejected.

Detection reads markup and directly linked local JavaScript/CSS; it never
executes deck code, fetches network resources, launches Chrome, or writes PPTX.
It supports explicit balanced markup, paired positive `data-export-width` /
`data-export-height`, and unambiguous simple fixed-pixel CSS. A detected size
is preserved as design metadata; capture must verify computed dimensions and
overflow. No default viewport is substituted for a fixed design canvas.

Static notes come from literal `window.__SPEAKER_NOTES__` maps or arrays
(including a local variable assignment), then `data-notes`, then `aside.notes`.
Array entries align by `id` to `data-slide-id`, never by array position.
String fields and lists of strings in structured notes become separate lines.
Absent notes remain absent. Computed JavaScript notes are flagged with
`runtimeNotes` and a warning for task 4; imported code, dynamic slides, the full
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
produces a clipping warning. Format adapters still need to check slide geometry.

After adapter preparation, capture hides `#nav`, `#hint`, and
`[data-export-chrome]` with `visibility:hidden`, preserving flex layout. It awaits
`document.fonts.ready`, image decoding, two animation frames (one paint), and a
150ms network-idle stability wait, then rechecks fonts/images. `timeoutMs` defaults to 15000;
`stabilityMs` is configurable. This does not settle arbitrary animation timelines;
format-specific final-state handling remains for task 4.

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
CSS API; these are diagnostics, not a guarantee of glyph coverage. The 王虹
required-font check belongs to its later adapter.

Results contain status, URL, successful image bytes, warnings, font families,
elapsed time, and error text/best-effort screenshot evidence on failure. The
engine also exposes viewport, scale, format/quality, network policy and browser
version for the later export report. It writes no output files. PPTX assembly,
atomic output, notes refresh, and complete deck adapters are still pending.
Image bytes and rendering can vary across Chrome versions and machines.

MIT © 2026 hzopc1031. No fixture themes, scripts, or assets are bundled.
