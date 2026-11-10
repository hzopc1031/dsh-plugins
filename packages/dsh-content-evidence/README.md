# dsh-content-evidence

内容证据工作台（开发中）：持久化主题、材料、实验记录与证据引用，提供 Host Remote API。不会自动发布内容。

Evidence-based content workbench, in development. Local storage and the Host Remote API are implemented. Draft generation, compliance checking, export files and the UI come in later tasks. **Nothing is published automatically.**

Requires Node.js `>=22` and DSH `>=0.2.1-rc.5 <0.3.0`. APIs were verified against DSH `0.2.2-rc.1`, source `fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159`, and checked at the `0.2.1-rc.5` API baseline. Host libraries are optional peers supplied by DSH; development installs include them for building and testing.

## Data flow / 数据流

UI/tool callers send user-supplied records to the Host through DSH Remote. The store writes `workspace.json` and copies material bytes into `materials/<UUID>` under `$DSH_HOME/content-evidence`, or `~/.dsh/content-evidence` when `DSH_HOME` is unset. Config `dataDir` overrides this root; an absolute path is recommended. Paths inside the installed plugin package are rejected, including resolved symlinks.

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

`./typert` ships the generated Host contribution for DSH's Typert Loader. `./remote` ships the strict client contribution and method types; `./types` exports the record vocabulary. A later client must mount the contribution via `ctx.remote.$mount()` and inject `remote` and `remote.contentEvidence`. No browser client or model tools are registered in this task. `/content-evidence` returns development status without recording command arguments.

## Local development / 本地开发

Independent package with its own lockfile and committed `lib/` output:

```sh
npm ci --ignore-scripts
npm run typecheck
npm test
npm run verify-pack
```

`build` compiles TypeScript and runs the official Typert generator. A temporary workspace under `.tmp/` stages this package's source and the installed protocol's declarations because the generator requires workspace ownership to recognize decorators. It is removed afterward; the DSH source and installed libraries are not modified. Shipping artifacts require no install lifecycle hooks.

Tests cover reload, byte copies, inert content, path/symlink rejection, corrupt-state preservation, concurrent updates, review invalidation, cancelled writes, generated Remote contracts, service disposal, and simulated package uninstall/reinstall with data retained outside the package. UI preview safety, actual draft retry behavior, compliance, scoped tool restrictions and export rendering/containment remain for later tasks.

MIT © 2026 hzopc1031.
