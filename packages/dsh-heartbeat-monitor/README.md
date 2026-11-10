# dsh-heartbeat-monitor · 任务心跳

当前源码版本 **0.2.0**（尚未发布本次版本到 npm）。心跳观察 tools/result 中经过校验的 bash foreground canonical value，非零退出、signal、超时、取消、sandbox 拒绝可计为失败，即使 isError=false。只缓存简短失败分类，不保存 canonical 输出正文；在匹配的 native/PTC 日志结果入账时计数一次。后台启动/提升并非进程失败，输出中的伪造退出码不参与判断。PTC 通过 subCallId 配对，run_code 外层与子调用分别计数。历史日志缺少 canonical value 时不从输出猜测进程状态。

本次只完成 Windows 上的 typecheck、单元/rc.5 headless 集成、browser factory 的 jsdom 检查及 verify-pack；未安装到真实 DSH、未做 Electron 目视验收。最新批次记录见仓库 [OPTIMIZE_REPORT.md](../../OPTIMIZE_REPORT.md)。

桌面 DSH 跑长任务（几十分钟）时不吭声，你分不清它是在干活、卡住了，还是在失败重试。这个插件只做一件事：**一轮任务运行期间定时报个平安，发现异常就提醒你**。

- **定时进度卡**：每 N 分钟（默认 5）在对话里出一张卡，写明已运行多久、调用了多少次工具（失败几次、模型重试几次）、最近一次活动是什么、当前哪个工具还在执行、执行了多久。
- **静默警告**：超过 M 分钟（默认 10）没有任何新活动就发警告，并说明是卡在某个工具上，还是可能卡在模型请求或网络上。同一段静默期内每 M 分钟最多提醒一次。
- **重复警告**：同一工具连续调用 K 次（默认 3，默认要求参数也完全相同），或同一错误连续出现 K 次（工具失败、模型请求重试、整轮失败都算），就发警告。达到 K、2K、3K… 次时各提醒一次，不刷屏。
- **结束卡**：任务结束时，如果这一轮已经出过进度卡，会再补一张"本轮结束·总用时"。
- **系统通知（可选，默认关）**：打开后，警告会同时弹出操作系统通知，30 秒内最多一条。
- **手动查看**：任务运行中随时输入 `/heartbeat`（不带参数），立即看当前心跳。

插件不联网、不调用模型、不改项目文件，也不会把卡片内容发给模型。

## 安装

只需要通过 npm 包名或 GitHub 地址安装，不用下载 tgz，也不用自己编译（`lib/` 已预编译并提交到仓库，没有安装脚本）。

**方式一：桌面 DSH 界面（推荐）**
插件 → 添加插件，输入 npm 包名：

```text
dsh-heartbeat-monitor
```

**方式二：命令行，npm 包名**（先完全退出桌面 DSH）

```powershell
dsh plugin --profile desktop add dsh-heartbeat-monitor
```

**方式三：命令行或界面，GitHub 地址**（从 monorepo 子目录安装）

```text
github:hzopc1031/dsh-plugins#main&path:/packages/dsh-heartbeat-monitor
```

```powershell
dsh plugin --profile desktop add "github:hzopc1031/dsh-plugins#main&path:/packages/dsh-heartbeat-monitor"
```

> **Windows 命令行提示**：如果 `dsh` 报 `profile "desktop" is managed exclusively by the Electron application`，说明 PATH 上的是独立安装的 dsh；请改用桌面版自带的 CLI（命令其余部分不变）：
>
> ```powershell
> & "$env:LOCALAPPDATA\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop add <包名或 git 地址>
> ```
>
> git 安装走 HTTPS 克隆 github.com；如果 git 全局配置了 `http.proxy`，代理需要处于运行状态。

装完**完全退出桌面 DSH**（托盘图标也要退出），再重新打开。

卸载：

```powershell
dsh plugin --profile desktop remove dsh-heartbeat-monitor
```

> npm 上已有一个别人发布的同名包 `dsh-heartbeat`（功能不同：定时向会话投递提示词），所以本插件的包名是 `dsh-heartbeat-monitor`。插件条目 id 仍为 `heartbeat`，命令仍是 `/heartbeat`。

## 如何验证

1. `dsh --profile desktop --dump-config` 的输出里应有 `id: heartbeat`、`name: dsh-heartbeat-monitor`。
2. 在桌面 DSH 的「插件」页能看到「任务心跳」。
3. 输入 `/heartbeat`，空闲时应提示"当前没有运行中的任务"。
4. 快速验证：先把 `intervalMinutes` 临时改成 `1`、`silenceMinutes` 改成 `2`，然后给一个需要几分钟的任务（比如"运行 `Start-Sleep 180` 后告诉我结果"）。大约 1 分钟后应出现 💓 进度卡；命令执行满 2 分钟后，应出现 ⚠️ 静默警告，并写明"正在执行：xxx"。
5. 让模型连续 3 次执行同一条会失败的命令，应出现"同一错误连续出现 3 次"的警告。
6. 验证完把配置改回默认值。

## 配置

可以在桌面 DSH 插件页修改 `heartbeat` 这一行的配置，也可以写进 profile 配置：

```yaml
- override:
    id: heartbeat
    config:
      intervalMinutes: 5
      silenceMinutes: 10
      repeatThreshold: 3
      systemNotification: true
```

| 配置项 | 默认值 | 含义 |
| --- | --- | --- |
| `enabled` | `true` | 总开关 |
| `intervalMinutes` | `5` | N：每隔多少分钟发一张进度卡，取值 0.1–1440 |
| `silenceMinutes` | `10` | M：超过多少分钟没有任何活动就发警告，取值 0.1–1440 |
| `repeatThreshold` | `3` | K：同一工具或同一错误连续出现多少次就警告，取值为 2–1000 的整数 |
| `repeatByNameOnly` | `false` | 重复工具只比较工具名；默认还要求参数完全相同，避免连续读不同文件也误报 |
| `progressCards` | `true` | 是否发定时进度卡和结束卡；关闭后只发警告 |
| `systemNotification` | `false` | 警告时同时弹系统通知 |
| `notifyProgress` | `false` | 进度卡也弹系统通知（需同时打开 `systemNotification`） |
| `includeSubagents` | `false` | 是否也跟踪子代理会话；子代理的卡片会出现在子会话里 |

配置非法（比如 `repeatThreshold: 1`）时，插件会在加载时报错，不会静默使用错误的值。计时器每 15 秒检查一次，所以卡片最多会晚 15 秒出现。

## 工作原理（用到的 DSH 接口）

全部基于 DSH 0.2.1-rc.5 源码和文档里真实存在的接口：

| 用途 | 接口 | 出处 |
| --- | --- | --- |
| 一轮开始/结束 | `agent/status` 事件（`running` ⇄ `idle`） | `packages/core/agent/src/runtime-types.ts`，`docs/subsystems/core.md` |
| 活动流 | `session/event` 事件，读取 `step/start`、`assistant/message`、`tool/call`、`tool/result`、`turn/end` | `packages/core/session/src/index.ts`、`types.ts`，`docs/subsystems/session.md` |
| 模型请求重试 | 会话事件 `llm/retry`（含 `retry` 次数和 `failure.code/message`） | `packages/llm/llm-retry/src/types.ts` |
| 在对话里显示卡片 | `ctx.commands.register()` 注册 `/heartbeat`，计时器触发时用 `ctx.commands.execute()` 执行它；结果写成 `command/run` + `command/done`，由桌面聊天界面的命令节点渲染 | `docs/subsystems/commands.md`，`packages/interaction/commands/src/index.ts`，`packages/client/ui-chat/src/client/conversation-nodes/command.ts` |
| 子代理识别 | `session.header.origin === 'subagent'` | `packages/core/session/src/types.ts` |
| 清理 | `ctx.effect()` 返回的清理函数，`session/flush` 时等待未写完的卡片 | `docs/cordis-primer.md` |
| 配置表单 | `Config`（schemastery） | 同 dsh-task-review |

## 降级与已知限制

- **没有"插件主动发消息"的专用接口。** DSH 没有让插件向对话插入一条普通消息或卡片的 API，所以借用了命令卡片：每张心跳卡在对话里显示为一次 `/heartbeat` 命令的结果。进度卡和结束卡显示为成功结果；警告用错误样式显示，更醒目。命令记录会写进会话日志（只记日志，不进入模型上下文），来源会标成"用户"，这是命令接口本身的行为。插件内部使用的临时标记不会写入日志（`recordInput: false`）。
- **没有面向插件的系统通知接口。** 桌面版只在 Electron 主进程里给"更新就绪"用过系统通知，插件拿不到。所以打开 `systemNotification` 后，插件会自己调用系统工具：Windows 用 PowerShell 气泡通知，macOS 用 `osascript`，Linux 用 `notify-send`。通知文字通过环境变量传入，不拼进命令行。如果失败，只在日志里记一条警告。Windows 10/11 的专注助手或勿扰模式可能会把通知藏起来。
- **会话的追加有防重入限制。** 在 `session/event` 回调里同步写日志会被拒绝（实测报错 "session append cannot reenter while another append is being published"），所以卡片都推迟到下一个事件循环再写。
- **子代理执行期间：** 父会话看到的是一个一直在执行的子代理工具。静默警告会写"正在执行：子代理工具名（已 X 分钟）"，但看不到子代理内部的进度。需要看的话，打开 `includeSubagents`。
- **"一轮"的定义：** 从 agent 进入 `running` 到回到 `idle`。如果运行中又排入后续输入，会算在同一轮里。
- 纯 headless、ACP 等没有命令界面的场景下看不到卡片，只有系统通知（如果打开了）。

## 测试情况

- `npm run typecheck`、`npm test`（首版历史记录为 25 项；本批次见 OPTIMIZE_REPORT.md）、`npm run verify-pack`。
- 纯函数规则用假时钟测试，覆盖：定时进度、跳过错过的周期、静默超时及重新计时、正在执行的工具、重复工具（含 K/2K 节流和只比较工具名）、重复错误（含成功后重置）、模型重试、轮次结束后停止、配置校验、脱敏。
- 集成测试使用 npm 上真实的 rc.5 运行时包（`@deepseek-ai/cordis`、`dsh-session` 的 SessionStore、`dsh-commands` 的 CommandRuntime）：确认真实会话日志里写入了 `command/run`、`command/done`；用 `node:test` 的假计时器模拟 12 分钟，确认进度卡、静默警告、结束卡都会出现，并且结束后不再出卡。
- **尚未验证：** 在真实桌面 DSH 里加载、卡片的实际显示效果、Windows 系统通知是否弹出、macOS 和 Linux。

## English

Heartbeat for long DSH turns: a progress card every N minutes (elapsed time, tool calls, last activity), a warning after M minutes of silence, and a warning when the same tool call or the same error repeats K times. Optional OS notifications; `/heartbeat` shows the current status on demand. Cards are rendered as `/heartbeat` command results because DSH has no plugin API for injecting chat messages. Install from npm with `dsh plugin --profile desktop add dsh-heartbeat-monitor` (or type `dsh-heartbeat-monitor` in Plugins → Add plugin), or from git with `github:hzopc1031/dsh-plugins#main&path:/packages/dsh-heartbeat-monitor`, then fully restart the desktop app. The npm name `dsh-heartbeat` belongs to an unrelated package. MIT; the icon is original.

## 本版本开发校验

在本包目录独立执行，使用本包 lockfile（根目录无 workspaces）：

```powershell
npm ci --ignore-scripts
npm run typecheck
npm test
npm run verify-pack
```

`npm test` 会重建需提交的 lib/。以上通过不等于 Electron 桌面通过；真实截图、剪贴板、焦点/布局及桌面安装仍需人工验收。

本次接口依据（固定 rc.5）：[packages/shell/tool-bash/src/index.ts](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/shell/tool-bash/src/index.ts)、[docs/subsystems/tools.md](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/docs/subsystems/tools.md)。
