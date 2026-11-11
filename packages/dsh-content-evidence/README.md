# dsh-content-evidence

内容证据工作台：从网页侧栏管理主题、材料、实验记录、证据引用、四平台草稿、复核与本地导出，并提供四个本地工具及受限会话工作台。不会自动发布内容。

Evidence-based content workbench with a web sidebar and main panel. Materials, experiments, shared facts, editable four-platform drafts, compliance reports, safe local exports and manual published-link backfill use the same Host Remote API as the four local tools and restricted workbench. **Nothing is published automatically.**

Requires Node.js `>=22` and DSH `>=0.2.1-rc.5 <0.3.0`. APIs were verified against DSH `0.2.2-rc.1`, source `fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159`, and checked at the `0.2.1-rc.5` API baseline. Host libraries are optional peers supplied by DSH; development installs include them for building and testing.

## Install from the branch / 从开发分支安装

`0.1.0` is unreleased and **not published to npm**. Install the committed prebuilt package from `feat/content-evidence`, then restart the web Host. Local export supports Linux and macOS directory-relative I/O without requiring procfs or traversable `/dev/fd`. Windows still refuses before creating export files. The portable path was verified on Linux with both fd paths disabled; native macOS and Windows were not executed.

```sh
dsh plugin --profile web add "github:hzopc1031/dsh-plugins#feat/content-evidence&path:/packages/dsh-content-evidence"
dsh --profile web --no-open
```

也可在「插件 → 添加插件」输入完整的 `github:...` 地址。当前包尚未合并到 `main`；不要用 npm 包名或 `#main` 安装。安装产物包含 `lib/` 和 `dist/`，无安装时构建脚本。

The same git address works in Plugins → Add plugin. Pin a commit instead of the branch for a fixed revision. The package ships `lib/` and `dist/` and has no install lifecycle hooks. Remove with `dsh plugin --profile web remove dsh-content-evidence`; this removes the package and its configuration layer while retaining your separate data directory and exported folders.

## Web workbench / 网页工作台

Open **内容证据 / Content evidence** in DSH's web sidebar:

1. Create a topic from a one-line idea, or select an existing topic.
2. In **材料与实验**, save source URLs, upload screenshots/materials, and record commands, output, versions and test conditions. Commands are recorded without execution. Recognized PNG/JPEG/GIF/WebP bytes preview as images; HTML, SVG, scripts and other bytes render as plain text. Binary originals are available through local export.
3. In **证据表**, enter facts and select a stored source, material or experiment reference. Missing references remain `待核实`; adding evidence can invalidate an old review.
4. In **四平台草稿**, select X single/thread, 小红书 title/body/cards, or separate 抖音/视频号 voiceover/shot lists. Select shared facts, edit and save, then check the saved revision. Review findings include locations and suggested fixes. Save or explicitly discard unsaved draft edits before switching topic/platform, refreshing or updating evidence. Save before leaving this panel; uncommitted edits are held in browser memory.
5. In **本地导出**, enter an existing absolute directory on a DSH Host with supported directory handles, choose Markdown/text/citations/materials/all, and export the saved platform draft. The completed folder path and file list appear in history. After publishing manually outside this plugin, record the published URL here; the plugin only stores it.

Conflicting saves preserve the Host draft and the current editor text. Copy your edits before choosing **放弃草稿编辑并刷新**, then reconcile against the current evidence/revision. A changed saved draft resets review; unsaved edits show a local reminder and disable review/export until saved or discarded. Automated review is an editorial aid and still needs human factual/platform checks.

The workbench always shows a Chinese model-setup notice, even before a topic is selected. Rewriting needs an already usable host model. If the model list is empty, open DSH「设置 → 模型」(Settings → Models), sign in or configure the provider API key, then select a usable model in a session. The notice is static: the plugin does not inspect secret values, detect model availability or call the model from the UI. Create or select a topic, run `/content-evidence workbench <topicId>` while idle, confirm confinement, then ask the model to read the evidence and save all four platform drafts with AI labels and unsourced facts marked `待核实`. Use the Host's native tool executor. Run `/content-evidence leave` when finished and refresh the panel. The UI does not start a session, select a model, visit platforms or offer publish/login actions.

The client is prebuilt and committed as `dist/client.js`, exported at `./client`, and mounts `main` plus `sidebar.panellist` through `ctx.slots`. It mounts the generated Remote contribution before its namespace-dependent view activates. All Host reads/writes go through `ctx.remote.contentEvidence`; there are no direct HTTP, filesystem or model calls in the client.

Live loading was verified on this Linux box with the installed DSH `0.2.2-rc.1` CLI and source `fcc0ad46`, using a disposable web profile and headless Chrome/Playwright. Browser acceptance covered capture, inert HTML preview, shared evidence, all four platform editors, review invalidation, local exports, manual-link backfill, reload and a fresh Host process, at ordinary and narrow widths. No live model request was possible in the task 8 check: the Host model catalog was empty, the default `deepseek-official/deepseek-flash` API-key reference was unconfigured, and the account was signed out. This was checked through Host status APIs that expose no secret values; no credentials were added or requested. Model-assisted rewriting remains an unverified manual confined-session workflow. The prerequisite, confinement confirmation and four-platform save prompt are now visible without expanding help. The final polish smoke also loaded the notice in a disposable installed Host and exported a synthetic topic with both `/proc/self/fd` and `/dev/fd` forced unavailable on Linux; this is not a native macOS/Windows run or a live model rewrite.

## Data flow / 数据流

UI callers send user-supplied records through DSH Remote; the four tools call the same Host service locally. The store writes `workspace.json` and copies material bytes into `materials/<UUID>` under `$DSH_HOME/content-evidence`, or `~/.dsh/content-evidence` when `DSH_HOME` is unset. Config `dataDir` overrides this root; an absolute path is recommended. Paths inside the installed plugin package are rejected, including resolved symlinks.

Each topic stores its one-line idea, source URLs, material metadata and hashes, commands and terminal output, versions, test conditions, evidence claims, four draft slots (`x`, `xiaohongshu`, `douyin`, `weixin-video`), review state, export history and manually entered published links. Claims without a reference are marked `待核实`; `有来源` means a reference exists, not that its contents were independently verified. Claims may reference a source, material or experiment in the same topic.

材料通过 base64 上传并复制到数据目录，文件名只作展示；不会执行材料、脚本或命令，也不会访问来源链接。内容中的指令仅作为数据保存。插件目前不会调用模型或访问社交平台。

Material uploads use base64 bytes and a display filename, never an arbitrary Host file path. Uploads are limited to 10 MiB each; the JSON workspace is limited to 16 MiB. Source links accept HTTP(S) without embedded credentials. Materials and commands remain inert data; source URLs are not fetched. No model is called by this implementation.

Writes use temporary files, file synchronization, atomic rename and directory synchronization. Changes are serialized across store instances in one process; use one DSH Host process per data directory. Corrupt or unsupported state is refused without overwriting it. An interrupted material capture may leave an unreferenced copy; existing materials are never pruned automatically. Plugin disposal, upgrade and uninstall do not delete user data. Keep a backup of the whole data directory.

## Host API / 本地服务

The plugin registers `ctx.contentEvidence` as a `TypertRemoteService`, with namespace `contentEvidence` and these `@Remote` methods:

| Methods | Behavior |
| --- | --- |
| `listTopics`, `createTopic`, `readEvidence` | List, create and read topic records |
| `addSource`, `captureMaterial`, `readMaterial` | Save source links, copy/read inert material bytes |
| `logExperiment`, `saveClaim` | Save experiment records and source-linked claims |
| `saveDraft` | Save a complete platform shape with selected claims, expected revision and evidence hash; changed copy resets review to `pending` |
| `reviewDraft` | Check the current revision and store a structured report bound to its content hash |
| `backfillPublishedLink` | Append a manually supplied HTTP(S) URL per platform, with a timestamp, without contacting the platform |
| `requestExport` | Export the saved platform draft and topic evidence to an existing user-chosen absolute directory; return a completed record and relative file list |

Domain failures use `RemoteError` codes `content-evidence/invalid-input`, `content-evidence/not-found`, `content-evidence/corrupt-store`, `content-evidence/conflict` and `content-evidence/export-unsupported`. Other failures use the gateway's standard handling. All Remote methods accept a final carrier `AbortSignal`.

`./typert` ships the generated Host contribution for DSH's Typert Loader. `./remote` ships the strict client contribution and method types; `./types` exports the record vocabulary. The browser client mounts the contribution via `ctx.remote.$mount()` and its view injects `remote` and `remote.contentEvidence`. `/content-evidence` returns status without recording command arguments.

## Tools and restricted workbench / 受限工具

Only these four tools are registered:

| Tool | Behavior |
| --- | --- |
| `content_evidence_capture_material` | Copy complete base64 material bytes; optional source UUID; no file-path reads or URL fetching |
| `content_evidence_read_evidence` | Return the topic fact base and optional material bytes; `text/*` material content is also returned verbatim as data |
| `content_evidence_save_draft` | Save a complete platform shape from the shared fact base with revision/evidence checks; changed copy invalidates review |
| `content_evidence_export_draft` | Export Markdown, text, citations, copied materials, or `all`, inside a new folder in the user-chosen directory |

Create a topic in the web UI or through the Host API, then use `/content-evidence workbench <topicId>` in its session before asking the host model to work on it. This command enables confinement without starting a model turn or changing model configuration. `/content-evidence leave` explicitly ends confinement. Entry and leave require an idle agent; a running task keeps its guard. These commands do not publish anything.

The Host-local exported `await enterWorkbench(pluginCtx, agent, topicId, signal)` is the Host-local entry point for session orchestration. It validates the topic and idle agent state, then returns an idempotent disposer. Call it before the topic's first model turn, pass the plugin-owned context, and retain confinement until the task has settled. It is not a Remote method and does not accept an agent from material content.

`agent.ctx.tools.restrict({ allow: toolNames })` hides inherited capabilities. `agent.ctx.tools.guard(...)` also denies scope-local and descendant calls outside the four-tool allowlist, rejects names containing post/publish/login/upload-to-platform patterns, and binds calls to the selected topic. Other sessions keep their tools. Leave, agent disposal and plugin disposal remove confinement. No platform publishing, login, arbitrary shell, browser or network-write tool is registered. The guard also denies the `run_code` transport; use the host's native tool executor for workbench sessions.

Source titles, URLs, commands, output and material text remain inert data. Read results identify evidence as untrusted; the plugin never turns XML/JSON instructions into tool dispatch, deferred instructions or model requests. This does not claim that a future model cannot be influenced by text: confinement must remain active throughout that model task.

Draft saves accept a complete explicit artifact after successful generation or editing, not streaming chunks or failed model output. They use the host model in the already confined session; this plugin does not start a model request or configure a separate model.

## Shared drafts and review / 共享事实与复核

`readEvidence(topicId)` returns the shared topic plus `evidenceHash`. `saveDraft(topicId, target, input)` and the save tool now require this structured input; the old plain-text save argument is no longer accepted:

- `body`: one of the platform shapes below.
- `claimIds`: existing claim UUIDs from that topic, shared across platform versions.
- `expectedRevision`: the draft revision just read, or `0` for a new slot.
- `evidenceHash`: the exact fact-base hash just read.

| Platform | Body shape |
| --- | --- |
| X single | `{ kind: 'x-single', post: string }` |
| X thread | `{ kind: 'x-thread', posts: string[] }` |
| 小红书 | `{ kind: 'xiaohongshu', title: string, body: string, cards: string[] }` |
| 抖音 | `{ kind: 'douyin', voiceover: string, shots: string[] }` |
| 视频号 | `{ kind: 'weixin-video', voiceover: string, shots: string[] }` |

Copy fields and arrays must be nonempty; each array has at most 100 entries. The store retains both the editable body and rendered `content`, with a citation section derived only from the selected stored claims. Unreferenced claims remain `待核实` and fail citation review; a draft with no selected facts also remains `待核实`. A source, material or experiment reference means evidence was supplied, not independently verified.

Saves reject unknown claim UUIDs, HTTP(S) citation URLs absent from selected claims' stored sources, and digit tokens absent from selected claim text. They never create sources or numbers. This is a conservative literal check: add intended numeric facts to the evidence sheet first, including version numbers and numeric labels. It cannot establish semantic support, verify units, detect written-out numbers, or prove that a paraphrase follows from a source. Human fact checking remains necessary; unrelated facts sharing a number are not proof.

Revision and evidence comparisons run inside the same serialized atomic mutation as the write. A stale completion or retry receives `content-evidence/conflict` with the current revision and evidence hash. Re-read and reconcile before another save; do not blindly replay old output. Invalid inputs, rejected stale saves and cancellation before snapshot commit preserve the previous artifact. Concurrent saves against the same revision have one winner. `complete` means a complete saved artifact, not review approval.

Call `reviewDraft(topicId, target, expectedRevision)` through the Host/Remote API for review. It returns the draft with `review.status`, `contentHash`, `reviewedAt` and findings containing `code`, `location`, `excerpt` and recommended minimum `fix`. Locations name copy fields/array entries and use zero-based UTF-16 offsets after `@`. Findings cover:

- Missing explicit AI label (`AI 生成`, `人工智能生成`, or `AI-generated`): add a clear reminder and manually confirm the publishing platform's label requirements.
- Small built-in editorial sensitive-term scan: `翻墙`, `代开发票`, `刷单`, `买粉`.
- Absolute wording/promises: `百分之百`, `100%`/`100％`, `绝对`, `保证`, `包赚`, `稳赚`, `零风险`, `全网第一`, `永远`, `最佳`, `最强`; English whole-word `guarantee`/`guaranteed`, `always`, `never`, `risk-free`/`risk free`, `best` (case insensitive).
- Missing source references, an outdated evidence snapshot, or a legacy unstructured draft.

There is no official sensitive-word corpus in this package. These small patterns are editorial reminders, can produce false positives, and do not certify regulatory compliance. Config `extraSensitiveTerms: string[]` adds up to 100 literal, case-insensitive terms of at most 100 characters each; terms are escaped and never treated as regex patterns. All findings require a fix before the automated report can pass. Even a passed report requires human judgment on factual support and platform requirements.

A passed review binds to the complete body, selected facts, rendered copy and evidence snapshot through SHA-256, and to the current rule configuration. Any changed copy/shape/card/shot/fact selection resets review; identical saves retain it. Evidence changes or changed configured terms also invalidate prior passes, including after restart. Legacy version-1 text stays readable with its original content; save it in a platform shape and review again. Each completed export records the specific draft hash and whether its current review passed. Old export records remain historical snapshots, not approval of later edits. Legacy pending request records stay readable and are not silently resumed.

## Local exports and published links / 本地导出与链接回填

导出仅写本机文件；请先自行创建并明确选择一个目录。`all` 一次生成 Markdown、纯文本、引用列表与材料副本。用户在插件外手动发布后，可按平台回填链接；插件不会打开发布地址或调用社交 API。

Host/Remote: `requestExport(topicId, target, format, directory, signal)`. The directory is now required; the previous pathless pending-request call is no longer accepted. Tool input: `{ topicId, platform, format, directory }`. `format` accepts `markdown`, `text`, `citations`, `materials`, or `all`. A saved draft for the selected platform is required. Repeat for other platform drafts when needed; each export includes the topic's shared evidence and manually recorded URLs.

Each call creates `<directory>/content-evidence-<export UUID>/`, without overwriting previous exports:

- `draft.md`: readable Markdown with user copy, source text and script-like text in code blocks.
- `draft.txt`: plain text with current review status and findings.
- `citations.txt`: stored source URLs, source-linked claims (including `待核实`), material hashes, experiment commands/output/versions/conditions, and manual published URLs.
- `materials/<material UUID>`: exact copied bytes, with original names, types, source IDs and hashes in `materials/index.json`. Display filenames never become destination paths.

`all` includes every artifact above. Single-format calls include just that artifact; `materials` also includes `export.txt` carrying review metadata. Files are mode 0600 and new directories 0700; copied scripts are not executable. No material, recorded command or source URL is executed, imported or fetched. `readMaterial` and the read tool return bytes/text for preview; the browser client renders inert text or recognized raster image bytes, never active HTML.

Export targets must already exist and be absolute, with no `.`/`..` segments, backslashes or symlinks in any component. The filesystem root, installed package and data-store directories are rejected. The exporter pins each directory component with `O_DIRECTORY` / `O_NOFOLLOW`. It probes `/proc/self/fd`, then `/dev/fd`, verifying directory identity and canonical resolution. When neither is usable, it calls libc `openat` / `mkdirat` / `renameat` / `unlinkat` through pinned Koffi platform binaries, with Node descriptor-based stat/read/write/sync/close. Material byte reads use the same backend. Replacing a destination ancestor with a symlink cannot redirect writes or cleanup. The native backend rechecks the destination's device/inode before committing; if its path now names a different directory, export aborts and cleans staging through the original handles. Absolute paths are used only for validation/reporting, never as a fallback writer.

The optional `@koromix/koffi-{linux,darwin}-{x64,arm64}` packages are pinned to `3.3.7`. These are the upstream prebuilt MIT-licensed binary packages, with no dependencies or lifecycle hooks; the `koffi` umbrella package (which has an install hook) is deliberately not installed. npm selects the matching platform binary. No toolchain is downloaded or run at install time. Keep optional dependencies enabled for macOS and Linux hosts without fd paths. The native backend loads Linux glibc (`libc.so.6`) or macOS libSystem. If verified fd paths are unavailable, a missing/incompatible helper or unsupported native host returns `content-evidence/export-unsupported` before export creation. Windows always refuses with that code. Tests exercise both fd-path backends and the macOS-oriented directory-relative native backend on Linux by forcing `/proc/self/fd` and `/dev/fd` opens to fail; no native macOS/Windows run is claimed. Upstream references: [Koffi split packages](https://koffi.dev/migration#split-packages), [FFI/variadic calls](https://koffi.dev/load), [binary source/build instructions](https://koffi.dev/contribute).

Material size/hash checks run before copying each file. A hidden staging folder is renamed after successful writes; failures clean staging and leave saved drafts unchanged. An interruption or snapshot-write failure after export rename can leave an unrecorded complete folder; user files are never removed automatically.

Review labels are recomputed for the selected draft's current content/evidence/rules hashes. Pending, failed or invalidated reviews are exported honestly, without a passed stamp. Even a passed automated report still requires human factual and platform checks. Backfill uses `backfillPublishedLink(topicId, target, publishedUrl, signal)` for one of the four platforms; it appends validated HTTP(S) URLs and timestamps, preserves previous entries, and never visits those URLs.

## Local development / 本地开发

Independent package with its own lockfile and committed `lib/` and `dist/` output:

```sh
npm ci --ignore-scripts
npm run typecheck
npm test
npm run verify-pack
# Optional: run against an installed Host instead of the development baseline
DSH_TEST_HOST=/path/to/@deepseek-ai/dsh/package.json node --test --test-isolation=none test/*.test.mjs
```

`build` compiles Host TypeScript, runs the official Typert generator, typechecks the client and bundles it with esbuild. React and Zod remain platform-provided peers; the browser-safe Remote descriptor implementation is bundled. A temporary workspace under `.tmp/` stages this package's source and the installed protocol's declarations because the generator requires workspace ownership to recognize decorators. It is removed afterward; the DSH source and installed libraries are not modified. Shipping artifacts require no install lifecycle hooks.

Tests cover reload, byte copies, inert content, path/symlink rejection, corrupt-state preservation, concurrent updates, review invalidation, cancelled writes, generated Remote contracts, service disposal, and simulated package uninstall/reinstall with data retained outside the package. Tool tests also exercise the real registry/executor: exact registration, inert source/material payloads, scoped visibility, scope-local and descendant guard denials despite allow policies, topic binding, failed-save preservation, leave and disposal. Draft tests cover all platform shapes, unsourced facts, rejected invented numeric/citation tokens, structured compliance findings, changed copy/evidence/rules, stale and competing saves, and legacy data. Export tests also cover all formats, manual URL backfill, legacy requests, stale review labels, path traversal, symlinks and an ancestor-replacement race, staging cleanup, forced `/dev/fd` and native fallbacks with the same containment/race/integrity checks, partial-write/rename/cancellation cleanup, source-directory replacement, mismatched probe identities, safe unsupported-host refusal before export writes, byte-for-byte material copies, and script-like material reads without execution or network calls. Client tests use the compiled module-loader artifact, real Cordis lifecycle and SlotCore, React rendering and a descriptor-checked local Remote transport to exercise capture, inert previews, all draft forms, reviews, conflicting saves, exports and backfill.

MIT © 2026 hzopc1031.
