# DSH 接口核对与后续接入位置

核对源码：`/workspace/dev/deepseek-harness`，提交 `fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159`（`0.2.2-rc.1`）。以下路径相对于该源码根目录；本包不修改 DSH。

| 用途 | 源码 / 文档与符号 | 结论 |
| --- | --- | --- |
| 安装 bundle | `docs/user/develop/basic/publish.md`、`publish.zh.md`，bundle manifest / patch 示例 | `dsh.bundle.patch` 指向 YAML 插入层，行通过包名加载 `index.js`。宿主库用 peer + dev dependency。 |
| 插件入口和配置 | 上述 publish 文档；`packages/storage/storage-domain/src/index.ts` 的 `name` / `inject` / `Config` / `apply`；兄弟包 `dsh-heartbeat-monitor/src/plugin.ts` | 命名导出，`apply(ctx)` 中注册服务贡献，由 Cordis effect 清理。Task 4 注入 `commands` / `tools` / `agents`。 |
| 命令 | `packages/interaction/commands/src/index.ts` 的 `CommandDefinition`、`CommandInvocation`、`CommandRuntime.register`；`src/brand.ts` 的 `CommandDefinitionId`；`src/types.ts` 的 `CommandResult` | 注册不带 `/` 的名称；handler 返回 success/error。注册返回 disposer；命令执行自身不调模型。当前调用 `ctx.effect(() => ctx.commands.register(...))`。 |
| 工具 | `packages/core/tools/src/schema.ts` 的 `defineTool`；`src/index.ts` 的 `ToolsService.register`；`src/contracts.ts` 的 `ToolRunContext` | 注册 `advisory_impact_pin/watch/refresh/report/open/lookup`；输出 schema 为 string，内容为摘要 JSON，每组最多 20 条并标明 total/truncated，不返回 HTML 或 OSV 原始记录。 |
| 路径约束 | `packages/core/tools/src/index.ts` 的 `ToolsService.restrict`、`guard`、`checkGuards` | 在 `agent.ctx` 的注入子上下文中 deny 本插件全部继承全局入口，再注册绑定调用者的同名工具。`guard` 单调拒绝错误调用者、额外路径参数和非法项目目录。固定文件名及库层拒绝 `..`、目录/文件符号链接，读取不跟随链接、写入原子替换。限制只涉及本插件工具，不影响其他工具。 |
| 持久化 | `packages/storage/storage-domain/src/index.ts` 的 `DomainFacility.open`、Context `storageDomain`；`src/spec.ts` 的 `defineDomain`；`src/domain.ts` 的 `Domain.close` | 本包选择插件自有目录的 `SourceCache`，未调用 storageDomain。保存原始响应、URL、抓取时间和页面时间戳；按 TTL 读取，抓取或解析失败返回最后成功缓存及错误。后续宿主接入负责选定插件自有目录。 |
| 无 `ctx.cache` | 搜查 core/storage 的 Context 声明；`packages/storage/storage/src/index.ts`、`packages/storage/storage-domain/src/index.ts` | 未发现 first-class `ctx.cache`。内部 session/projection 缓存不是插件通用缓存服务。 |
| Client 包发现（后续） | `packages/client/modules/src/index.ts` 的 `ClientModuleRegistry.resolveMeta`、`clientExportOf`；`src/client/manifest.ts` 的 `parseDshClient` | 添加 `dsh.client: { platform: 'web', inject: [...] }`，并导出真实的 `exports["./client"]` bundle。缺少该 export 会抛错。当前没有虚假的 client export。 |
| 原生面板（后续，MVP 必需） | `packages/client/ui-layout/src/client/index.ts` 的 `SlotMap.main`；`packages/client/ui-sidebar/src/client/contract/slots.ts` 的 `SlotMap['sidebar.panellist']`；`docs/subsystems/slots.zh.md` | `main` 是 root keyed slot，不依赖 Session；`sidebar.panellist` 的新 id 对应 main key，宿主拥有可访问按钮。用 `ctx.slots.inject` 等待 owner 生命周期，再 `register`，不能覆盖现有面板。 |
| 组件数据与主题（后续） | `packages/client/ui-slots/src/index.ts` 的 `PropsRuntime` / `InjectFace`；`packages/client/ui-theme/src/client/index.ts` 的 theme tokens | 组件不接收 ctx；业务状态留在服务/模型，由注册项 inject 提供 JSON 数据、callback 和 observable。使用 DSH `--dsw-alias-*` 明暗主题语义色。 |

## 后续 UI 的最小接入方案

在真实 client bundle 中注册 `main` key `advisory-impact` 和同名 `sidebar.panellist` 入口，以原生页面承载总览卡、项目 tabs、三态语义色、来源与时间 chips、刷新/错误/陈旧状态。Suppressions 和 OSV-only 独立分组，公告旁必须显示原始链接和抓取时间（Asia/Singapore）。页面在空白会话、没有模型 key 时也必须可用。

数据接口先沿用 `src/types.ts` 的 JSON 类型。抓取库与 DSH 解耦，通过注入 `HttpClient` 便于夹具测试和后续缓存接管；不提前声明未实现的判定或界面协议。UI 与 Host 的本地调用通路在实现阶段对照源码再定，不启用 Remote API。

已只读参考：

- `/workspace/dev/ref/dsh-context/package.json`、`src/client/insightPage.ts`：client manifest、独立 main 页面和 sidebar 入口；`src/client/sidebar.ts`：可选右侧栏生命周期；`src/client/styles/base.css`：DSH 明暗主题 token。
- `/workspace/dev/ref/dsh-context-effort/package.json`、`src/client/index.js`：client 打包与 `slots.inject` / `slots.register`。
- `/workspace/dev/ref/dsh-media-desk/package.json`、`src/host.js`，以及已安装副本的 manifest：双端 export 与 webServer 注册模式。借鉴注册位置，不复制 UI 源码、安装钩子或业务内容。

本阶段没有启动真实 DSH，也未验证浏览器界面；这些检查在最终任务进行。当前调用的入口、Config 与命令 API 均可在 `0.2.1-rc.5` dev peers 下编译，未采用要求提高最低版本的新 API。

## Task 3 共享库接口

包入口额外导出 `Config`、`parseSettings` / `loadSettings` / `saveSettings`、`SourceCache`、`OsvClient`、`createHttpClient` / `createOsvHttpClient` 和 `evaluatePins`。不注册定时抓取，不在 import 或 `apply` 中联网，命令操作和原生面板仍待接入。

配置形状为 `{ watch?: string[], pins?: { project: string, version: string, component?: string, maven?: string }[], cacheTtlMs?: number }`。默认关注 `kafka` / `hadoop` / `flink`，默认 pins 为空，缓存 TTL 为 6 小时。Maven 字段仅 `groupId:artifactId`，版本始终取 `version`。可移除/添加关注项；当前仅这三个 id 有官方适配器，其他 id 明确返回来源不可用，不猜 URL 或判定。

`loadSettings(config, projectDirectory?)` 每次重读项目根目录固定文件 `.advisory-impact.json`；文件中提供的字段覆盖插件配置，同名数组整体替换。文件缺失使用插件配置，损坏文件明确报错。`saveSettings(projectDirectory, config)` 校验配置并原子保存；拒绝覆盖损坏文件、符号链接或超出 64 KiB 的配置。项目目录需为不含 `..`、不经过符号链接的现存绝对路径。

```ts
const cache = new SourceCache(pluginOwnedCacheDirectory, createHttpClient())
const osv = new OsvClient(new SourceCache(pluginOwnedOsvCacheDirectory, createOsvHttpClient()))
const result = await evaluatePins({ config, projectDirectory, cache, osv, force: false })
```

这里的目录和 config 由后续宿主层提供，示例不提供任何默认运行版本。测试必须注入夹具 transport 和时间，不能使用默认线上 fetch。`force: true` 跳过 TTL；网络访问串行、无凭据、拒绝重定向，仅允许已记录的官方端点和 OSV GET / Maven POST。

`Evaluation.projects[].source` 保留 `fresh` / `cached` / `stale` / `error`、原抓取时间、错误及可用的官方清单；无最后成功数据时 `data` 和 `verdicts` 为 null。Kafka 缺少可用 suppression 数据时已填写 pin 的所有判定暂为 unknown，防止忽略官方不适用说明。`suppressions` / `guidance` / `flinkPointer` 各自保留来源状态。来源失败时 UI/报告必须呈现这些状态。

`verdicts.advisories[].osv` 单独保留 lookup、queryMatches 和 comparison，永不改写官方 matcher 的结果。404 明确为「OSV 未收录 / HTTP 404」。可比数字边界表述有差异时标记 `different_ranges`；Maven query 命中且同一 pin 官方为不受影响时标记 `query_disagreement`。`not_compared` 不代表一致。GIT hash、未完整表达的范围或只有样本版本时不推出 OSV 的不受影响判定。查询返回未知字段（例如分页 token）时明确失败，避免把部分页面当完整列表。

`projects[].osvOnly` 是独立「仅见 OSV，未见官方公告」分组，按官方 id / OSV aliases 对照，排除已知官方 suppressions；条目含原记录、查询 pin、URL、时间和缓存状态，没有官方 verdict 字段。官方清单不可用时 `inventoryAvailable: false`，不根据缺失的清单声称 OSV-only。库返回标准化证据，不返回原始 HTML；后续工具默认仍应进一步取摘要。

本任务继续仅使用已有 DSH Config schema API，参见 `docs/user/develop/basic/config.zh.md` 的 Config 默认值与 schema 校验；无新增 DSH 服务 API。未启动 DSH 或进行实时 OSV/官方抓取，没有模型调用。

## Task 4 命令、工具与报告接入

继续以 `fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159` 源码为准。本节取代前面 Task 1–3 中「命令操作待接入」的阶段说明；原生 UI 仍由 Task 5 实现，是必需交付。

新增宿主引用：

- `packages/core/agent/src/runtime-types.ts`：`Agent.ctx`、`Events['agent/created']` / `['agent/disposed']`；`packages/core/agent/src/index.ts`：`AgentRegistry.list`。安装时处理已存在 agent，后续监听创建/销毁，卸载时清理所有 scoped 注入 fiber。
- `packages/context/file-reference-local/src/index.ts`：`LocalFileReferenceService` 中 `agent.ctx.inject(['systemPrompt', 'tools'], ...)`、已有 agent 安装、fiber.dispose 模式。本包只在 scoped 子上下文注入 tools。
- `packages/session/working-directory/src/index.ts`：`WorkingDirectoryService.get(session)`。通过 `ctx.get('workingDirectory')` 读取可选服务；缺失时使用 `agent.session.header.cwd`，不把进程 cwd 当项目目录，不接受工具提供的目录。
- `packages/interaction/commands/src/index.ts`：`CommandDefinition.input`、`recordInput`、`CommandInvocation.rawInput/agent/signal`；`src/types.ts`：`CommandResult`。合同无 locale 字段，命令固定中文优先，不猜语言 API，不触发模型轮次。
- `packages/core/tools/src/schema.ts`：`defineTool` 的 parameters、output schema/render、execute；`src/contracts.ts`：`ToolRunContext.agent/name/arguments/signal`。参数根 schema 允许额外字段，本包额外明确拒绝未声明字段，不能通过额外 directory/path 绕过约束。
- `packages/core/tools/src/index.ts`：`ToolsService.register/restrict/guard`。全局占位入口拒绝执行，只有作用域内绑定调用者的入口能调用共享服务；guard 与 body 均校验调用者。restrict 是工具可见性限制，实际文件边界仍由 `src/local.ts` 验证。命令不经过工具执行管线，直接使用同一套本地文件边界。

`AdvisoryService` 将 pin/watch 编辑、刷新、lookup、中文报告生成及固定路径保存串行化，防止并发编辑丢失更新。`evaluatePins` 新增可选 signal，在来源读取之间检查取消，停止后续请求和报告保存；已发出的单次 HTTP 仍由既有 15 秒超时控制。import/apply/help/pin/watch/open 不触发网络；报告/lookup 走 TTL 缓存，refresh 强制刷新。缓存固定在 `~/.cache/dsh-advisory-impact/official` 和 `osv`，不接受调用者缓存路径。

命令语法和工具行为以 `HELP` 为准：

- `pin <project> <version> [component=<name>] [maven=<groupId:artifactId>]` 替换该项目 pin，`pin remove <project>` 移除；不带参数查看。Maven 非必填，填写后允许既有 OSV Maven 版本查询。
- `watch kafka,hadoop,flink` 替换关注数组，`watch none` 清空，不带参数查看。
- `report` 输出完整可复制中文 Markdown；`report save` 保存 `advisory-impact-report.md` 并返回路径。
- `open` 读取固定文件并在命令输出中展示 Markdown，不打开浏览器/任意文件；工具仅返回校验过的路径与字节数。
- `lookup <CVE-id>` 保留官方三态、证据、第二来源状态和 suppression；未见官方条目或仅见 OSV 时返回未知，绝不把缺失当不受影响。
- report 工具保存文件并返回摘要，其他工具同样返回摘要 JSON，无 verbose 原始正文选项。每组超过 20 条标明截断，完整正文通过 Markdown 报告查看。

`createViewModel(Evaluation)` 是报告/后续原生 UI 的共享 JSON 证据模型：三态 label、原文范围/修复版本、notes、每个 pin、官方来源/UTC+8 时间/页面时间、来源错误/陈旧状态，以及独立 suppressions / OSV-only / OSV comparison。`advisories: null`、`source: null/error` 表示不可用，不能把计数 0 当成成功空清单。`renderReport` 不生成当前时间，只消费证据时间，因此固定输入给出确定的章节结构与正文；不调用模型。

验证使用真实 Cordis Context、`createScope` 和已安装最低 dev peer `dsh-tools@0.2.1-rc.5` 注册器（其余宿主服务为小型测试替身），实际安装 restrict/guard 并检查跨调用者拒绝、清理及不影响其他工具。guard 回调在测试执行 helper 中调用，不冒充完整宿主工具执行管线。HTTP 全部使用带 provenance 的录制夹具；这不是启动 DSH 的 live load，也没有测试原生页面。上述 API 在最低 dev peers 下 build/typecheck 通过，engines 不需要提高；真实 CLI 加载/页面及实时来源冒烟仍留最终任务。
