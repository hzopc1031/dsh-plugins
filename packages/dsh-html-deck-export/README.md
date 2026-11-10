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

MIT © 2026 hzopc1031. No fixture themes, scripts, or assets are bundled.
