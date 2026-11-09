# dsh-plugins

`hzopc1031/dsh-plugins` 是 DeepSeek Harness（DSH）插件的 monorepo，目前仅包含 `dsh-task-review`。许可证：MIT。仓库地址、npm 安装命令和市场条目是后续发布的目标，本次仅完成本地准备，尚未发布。

`hzopc1031/dsh-plugins` is a monorepo for DeepSeek Harness (DSH) plugins. It currently contains only `dsh-task-review`, licensed under MIT. Repository links, npm installation, and marketplace entries below describe the planned release; this local preparation does not publish anything.

| 插件 / Plugin | 版本 / Version | 功能 / Purpose | 文档 / Docs |
| --- | --- | --- | --- |
| `dsh-task-review` | `0.1.1` | 自动或手动任务复盘，保存本地 Markdown 报告 / Automatic or manual task reviews with local Markdown reports | [README](packages/dsh-task-review/README.md) |

## 安装 / Installation

需要 Node.js >= 22、兼容的 DSH（`>=0.2.1-rc.5 <0.3.0`），以及 DSH 安装流程所需的 pnpm。将 `<name>` 替换为目标 profile 名称；安装后重启该 profile，执行工具后输入 `/review`。更多配置见插件文档。

Requires Node.js >= 22, compatible DSH (`>=0.2.1-rc.5 <0.3.0`), and pnpm for the DSH installation flow. Replace `<name>` with your target profile. Restart that profile after installation and enter `/review` after tool activity. See the plugin README for configuration.

npm 发布后 / After npm publication:

```sh
dsh plugin --profile <name> add dsh-task-review
```

发布前可先构建本地 tgz。以下命令从仓库根目录开始，在插件目录打包，然后返回根目录安装：

Before publication, build a local tarball. Start at the repository root, pack inside the plugin directory, then return to the root to install:

```sh
cd packages/dsh-task-review
npm install
npm run typecheck
npm test
npm pack
cd ../..
dsh plugin --profile <name> add ./packages/dsh-task-review/dsh-task-review-0.1.1.tgz
```

`npm test` 包含构建；`npm pack` 本身不会编译源码。安装命令会修改指定 profile，仅在准备好使用时手动执行。

`npm test` includes the build; `npm pack` itself does not compile source. The installation command modifies the selected profile; run it manually when ready to use the plugin.

## 本地开发 / Local development

根 `package.json` 标记为 `private: true`，禁止发布根包。本次保留每个插件独立的依赖和 lockfile，不启用 npm workspaces，以避免迁移现有 lockfile、提升依赖位置而改变既有打包/安装验证环境。请在 `packages/dsh-task-review` 内执行 npm 命令，根目录的 `npm install` 不会安装插件依赖。

The root package is private. Each plugin keeps independent dependencies and its own lockfile. npm workspaces are intentionally deferred to preserve the existing lockfile and dependency layout used by packaging and installation verification. Run npm commands inside `packages/dsh-task-review`; installing at the root does not install plugin dependencies.

Pack verification (PowerShell, inside `packages/dsh-task-review`):

```powershell
New-Item -ItemType Directory -Force .tmp | Out-Null
npm pack --json | Set-Content -Encoding UTF8 .tmp/pack-manifest.json
node scripts/verify-pack.mjs
```

For other shells, create `.tmp`, save the complete JSON output of `npm pack --json` as UTF-8 to `.tmp/pack-manifest.json`, then run the verifier.

## 后续市场收录 / Future marketplace listing

计划条目 / Planned entry:

- name: `hzopc1031/dsh-plugins#dsh-task-review`
- url: `https://github.com/hzopc1031/dsh-plugins/tree/main/packages/dsh-task-review`

后续向 `awesome-dsh-plugin` 提交前，应核对其当时的仓库年龄、提交数量及 topic 要求，并设置仓库 topic `dsh-plugin`。保留真实开发历史，等待满足要求后再提交；本次不声称已满足门槛或已被收录。

Before a future `awesome-dsh-plugin` submission, check its current repository age, commit count, and topic requirements, and add the `dsh-plugin` repository topic. Preserve real development history and wait until eligible. No eligibility or marketplace acceptance is claimed here.

本次变更与验证结果见 [交接文档 / handoff](docs/monorepo-handoff.md)。
