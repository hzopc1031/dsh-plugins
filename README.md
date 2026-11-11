# dsh-plugins

`hzopc1031/dsh-plugins` 是 DeepSeek Harness（DSH）插件的 monorepo，每个插件在 `packages/` 下各自独立（独立依赖和 lockfile），可直接从本仓库的子目录用 git 安装；已发布到 npm 的包也可用 npm 包名安装，发布状态见下表。许可证：MIT。

`hzopc1031/dsh-plugins` is a monorepo of DeepSeek Harness (DSH) plugins. Each plugin under `packages/` is independent and installable from git via its subdirectory. Packages published to npm can also be installed by npm name; see the publication status below. MIT licensed.

| 插件 / Plugin | npm 包名 / npm name | 功能 / Purpose | 文档 / Docs |
| --- | --- | --- | --- |
| 任务复盘 | [`dsh-task-review`](https://www.npmjs.com/package/dsh-task-review) | 自动或手动任务复盘，保存本地 Markdown 报告（`/review`）/ Task reviews with local Markdown reports | [README](packages/dsh-task-review/README.md) |
| 任务心跳 | [`dsh-heartbeat-monitor`](https://www.npmjs.com/package/dsh-heartbeat-monitor) | 长任务定时进度卡、静默/重复警告（`/heartbeat`）/ Timed progress cards and stall/repeat warnings | [README](packages/dsh-heartbeat-monitor/README.md) |
| 插件组合冲突检查 | `dsh-plugin-combo-lab`（未发布 npm / not published to npm） | 协助检查多个 DSH 插件一起安装时是否抢同一个命令名、界面位置，或在提示词、工具拦截上互相干扰；结合人工记录指出冲突在哪，新装或升级后可再检查组合是否正常（当前每次两个插件，`/combo-lab`）/ Pairwise conflict checks with manual evidence and rechecks after installs or upgrades | [README](packages/dsh-plugin-combo-lab/README.md) |
| 资料更新影响分析 | `dsh-source-impact`（未发布 npm / not published to npm） | 显式来源引用追踪与更新影响复查清单（`/impact`）/ Explicit source citation tracking and update impact checklists | [README](packages/dsh-source-impact/README.md) |
| 权限拒绝诊断台 | `dsh-permission-doctor`（未发布 npm / not published to npm） | 只读诊断工具拒绝与未弹审批的证据（`/permission-doctor`）/ Read-only diagnostics for tool denials and missing approval prompts | [README](packages/dsh-permission-doctor/README.md) |
| 指令冲突解释器 | `dsh-instruction-conflicts`（未发布 npm / not published to npm） | 规则正文疑似冲突、注入版本与当前上下文证据（`/instruction-conflicts`）/ Suspected instruction conflicts, injected versions and current context evidence | [README](packages/dsh-instruction-conflicts/README.md) |
| 未发送草稿找回 | `dsh-draft-rescue`（未发布 npm / not published to npm） | 独立面板找回、复制与追加本机文字草稿；校验已核对的宿主版本 / Recover local unsent text without changing navigation | [README](packages/dsh-draft-rescue/README.md) |
| 文件引用路径复制 | `dsh-file-ref-copy`（未发布 npm / not published to npm） | 从已完成回答的原始 Markdown 复制绝对、相对与带行号路径 / Copy local file paths from a loaded completed reply | [README](packages/dsh-file-ref-copy/README.md) |
| 桌面截图附件 | `dsh-snip-attach`（尚未发布到 npm / not published to npm） | Windows 框选截图后加入待发送附件，针对 Windows 桌面（`/screenshot`）/ Windows snip to pending attachments | [README](packages/dsh-snip-attach/README.md) |
| 文件占用程序查询 | `dsh-file-holder`（未发布 npm / not published to npm） | 查询 Windows 项目内文件的占用程序、PID 与观察时间（`/file-holder`） / Windows project file holder lookup | [README](packages/dsh-file-holder/README.md) |
| DLL 诊断 | `dsh-dll-doctor`（未发布 npm / not published to npm） | 只读检查 Windows EXE/DLL 的缺失依赖与架构不匹配（`/dll-check`）/ Static Windows DLL diagnostics | [README](packages/dsh-dll-doctor/README.md) |
| GitHub issue/PR 研判 | `dsh-github-triage`（未发布 npm / not published to npm） | AI 结合业务说明和你自己的本地代码，判断上游问题是否存在、PR 是否适合合入或回迁；三档建议、首次有界全量扫描、后续定时看变化，纠正规则可导出编辑。 | [README](packages/dsh-github-triage/README.md) |
| 本地票据核对 | `dsh-invoice-gate`（未发布 npm / not published to npm） | 本地票据与台账核对、差异及证据包；不做 OCR／验真，模型不改金额（`/invoice-gate`）/ Local invoice reconciliation and evidence packs | [README](packages/dsh-invoice-gate/README.md) |
| HTML 演示稿导出 | `dsh-html-deck-export`（未发布 npm / not published to npm） | 本地 HTML → 16:9 图片版 PPTX、讲稿备注与逐页报告；HTML 保留为源文件，不自动上传（`/html-deck-export`）/ Local image PPTX export with notes and per-page reports | [README](packages/dsh-html-deck-export/README.md) |
| 内容证据工作台 | `dsh-content-evidence`（未发布 npm / not published to npm） | 材料与证据追踪、四平台草稿、复核、本地导出；不自动发布 / Evidence tracing, four-platform drafts, review and local export; never auto-publishes | [README](packages/dsh-content-evidence/README.md) |
| 官方公告影响核对 | `dsh-advisory-impact`（未发布 npm / not published to npm） | 按运行版本核对 Kafka/Hadoop/Flink 官方公告，原生面板显示三态、来源与时间 / Official-first version checks in a native panel | [README](packages/dsh-advisory-impact/README.md) |
| Apache 社区雷达 | `dsh-apache-radar`（未发布 npm / not published to npm） | 并列官方数量与退休口径，关注 Kafka / Hadoop / Flink，生成带来源的本地中文周报（`/apache-radar`）；无需模型 key / Cited official scopes and local weekly briefs | [README](packages/dsh-apache-radar/README.md) |

> 心跳插件的 npm 包名是 `dsh-heartbeat-monitor`：`dsh-heartbeat` 已被一个无关的包占用。
> The heartbeat plugin is published as `dsh-heartbeat-monitor` because `dsh-heartbeat` is an unrelated package.

## 安装 / Installation

本次优化源码版本与 npm 发布版本分开记录（2026-11-10）：`dsh-task-review` 和 `dsh-heartbeat-monitor` 的 npm 最新版本分别仍是 **0.1.1 / 0.1.0**。该优化批次的多数源码版本为 **0.2.0**；当时 `dsh-file-ref-copy` 为 **0.1.1**。本次内网兼容修复另有 patch 版本，以各包 package.json 为准。本次未执行 npm publish，安装 npm 最新包不会得到这些新改动。

本批次增加 bash 进程失败识别与 PTC 关联、有效工作目录（命令会标明当前执行目录或回退目录）、截图预览确认后再注入、组合检查模板与失败项跳转、扫描复用与精简输出、资料引用原子接受基线、诊断内存缓存以及草稿按可靠标题/工作区筛选与追加目标说明。各包 README 说明具体行为。

`main` 的 Git 安装地址继续用于已有版本。本批次版本需使用包含本次提交的 ref；推送后可将以下地址中的 `main` 换成 `optimize-batch` 或固定提交 SHA。分支推送不表示已合并到 main。

本次内网与兼容修复以官方 `dsh-v0.2.2-rc.1` 为准，17 个插件均在 Linux 已安装的 **0.2.2-rc.1** 中加载。Windows / Electron 未在本机实测。见[兼容矩阵](docs/compat-matrix.md)及[公司电脑代理、CA 与离线快照配置](docs/intranet-network.md)。包均已预编译，无安装脚本；安装后完全退出桌面 DSH（含托盘）再重开。

修复提交位于 `fix/intranet-compat` 分支，未合入 main、未发布 npm。安装本次修复时，将下方安装地址中的 `main` 换为 `fix/intranet-compat` 或本次固定提交 SHA。

### 1. 桌面 DSH 界面 / Desktop UI

插件 → 添加插件，输入 npm 包名（或下面的 git 地址）：

Plugins → Add plugin, then enter an npm name (or a git address below):

```text
dsh-task-review
dsh-heartbeat-monitor
```

### 2. 命令行（npm）/ CLI from npm

先完全退出桌面 DSH。/ Quit DSH Desktop first.

```powershell
dsh plugin --profile desktop add dsh-task-review
dsh plugin --profile desktop add dsh-heartbeat-monitor
```

### 3. 从 GitHub 安装 / From git

DSH 把参数转给 pnpm，支持 pnpm 的 git 子目录写法 `#<分支>&path:/<子目录>`：

DSH forwards to pnpm, which accepts a git subdirectory as `#<ref>&path:/<dir>`:

```powershell
dsh plugin --profile desktop add "github:hzopc1031/dsh-plugins#main&path:/packages/dsh-task-review"
dsh plugin --profile desktop add "github:hzopc1031/dsh-plugins#main&path:/packages/dsh-heartbeat-monitor"
dsh plugin --profile desktop add "github:hzopc1031/dsh-plugins#main&path:/packages/dsh-plugin-combo-lab"
dsh plugin --profile desktop add "github:hzopc1031/dsh-plugins#main&path:/packages/dsh-source-impact"
dsh plugin --profile desktop add "github:hzopc1031/dsh-plugins#main&path:/packages/dsh-permission-doctor"
dsh plugin --profile desktop add "github:hzopc1031/dsh-plugins#main&path:/packages/dsh-instruction-conflicts"
dsh plugin --profile desktop add "github:hzopc1031/dsh-plugins#main&path:/packages/dsh-draft-rescue"
dsh plugin --profile desktop add "github:hzopc1031/dsh-plugins#main&path:/packages/dsh-file-ref-copy"
dsh plugin --profile desktop add "github:hzopc1031/dsh-plugins#main&path:/packages/dsh-snip-attach"
& "$env:LOCALAPPDATA\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop add "github:hzopc1031/dsh-plugins#main&path:/packages/dsh-github-triage"
dsh plugin --profile desktop add "github:hzopc1031/dsh-plugins#main&path:/packages/dsh-invoice-gate"
dsh plugin --profile desktop add "github:hzopc1031/dsh-plugins#main&path:/packages/dsh-html-deck-export"
dsh plugin --profile desktop add "github:hzopc1031/dsh-plugins#main&path:/packages/dsh-content-evidence"
dsh plugin --profile desktop add "github:hzopc1031/dsh-plugins#main&path:/packages/dsh-advisory-impact"
dsh plugin --profile desktop add "github:hzopc1031/dsh-plugins#main&path:/packages/dsh-apache-radar"
```

`dsh-invoice-gate` 的 0.1.0 尚未发布到 npm。它声明 DSH `>=0.2.1-rc.5 <0.3.0`，本机加载检查使用 `0.2.2-rc.1`。/ Invoice Gate is unreleased; live loading was checked with `0.2.2-rc.1`. ExcelJS/uuid 的修复需在消费端 profile 根级应用 override，见 [依赖审计与安装限制](packages/dsh-invoice-gate/README.md#安装后的依赖审计--consumer-override-limit)；本包根目录的零发现不代表整个宿主依赖图无发现。

`dsh-content-evidence` 尚未发布到 npm。本地导出支持 Linux / macOS 的目录相对 I/O（无需 procfs）；已在 Linux 禁用两种 fd 路径验证，未实测原生 macOS。Windows 仍安全拒绝导出。也可安装到 web profile。重启 DSH 后打开侧栏「内容证据」。数据默认保存在 `$DSH_HOME/content-evidence` 或 `~/.dsh/content-evidence`，卸载保留数据；导出仅写本机目录，插件绝不自动发布。/ Unreleased. Local export supports Linux/macOS directory-relative I/O without procfs; verified on Linux with both fd paths disabled. Native macOS and Windows were not executed for export; Windows still safely refuses export. Restart DSH and open Content evidence in the sidebar. Data defaults to `$DSH_HOME/content-evidence` or `~/.dsh/content-evidence` and survives uninstall. Exports stay local; nothing is published automatically.

`dsh-advisory-impact` 尚未发布到 npm。其原生面板已在 DSH 0.2.2-rc.1 Web 实测，无需模型 key。/ Unreleased. The native panel was verified on DSH 0.2.2-rc.1 Web and does not require a model key.

`dsh-apache-radar` 尚未发布到 npm。声明 DSH `>=0.2.2-rc.1 <0.3.0`，本机加载验证使用 `0.2.2-rc.1`。无需模型 key，也不会自动发布。/ Unreleased. Live loading was checked with DSH `0.2.2-rc.1`. It requires no model key and does not auto-publish.

同样的 `github:...` 地址也可以填进界面的「添加插件」。把 `main` 换成某个提交哈希即可固定版本。

The same `github:...` address works in the Add plugin dialog. Replace `main` with a commit hash to pin a version.

`dsh-html-deck-export` 的 0.1.0 尚未发布到 npm。兼容 DSH `>=0.2.1-rc.5 <0.3.0`，已在 Linux CLI `0.2.2-rc.1`加载验证，需要本机 Chrome。/ Unreleased; requires local Chrome. Loaded on Linux DSH `0.2.2-rc.1`. Linux 可将 `desktop` 换成 `web` 或自己的 profile。/ On Linux, replace `desktop` with `web` or your chosen profile.

草稿找回和截图附件内部结构已核对 rc.5 与 0.2.2-rc.1，运行时只接受这两个明确版本，未来或未知版本显示中文说明。文件引用路径复制没有额外版本锁；完整声明和验证边界见兼容矩阵。

> **Windows 命令行提示**：如果 `dsh` 报 `profile "desktop" is managed exclusively by the Electron application`，说明 PATH 上的是独立安装的 dsh；请改用桌面版自带的 CLI（命令其余部分不变）：
>
> ```powershell
> & "$env:LOCALAPPDATA\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop add <包名或 git 地址>
> ```
>
> git 安装走 HTTPS 克隆 github.com；如果 git 全局配置了 `http.proxy`，代理需要处于运行状态。

If `dsh` says the desktop profile is managed by the Electron application, use the Desktop-bundled CLI shown above. Git installs clone github.com over HTTPS, so any configured git proxy must be running.

卸载 / Uninstall：`dsh plugin --profile desktop remove <npm 包名>`

## 本地开发 / Local development

根 `package.json` 为 `private: true`，不发布。每个插件保留独立依赖与 lockfile，没有启用 npm workspaces；请进入 `packages/<插件>` 执行 npm 命令：

The root package is private. Run npm commands inside each `packages/<plugin>`:

```powershell
npm ci --ignore-scripts
npm run typecheck
npm test            # 含构建 / includes the build
npm run verify-pack # 每个包都有 / available in every package
```

`lib/` 为预编译产物并提交到仓库，git 安装无需构建；改动源码后请 `npm test`（会重建 `lib/`）再提交。

`lib/` is committed so git installs need no build; run `npm test` (rebuilds `lib/`) before committing source changes.

`verify-pack` 直接运行 `npm pack --dry-run --json --ignore-scripts` 并检查精确白名单，无需预先制作 manifest。若本机默认 npm cache 不可写，可仅为当前命令设置 `npm_config_cache` 指向 worktree 的 `.tmp/npm-cache`。不要修改全局配置。全部包分别保留自己的依赖与 lockfile。

验证分为三层：typecheck/打包白名单、单元与 rc.5 headless 集成、browser factory 的 jsdom 交互。它们不能证明 Electron 桌面的布局、焦点、系统剪贴板、真实截图或安装已通过；本批次没有安装到用户 DSH。核心性能样本可用 `node scripts/optimize-benchmark.mjs` 重现。

## 市场收录 / Marketplace listing

计划条目 / Planned entries（`awesome-dsh-plugin`）：

- `hzopc1031/dsh-plugins#dsh-task-review` → `https://github.com/hzopc1031/dsh-plugins/tree/main/packages/dsh-task-review`
- `hzopc1031/dsh-plugins#dsh-heartbeat-monitor` → `https://github.com/hzopc1031/dsh-plugins/tree/main/packages/dsh-heartbeat-monitor`

提交前需核对市场当时的仓库年龄、提交数量和 topic（`dsh-plugin`）要求。/ Check the market's repository age, commit count and topic requirements before submitting.

更早的迁移记录见 [交接文档 / handoff](docs/monorepo-handoff.md)。
