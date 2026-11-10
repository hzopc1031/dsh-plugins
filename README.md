# dsh-plugins

`hzopc1031/dsh-plugins` 是 DeepSeek Harness（DSH）插件的 monorepo，每个插件在 `packages/` 下各自独立（独立依赖和 lockfile），可直接从本仓库的子目录用 git 安装；已发布到 npm 的包也可用 npm 包名安装，发布状态见下表。许可证：MIT。

`hzopc1031/dsh-plugins` is a monorepo of DeepSeek Harness (DSH) plugins. Each plugin under `packages/` is independent and installable from git via its subdirectory. Packages published to npm can also be installed by npm name; see the publication status below. MIT licensed.

| 插件 / Plugin | npm 包名 / npm name | 功能 / Purpose | 文档 / Docs |
| --- | --- | --- | --- |
| 任务复盘 | [`dsh-task-review`](https://www.npmjs.com/package/dsh-task-review) | 自动或手动任务复盘，保存本地 Markdown 报告（`/review`）/ Task reviews with local Markdown reports | [README](packages/dsh-task-review/README.md) |
| 任务心跳 | [`dsh-heartbeat-monitor`](https://www.npmjs.com/package/dsh-heartbeat-monitor) | 长任务定时进度卡、静默/重复警告（`/heartbeat`）/ Timed progress cards and stall/repeat warnings | [README](packages/dsh-heartbeat-monitor/README.md) |
| 桌面插件组合回归台 | `dsh-plugin-combo-lab`（未发布 npm / not published to npm） | 双插件组合回归计划、人工证据记录与升级对照（`/combo-lab`）/ Two-plugin regression plans, manual evidence and upgrade comparisons | [README](packages/dsh-plugin-combo-lab/README.md) |
| 资料更新影响分析 | `dsh-source-impact`（未发布 npm / not published to npm） | 显式来源引用追踪与更新影响复查清单（`/impact`）/ Explicit source citation tracking and update impact checklists | [README](packages/dsh-source-impact/README.md) |
| 内容证据工作台 | `dsh-content-evidence`（0.1.0 开发分支，未发布 npm / unreleased git branch） | 材料与证据追踪、四平台草稿、复核、本地导出；不自动发布 / Evidence tracing, four-platform drafts, review and local export; never auto-publishes | [README](packages/dsh-content-evidence/README.md) |

> 心跳插件的 npm 包名是 `dsh-heartbeat-monitor`：`dsh-heartbeat` 已被一个无关的包占用。
> The heartbeat plugin is published as `dsh-heartbeat-monitor` because `dsh-heartbeat` is an unrelated package.

## 安装 / Installation

需要兼容的 DSH（`0.2.1-rc.5` 起）。所有包都已预编译，没有安装脚本。装完后**完全退出桌面 DSH（含托盘）再重新打开**。

Requires a compatible DSH (`0.2.1-rc.5`+). Packages are prebuilt and have no install scripts. Fully quit and reopen DSH Desktop after installing.

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
```

内容证据工作台尚未合并到 `main`，从开发分支安装到 web profile；本地导出目前需要 Linux 和 procfs：

Content evidence is unreleased and lives on `feat/content-evidence`. Install into a web profile; local export currently requires Linux and procfs:

```sh
dsh plugin --profile web add "github:hzopc1031/dsh-plugins#feat/content-evidence&path:/packages/dsh-content-evidence"
```

重启 DSH 后打开侧栏「内容证据」。数据默认保存在 `$DSH_HOME/content-evidence` 或 `~/.dsh/content-evidence`，卸载保留数据；导出仅写本机目录，插件绝不自动发布。

Restart DSH and open Content evidence in the sidebar. Data defaults to `$DSH_HOME/content-evidence` or `~/.dsh/content-evidence` and survives uninstall. Exports stay local; nothing is published automatically.

同样的 `github:...` 地址也可以填进界面的「添加插件」。把 `main` 换成某个提交哈希即可固定版本。

The same `github:...` address works in the Add plugin dialog. Replace `main` with a commit hash to pin a version.

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
npm run verify-pack # 心跳 / heartbeat
```

`lib/` 为预编译产物并提交到仓库，git 安装无需构建；改动源码后请 `npm test`（会重建 `lib/`）再提交。

`lib/` is committed so git installs need no build; run `npm test` (rebuilds `lib/`) before committing source changes.

dsh-task-review 的打包校验见其 README / For dsh-task-review pack verification see its README.

## 市场收录 / Marketplace listing

计划条目 / Planned entries（`awesome-dsh-plugin`）：

- `hzopc1031/dsh-plugins#dsh-task-review` → `https://github.com/hzopc1031/dsh-plugins/tree/main/packages/dsh-task-review`
- `hzopc1031/dsh-plugins#dsh-heartbeat-monitor` → `https://github.com/hzopc1031/dsh-plugins/tree/main/packages/dsh-heartbeat-monitor`

提交前需核对市场当时的仓库年龄、提交数量和 topic（`dsh-plugin`）要求。/ Check the market's repository age, commit count and topic requirements before submitting.

更早的迁移记录见 [交接文档 / handoff](docs/monorepo-handoff.md)。
