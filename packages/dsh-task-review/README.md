# dsh-task-review

当前源码版本 **0.2.1**（尚未发布本次版本到 npm）。复盘同时识别 rc.5 bash foreground canonical value 的非零 exitCode、signal、超时、取消与 sandbox 拒绝；不解析 stdout/stderr。后台启动和提升为后台的结果标为 pending，缺少 canonical value 的历史 bash 标为 unknown。PTC 子调用按 subCallId 关联；同一次调用的实时记录与日志回放不会重复计数，外层 run_code 和真实子调用是不同调用。报告目录与路径展示使用 workingDirectory.get(session)，服务缺失时才回退初始 header.cwd；绝对 reportDir 不变。

本次只完成 Windows 上的 typecheck、单元/rc.5 headless 集成、browser factory 的 jsdom 检查及 verify-pack；未安装到真实 DSH、未做 Electron 目视验收。最新批次记录见仓库 [OPTIMIZE_REPORT.md](../../OPTIMIZE_REPORT.md)。

在 DeepSeek Harness 工作停止时自动生成任务复盘卡片，并将 Markdown 报告保存在本机；也可随时输入 `/review` 手动复盘。

## 安装

需要 Node.js >= 22、已安装的 DSH 及包管理器 pnpm。成品已编译，无需源码、TypeScript 或安装期构建。请使用独立 profile，以下统一使用 `task-review-demo`。

收到团队分发的 tgz 后，在文件所在目录执行一条命令：

```sh
dsh plugin --profile task-review-demo add ./dsh-task-review-0.2.1.tgz
```

已发布 npm 的版本是 0.1.1（2026-11-10 只读核对）；本次源码为 0.2.1，尚未发布，不要将下面命令误作安装新功能：

```sh
dsh plugin --profile task-review-demo add dsh-task-review@0.1.1
```

首次创建的自定义 profile 如果是 headless，可先创建 Web profile 再安装：

```sh
dsh --profile task-review-demo --from-default-profile web --dump-config
```

`--from-default-profile` 会替换该独立 profile，仅首次使用，已有配置请勿重复执行。

## 确认生效与使用

```sh
dsh --profile task-review-demo --dump-config
dsh --profile task-review-demo
```

配置输出应包含 `id: task-review`、`name: dsh-task-review`。重启该 profile，在 Web「插件」页确认标题“任务复盘”、描述和图标；对话中执行工具后输入 `/review`（无参数），应出现摘要卡片，展开能查看完整 Markdown 源文本，项目 `.dsh/reports/` 下有同一份报告。立即再次输入 `/review` 应提示没有尚未复盘的新内容。

截图占位：插件页（标题、描述、图标）；复盘卡片（折叠摘要与展开报告）。待补图。

默认在 AI 停下等待输入（idle）时，累计满足任意一项便自动复盘：10 次工具调用、3 个有证据的改动文件、10 分钟。手动 `/review` 不受门槛限制。每次只覆盖上次成功存档之后的新内容，低于门槛继续累计。

报告列出目标摘要、执行状态、已确认文件变更、失败与疑似重试、真实用量、耗时及基于失败/未完成调用的下一步。没有证据的数据标“不可用”，不估算费用或宣称任务完成。

## 配置

在独立 profile 的插件配置界面修改 `task-review` 行，或修改其 `cordis.patch.yml`：

| 配置项 | 默认值 | 含义 |
| --- | --- | --- |
| `auto` | `true` | idle 时自动判断；关闭后仍可手动复盘 |
| `toolThreshold` | `10` | 工具调用次数，正整数 |
| `fileThreshold` | `3` | 唯一改动路径数，正整数 |
| `durationMinutes` | `10` | 段首有效事件至复盘的墙钟分钟数，最小 0.001 |
| `reportDir` | `.dsh/reports` | 相对会话当前有效工作目录，或绝对目录 |

```yaml
- override:
    id: task-review
    config:
      auto: true
      toolThreshold: 10
      fileThreshold: 3
      durationMinutes: 10
      reportDir: .dsh/reports
```

文件名包含 UTC 时间、清理后的目标摘要及随机后缀，独占创建避免覆盖。可将 `reportDir` 改为 DSH_HOME 下的实际绝对路径；不会展开 `~` 或 `$DSH_HOME`。无项目目录且使用相对路径，或目录不可写时，存档失败并保留边界，修正后重试 `/review`。

## 隐私与权限

- 对项目代码只读；仅写报告及宿主会话中的插件记录，不修改用户代码。
- 插件运行时不联网、不上传、不调用模型，不需要 token 或额外账户。安装包管理器可能联网，属于宿主安装流程。
- token/key/password/secret 等参数字段递归脱敏；脚本、命令、文件正文省略，不保存工具输出正文。自由文本仅处理常见凭据模式，无法保证识别任意无标记秘密；插件不会改写宿主已有的原始日志。
- 文件变更只采用文件工具的域结果或可选 `workspaceChanges` 服务的证据。缺少该服务时自动降级，仍可按调用次数和耗时复盘，不猜测 shell 写入。

## 卸载

```sh
dsh plugin --profile task-review-demo remove dsh-task-review
```

重启该 profile。已有 Markdown 报告保留，可自行删除。

## 兼容与限制

DSH 声明范围：`>=0.2.1-rc.5 <0.3.0-0`；本批次只验证固定 rc.5 API/运行时包；旧版本记录中的 rc.1 验证不能代表本批次对其他版本的承诺。平台实测为 Windows、Node 24.20.0；macOS/Linux 尚未验证。范围内其他版本未逐一测试，升级后建议先在独立 profile 验证。

卡片使用宿主原生命令结果展示，多行正文折叠，展开为 Markdown 源文本。纯 headless 没有聊天卡片。Web 界面尚未做目视验收。

Token 仅汇总最终 assistant 消息的权威样本并标明覆盖消息数；失败尝试、缺失样本和费用金额不可用。文件清单不是净 diff。会话持久化未启用时边界不跨进程保存；文件写入与会话持久化之间崩溃可能造成孤立或重复报告。

## 常见问题

**装不上？** 确认 tgz 路径、Node 和 DSH 版本、`pnpm --version` 可用，并查看 CLI 给出的诊断日志。不要用 `allow-version` 绕过兼容检查；先确认安装的是对应版本的成品包。此包无需允许构建脚本，也无需另装任何 `@deepseek-ai/*` 包。

**看不到卡片？** 确认启动的是安装时使用的同一个 profile，安装或替换包后重启。先用 `--dump-config` 检查插件行，再在带命令 UI 的 Web profile 执行工具并输入 `/review`。自动卡片要等进入 idle 且达到任一门槛；没有新内容不会重复出报告。headless 请查看存档。

**没有 shell 文件变更或费用？** 缺少宿主证据或权威费用字段时显示不可用，这是预期行为。

## English quick start

Read-only task reviews for DSH: an automatic command card when work becomes idle and a local Markdown archive. Install the prebuilt tarball with `dsh plugin --profile task-review-demo add ./dsh-task-review-0.2.1.tgz`, restart that profile, and enter `/review` after tool activity. Reports default to the project's `.dsh/reports/`. Automatic review triggers at 10 tool calls, 3 evidenced changed files, or 10 minutes; all thresholds are configurable above. Remove with `dsh plugin --profile task-review-demo remove dsh-task-review`.

This batch uses Windows with published DSH 0.2.1-rc.5 runtime packages; declared range `>=0.2.1-rc.5 <0.3.0-0`, Node >=22. No runtime network, uploads, model calls, or install builds. Sensitive argument fields are redacted; arbitrary unmarked secrets cannot always be detected. Only reports and plugin session records are written. macOS/Linux and visual Web UI verification are pending.

MIT；图标为本项目原创 SVG。变更见 [CHANGELOG](CHANGELOG.md)。

## 本版本开发校验

在本包目录独立执行，使用本包 lockfile（根目录无 workspaces）：

```powershell
npm ci --ignore-scripts
npm run typecheck
npm test
npm run verify-pack
```

`npm test` 会重建需提交的 lib/。以上通过不等于 Electron 桌面通过；真实截图、剪贴板、焦点/布局及桌面安装仍需人工验收。

本次接口依据（固定 rc.5）：[packages/shell/tool-bash/src/index.ts](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/shell/tool-bash/src/index.ts)、[docs/subsystems/tools.md](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/docs/subsystems/tools.md)、[packages/session/working-directory/src/index.ts](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/session/working-directory/src/index.ts)。


### 0.2.1 兼容性声明

本版声明 DSH `>=0.2.1-rc.5 <0.3.0-0`。官方版本检查使用 `semver.satisfies` 并开启 `includePrerelease`：接纳 0.2.1-rc.5、0.2.2-rc.1 及后续 0.2.x 预发布/正式版，排除 0.3.0（含预发布）。DSH peer 显式覆盖两个已知 RC，Cordis / Schemastery peer 覆盖两个官方 tag 的版本；开发依赖不变。此次没有安装到用户 DSH；准入通过不等于逐版本功能或界面验证通过。

校验逻辑、源码对照与本次检查结果见[兼容性报告](../../docs/engines-compatibility.md)。
