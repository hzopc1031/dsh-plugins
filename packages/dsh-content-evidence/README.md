# dsh-content-evidence

内容证据工作台（开发中）：持久化主题、材料、实验记录与证据引用，提供 Host Remote API、四个本地工具及受限工作台。不会自动发布内容。

Evidence-based content workbench, in development. Local storage, the Host Remote API, four local tools and scoped workbench confinement are implemented. Draft generation, compliance checking, export files and the UI come in later tasks. **Nothing is published automatically.**

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
| `saveDraft` | Save draft text as `editing`; changed content resets review to `pending` using its SHA-256 hash |
| `backfillPublishedLink` | Save a manually supplied URL without contacting the platform |
| `requestExport` | Persist a `pending` request only; does not create export files yet |

Domain failures use `RemoteError` codes `content-evidence/invalid-input`, `content-evidence/not-found` and `content-evidence/corrupt-store`. Other failures use the gateway's standard handling. All Remote methods accept a final carrier `AbortSignal`.

`./typert` ships the generated Host contribution for DSH's Typert Loader. `./remote` ships the strict client contribution and method types; `./types` exports the record vocabulary. A later client must mount the contribution via `ctx.remote.$mount()` and inject `remote` and `remote.contentEvidence`. No browser client is registered yet. `/content-evidence` returns development status without recording command arguments.

## Tools and restricted workbench / 受限工具

Only these four tools are registered:

| Tool | Behavior |
| --- | --- |
| `content_evidence_capture_material` | Copy complete base64 material bytes; optional source UUID; no file-path reads or URL fetching |
| `content_evidence_read_evidence` | Return the topic fact base and optional material bytes; `text/*` material content is also returned verbatim as data |
| `content_evidence_save_draft` | Save complete text through the atomic store; changed text invalidates review |
| `content_evidence_export_draft` | Record a `pending` request for Markdown, text, citations or materials; no export files yet |

Create a topic through the Host API, then use `/content-evidence workbench <topicId>` in its session before asking the host model to work on it. This command enables confinement without starting a model turn or changing model configuration. `/content-evidence leave` explicitly ends confinement. Entry and leave require an idle agent; a running task keeps its guard. These commands do not publish anything.

The Host-local exported `await enterWorkbench(pluginCtx, agent, topicId, signal)` is the entry point for later session/UI orchestration. It validates the topic and idle agent state, then returns an idempotent disposer. Call it before the topic's first model turn, pass the plugin-owned context, and retain confinement until the task has settled. It is not a Remote method and does not accept an agent from material content.

`agent.ctx.tools.restrict({ allow: toolNames })` hides inherited capabilities. `agent.ctx.tools.guard(...)` also denies scope-local and descendant calls outside the four-tool allowlist, rejects names containing post/publish/login/upload-to-platform patterns, and binds calls to the selected topic. Other sessions keep their tools. Leave, agent disposal and plugin disposal remove confinement. No platform publishing, login, arbitrary shell, browser or network-write tool is registered. The guard also denies the `run_code` transport; use the host's native tool executor for workbench sessions.

Source titles, URLs, commands, output and material text remain inert data. Read results identify evidence as untrusted; the plugin never turns XML/JSON instructions into tool dispatch, deferred instructions or model requests. This does not claim that a future model cannot be influenced by text: confinement must remain active throughout that model task.

Draft saves accept complete explicit text, not streaming chunks. Validation errors and cancellation before snapshot commit preserve the existing draft. Atomic storage prevents partial files replacing a completed artifact; generation success/staleness checks still belong to the later draft orchestration task. Export requests remain pending, so this tool does not claim a file was exported.

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

Tests cover reload, byte copies, inert content, path/symlink rejection, corrupt-state preservation, concurrent updates, review invalidation, cancelled writes, generated Remote contracts, service disposal, and simulated package uninstall/reinstall with data retained outside the package. Tool tests also exercise the real registry/executor: exact registration, inert source/material payloads, scoped visibility, scope-local and descendant guard denials despite allow policies, topic binding, failed-save preservation, leave and disposal. UI preview safety, model generation/retry orchestration, compliance and export rendering/containment remain for later tasks.

MIT © 2026 hzopc1031.
