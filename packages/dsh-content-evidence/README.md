# dsh-content-evidence

内容证据工作台（开发中）：持久化主题、材料、实验记录与证据引用，提供 Host Remote API、四个本地工具及受限工作台。不会自动发布内容。

Evidence-based content workbench, in development. Local storage, the Host Remote API, four local tools and scoped workbench confinement are implemented. Structured four-platform drafts, shared-fact checks, compliance reports and review invalidation are implemented. Export files and the UI come in later tasks. **Nothing is published automatically.**

Requires Node.js `>=22` and DSH `>=0.2.1-rc.5 <0.3.0`. APIs were verified against DSH `0.2.2-rc.1`, source `fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159`, and checked at the `0.2.1-rc.5` API baseline. Host libraries are optional peers supplied by DSH; development installs include them for building and testing.

## Data flow / 数据流

UI callers send user-supplied records through DSH Remote; the four tools call the same Host service locally. The store writes `workspace.json` and copies material bytes into `materials/<UUID>` under `$DSH_HOME/content-evidence`, or `~/.dsh/content-evidence` when `DSH_HOME` is unset. Config `dataDir` overrides this root; an absolute path is recommended. Paths inside the installed plugin package are rejected, including resolved symlinks.

Each topic stores its one-line idea, source URLs, material metadata and hashes, commands and terminal output, versions, test conditions, evidence claims, four draft slots (`x`, `xiaohongshu`, `douyin`, `weixin-video`), review state, export request records and manually entered published links. Claims without a reference are marked `待核实`; `有来源` means a reference exists, not that its contents were independently verified. Claims may reference a source, material or experiment in the same topic.

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
| `backfillPublishedLink` | Save a manually supplied URL without contacting the platform |
| `requestExport` | Persist a `pending` request only; does not create export files yet |

Domain failures use `RemoteError` codes `content-evidence/invalid-input`, `content-evidence/not-found`, `content-evidence/corrupt-store` and `content-evidence/conflict`. Other failures use the gateway's standard handling. All Remote methods accept a final carrier `AbortSignal`.

`./typert` ships the generated Host contribution for DSH's Typert Loader. `./remote` ships the strict client contribution and method types; `./types` exports the record vocabulary. A later client must mount the contribution via `ctx.remote.$mount()` and inject `remote` and `remote.contentEvidence`. No browser client is registered yet. `/content-evidence` returns development status without recording command arguments.

## Tools and restricted workbench / 受限工具

Only these four tools are registered:

| Tool | Behavior |
| --- | --- |
| `content_evidence_capture_material` | Copy complete base64 material bytes; optional source UUID; no file-path reads or URL fetching |
| `content_evidence_read_evidence` | Return the topic fact base and optional material bytes; `text/*` material content is also returned verbatim as data |
| `content_evidence_save_draft` | Save a complete platform shape from the shared fact base with revision/evidence checks; changed copy invalidates review |
| `content_evidence_export_draft` | Record a `pending` request for Markdown, text, citations or materials; no export files yet |

Create a topic through the Host API, then use `/content-evidence workbench <topicId>` in its session before asking the host model to work on it. This command enables confinement without starting a model turn or changing model configuration. `/content-evidence leave` explicitly ends confinement. Entry and leave require an idle agent; a running task keeps its guard. These commands do not publish anything.

The Host-local exported `await enterWorkbench(pluginCtx, agent, topicId, signal)` is the entry point for later session/UI orchestration. It validates the topic and idle agent state, then returns an idempotent disposer. Call it before the topic's first model turn, pass the plugin-owned context, and retain confinement until the task has settled. It is not a Remote method and does not accept an agent from material content.

`agent.ctx.tools.restrict({ allow: toolNames })` hides inherited capabilities. `agent.ctx.tools.guard(...)` also denies scope-local and descendant calls outside the four-tool allowlist, rejects names containing post/publish/login/upload-to-platform patterns, and binds calls to the selected topic. Other sessions keep their tools. Leave, agent disposal and plugin disposal remove confinement. No platform publishing, login, arbitrary shell, browser or network-write tool is registered. The guard also denies the `run_code` transport; use the host's native tool executor for workbench sessions.

Source titles, URLs, commands, output and material text remain inert data. Read results identify evidence as untrusted; the plugin never turns XML/JSON instructions into tool dispatch, deferred instructions or model requests. This does not claim that a future model cannot be influenced by text: confinement must remain active throughout that model task.

Draft saves accept a complete explicit artifact after successful generation or editing, not streaming chunks or failed model output. They use the host model in the already confined session; this plugin does not start a model request or configure a separate model. Export requests remain pending, so this tool does not claim a file was exported.

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

A passed review binds to the complete body, selected facts, rendered copy and evidence snapshot through SHA-256, and to the current rule configuration. Any changed copy/shape/card/shot/fact selection resets review; identical saves retain it. Evidence changes or changed configured terms also invalidate prior passes, including after restart. Legacy version-1 text stays readable with its original content; save it in a platform shape and review again. A pending export request records the specific draft hash and whether its current review passed. Later exporters must bind output to that hash and recheck current review state; old request records are historical snapshots, not approval of later edits.

## Local development / 本地开发

Independent package with its own lockfile and committed `lib/` output:

```sh
npm ci --ignore-scripts
npm run typecheck
npm test
npm run verify-pack
# Optional: run against an installed Host instead of the development baseline
DSH_TEST_HOST=/path/to/@deepseek-ai/dsh/package.json node --test --test-isolation=none test/*.test.mjs
```

`build` compiles TypeScript and runs the official Typert generator. A temporary workspace under `.tmp/` stages this package's source and the installed protocol's declarations because the generator requires workspace ownership to recognize decorators. It is removed afterward; the DSH source and installed libraries are not modified. Shipping artifacts require no install lifecycle hooks.

Tests cover reload, byte copies, inert content, path/symlink rejection, corrupt-state preservation, concurrent updates, review invalidation, cancelled writes, generated Remote contracts, service disposal, and simulated package uninstall/reinstall with data retained outside the package. Tool tests also exercise the real registry/executor: exact registration, inert source/material payloads, scoped visibility, scope-local and descendant guard denials despite allow policies, topic binding, failed-save preservation, leave and disposal. Draft tests cover all platform shapes, unsourced facts, rejected invented numeric/citation tokens, structured compliance findings, changed copy/evidence/rules, stale and competing saves, and legacy data. UI preview safety, session/UI orchestration and export rendering/containment remain for later tasks.

MIT © 2026 hzopc1031.
