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
It ships prebuilt `lib/` and has no lifecycle install hooks, runtime export
dependencies, model tool, browser downloads, or client entry at this stage.

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

MIT © 2026 hzopc1031. No fixture themes, scripts, or assets are bundled.
