# “运行中 26 分钟无提醒”代码排查

排查日期：2026-11-11。插件基线为本分支原有 0.2.0；同时只读检查了 npm 发布的 0.1.0 `lib/plugin.js`。DSH 依据固定为 `dsh-v0.2.1-rc.5`。没有访问故障电脑，也没有把插件安装进本机 DSH。

## 根因判断（按排查优先级）

没有故障电脑的日志，不能唯一确定现场原因；下列排序是代码结合现象的判断，不是现场统计。

| 优先级 | 判断 | 证据与确定程度 |
| --- | --- | --- |
| 1 | 插件没有在 desktop profile 成功加载，或被关闭、配置非法 | **现场推测**。最符合“全程无提示”，但代码无法证明现场安装状态。安装在其他 profile 不会使 desktop 加载；`enabled=false` 不跟踪；`resolveSettings()` 对非法值抛错，Config 的 schema 也可先拒绝配置。`plugin list` 只证明安装，dump 证明配置合成，均不证明运行期成功加载。 |
| 2 | 插件在任务开始后才加载或重载，漏掉唯一的 `running` 边沿 | **已确认插件 bug，未确认现场触发**。npm 0.1.0 和基线 0.2.0 都只监听后续 `agent/status`，没有扫描已有 agent；`session/event` 对未跟踪会话直接返回。真实 rc.5 Registry/scope 回归：旧实现静默 26 分钟得到 0 张卡，修复后得到 5 张进度卡、2 次静默警告。 |
| 3 | 当前查看的是子会话，或 goal 等待子代理时父 agent 已 idle | **条件已确认，现场推测**。`origin==='subagent'` 默认排除。普通父 agent 仍 running、同步等待子代理工具时会持续跟踪；goal driver 则可以在父 idle 时等待子代理，这段时间不属于插件定义的一轮。 |
| 4 | 卡片发送失败、命令缺失或被作用域内的同名命令覆盖 | **已确认诊断缺陷，现场推测**。异常原来只记通用 warn；CommandRuntime 对未知命令返回 `undefined`，原插件完全不报错。正常 rc.5 running agent 可以追加命令生命周期。 |
| 5 | scope 过滤、UI 更新失败、Host 事件循环阻塞 | **正常根挂载路径未发现 scope/UI 缺陷；异常运行期仍未验证**。见下述链路。若 Host 的 JS 事件循环本身被同步代码阻塞，进程内 timer 和系统通知触发代码都不能执行，插件内无法提供独立看门狗。 |

## 已核实的链路

- **状态事件。** [ReactLoopAgent.setPhase](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/core/agent-loop/src/agent.ts) 仅在状态变化时经 `agentEvents(loopCtx, this)` 发出通知。没有新日志不影响已启动的 15 秒 timer；agent.id 与 session.id 相同。
- **scope。** [scopeTarget](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/core/scope/src/index.ts) 接纳未标 scope 的监听器；带标签的监听器只接纳同一 scope 或后代。插件 patch 将 heartbeat 作为根条目插入。[desktop-host](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/apps/desktop-host/src/index.ts) 调用 `runProfile`，其 [profile-boot](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/apps/cli/src/profile-boot.ts) 经 [boot](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/boot/app-boot/src/index.ts) 创建普通根 Context 并挂载配置树，未给整个插件树添加 agent scope。回归测试现在经真实 `agentEvents` 和在 `createScope` 下附着的 Session 发事件，不再用无 carrier 的 `ctx.emit` 代替状态分发。因此标准根挂载不需要补 `{ global: true }`；自定义把 heartbeat 放进某个 agent scope 的安装方式不属于本包 patch 的标准路径，也不能仅靠全局监听解决命令注册的可见范围。
- **session-controller 路径。** 固定 rc.5 tag 下没有题述 `src/state/listener.ts`。实际状态监听在 `src/index.ts`；使用 `{ global: true }` 的实时历史订阅在 [src/history.ts](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/api/session-controller/src/history.ts)。不能把别的版本中的文件结构当作 rc.5 证据。
- **命令写入。** [CommandRuntime.execute](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/interaction/commands/src/index.ts) 不因 agent running 而拒绝执行；直接追加 `command/run`、`command/done`，不写入模型上下文。会话日志禁止同步重入，插件原有的 macrotask 延迟已规避这一点。
- **实时 UI 数据流。** `history.follow()` 在监听目标 session 的每个 event 后唤醒订阅，随后直接 `entryFor(event)`，没有按 UI 发起者或 command id 白名单过滤；[ClientSession.appendLive](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/api/session-controller/src/client/sessions/session.ts) 将事件交给 eventSource；[ConversationNodeAssembler.append](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-conversation/src/client/conversation/assembler.ts) 增量组装；[commandDefinition](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-chat/src/client/conversation-nodes/command.ts) 对所有 command/run、command/done 配对并生成可见节点，不要求 UI 提交记录。源码层面支持实时显示插件命令卡，不需要刷新或重开。**未以 Electron 界面实测；不等于现场一定已渲染或滚动到可见位置。**
- **父子代理与 goal。** 默认过滤只排除被标成 subagent 的会话，不排除等待工具的 running 父 agent。[goal-round-driver](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/goal/goal-round-driver/src/index.ts) 在 idle 时等待 children，之后用同一 agent 的 `followup()` 开下一轮；goal 本身不自动被排除，但轮次之间的 idle 时间不计时。
- **unref。** [desktop Host](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/apps/desktop/src/host-process.ts) 是带 IPC 的子进程，内部还运行 Web 服务。timer.unref 不改变存活事件循环上的触发资格，只是不单独阻止进程退出；若 Host 已退出或被阻塞，改成 ref 不能恢复正常处理。不为此移除 unref。

## 修复范围

0.2.1 在监听器、命令与清理逻辑就绪后，注入现有 `agents` 服务并扫描 `list()`，接管当时仍 running 的 agent。此注入为可选依赖，服务稍后就绪时同样扫描；正常后续 running/idle 仍用原有事件维护，重复 running 不重置计时。接管遵守 `enabled` 与 `includeSubagents`。

接管从当前时刻起算运行时长、活动统计和静默时间，不回放既有日志、不宣称恢复漏掉的历史时长。以后每 5 分钟出进度卡、静默每 10 分钟出警告；加载前的 26 分钟不补发。

发送失败现在记录会话、提醒种类及截断脱敏的错误原因，且会识别 `execute()` 返回 undefined 和同名命令未消费提醒 token 的情况。仍保持异常隔离，不中断用户任务。没有因为猜测 UI 不支持而默认启动外部系统通知程序；系统通知仍可由用户显式打开。

## 验证边界

- 真实 npm rc.5 Cordis、AgentRegistry、scope 分发、SessionStore、CommandRuntime 配合假时钟，验证运行后加载、重载、连续静默 26 分钟、idle 后结束；原实现可复现 0 张卡。
- 默认子代理排除、显式包含子代理、enabled=false、idle 不接管；已启动会话的 scope 活动能到达根插件并生成重复工具警告；卡片的 command/run、command/done 实际写入 Session。
- 命令丢失、同名覆盖和抛错的诊断与脱敏；已有核心、bash/PTC 规则继续回归。
- 上述集成仍使用受控 Agent 替身，真实 `ReactLoopAgent` 的状态变化只核对了源码，尚未新增实际驱动 agent-loop 的自动测试。
- 未验证故障电脑、Electron 最终绘制、系统通知显示；UI 链路是固定 rc.5 源码审阅，不能把日志测试称为桌面渲染测试。
- 最终 `npm run typecheck`、`npm test`（37 项）、`npm run verify-pack` 均通过；包清单 22 个文件，重建的 `lib/` 随源码提交。

## 故障电脑自查（只读）

用该电脑桌面版自带的 CLI；自定义安装位置时替换第一行路径，不使用 PATH 上另一套独立安装的 dsh。

```powershell
$dsh = "$env:LOCALAPPDATA\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd"
Test-Path -LiteralPath $dsh
& $dsh --version
& $dsh plugin --profile desktop list dsh-heartbeat-monitor --depth 0
& $dsh --profile desktop --dump-config | Select-String -Pattern 'heartbeat|intervalMinutes|silenceMinutes|progressCards|includeSubagents|systemNotification' -Context 2,8
```

先区分安装版本 0.1.0/0.2.0/0.2.1，配置里有无 `id: heartbeat`、`name: dsh-heartbeat-monitor`，条目有无被禁用、`enabled:false`、`progressCards:false` 或非法数值。配置缺省 `{}` 应对应 5/10 分钟。再在桌面插件页查看加载错误；运行任务时手动 `/heartbeat` 能进一步区分“命令未注册”“已关闭”“没有跟踪到任务”与“已跟踪但自动卡片看不到”。不要把整份配置或凭据发出来，只保留 heartbeat 条目和相关错误。

## README 审阅

- [x] 标题后先说明用户所得，未先讲实现。
- [x] 四条亮点分别覆盖进度、异常、手动与收尾、通知。
- [x] 与只看“运行中”的差异有输出字段作为依据，不承诺能判定卡死。
- [x] 亮点后有标注为示意的命令与输出。
- [x] 本次新增的本地链接和示例有效，无截图占位；远端引用固定 rc.5 源码。
- [x] 快速上手恰好三步，先完全退出含托盘，再安装并重开。
- [x] Git 命令为真实 monorepo 目录，完整地址加引号。
- [x] 首次入口与可见结果具体，说明无必填配置、使用 desktop profile。
- [x] 新增说明使用日常表达，配置键与命令保持准确。
- [x] 版本、限制、实现和测试放进最后的补充说明。
- [x] 开头没有版本、测试数或验收日志。
- [x] 区分源码审阅、运行时日志测试与未做的桌面验证。
- [x] 名称、入口、配置和示例与本插件一致，无凭据或私人信息。
- [x] README 工作未触发安装、发布或 Git 操作；本任务另行授权的代码修改、测试、提交按任务范围进行。
