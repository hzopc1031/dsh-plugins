# DSH 接口核对与后续接入位置

核对源码：`/workspace/dev/deepseek-harness`，提交 `fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159`（`0.2.2-rc.1`）。以下路径相对于该源码根目录；本包不修改 DSH。

| 用途 | 源码 / 文档与符号 | 结论 |
| --- | --- | --- |
| 安装 bundle | `docs/user/develop/basic/publish.md`、`publish.zh.md`，bundle manifest / patch 示例 | `dsh.bundle.patch` 指向 YAML 插入层，行通过包名加载 `index.js`。宿主库用 peer + dev dependency。 |
| 插件入口和配置 | 上述 publish 文档；`packages/storage/storage-domain/src/index.ts` 的 `name` / `inject` / `Config` / `apply`；兄弟包 `dsh-heartbeat-monitor/src/plugin.ts` | 命名导出，`apply(ctx)` 中注册服务贡献，由 Cordis effect 清理。当前只需要 `commands`。 |
| 命令 | `packages/interaction/commands/src/index.ts` 的 `CommandDefinition`、`CommandInvocation`、`CommandRuntime.register`；`src/brand.ts` 的 `CommandDefinitionId`；`src/types.ts` 的 `CommandResult` | 注册不带 `/` 的名称；handler 返回 success/error。注册返回 disposer；命令执行自身不调模型。当前调用 `ctx.effect(() => ctx.commands.register(...))`。 |
| 工具（后续） | `packages/core/tools/src/schema.ts` 的 `defineTool`；`src/index.ts` 的 `ToolsService.register`；`src/contracts.ts` | schema 声明和执行输出需匹配。工具名前缀 `advisory_impact_`；默认返回摘要，不能倾倒 HTML。参考 `packages/core/tools/README.zh.md`、`docs/cookbook/adding-a-tool.zh.md`、`docs/subsystems/tools.zh.md`。 |
| 路径约束（工具接入后续） | `packages/core/tools/src/index.ts` 的 `ToolsService.restrict`、`guard`、`checkGuards` | `restrict` 在非 scoped context 会抛错，必须用 `agent.ctx`；可见性掩码不是路径验证。`guard` 是后置单调拒绝。库层已限制固定 pin 文件名/哈希缓存名，拒绝 `..`、目录/文件符号链接，使用不跟随链接的文件读取与原子替换；工具注册时仍必须添加 restrict/guard。 |
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
