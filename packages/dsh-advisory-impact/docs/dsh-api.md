# DSH 接口核对与后续接入位置

核对源码：`/workspace/dev/deepseek-harness`，提交 `fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159`（`0.2.2-rc.1`）。以下路径相对于该源码根目录；本包不修改 DSH。

| 用途 | 源码 / 文档与符号 | 结论 |
| --- | --- | --- |
| 安装 bundle | `docs/user/develop/basic/publish.md`、`publish.zh.md`，bundle manifest / patch 示例 | `dsh.bundle.patch` 指向 YAML 插入层，行通过包名加载 `index.js`。宿主库用 peer + dev dependency。 |
| 插件入口和配置 | 上述 publish 文档；`packages/storage/storage-domain/src/index.ts` 的 `name` / `inject` / `Config` / `apply`；兄弟包 `dsh-heartbeat-monitor/src/plugin.ts` | 命名导出，`apply(ctx)` 中注册服务贡献，由 Cordis effect 清理。当前只需要 `commands`。 |
| 命令 | `packages/interaction/commands/src/index.ts` 的 `CommandDefinition`、`CommandInvocation`、`CommandRuntime.register`；`src/brand.ts` 的 `CommandDefinitionId`；`src/types.ts` 的 `CommandResult` | 注册不带 `/` 的名称；handler 返回 success/error。注册返回 disposer；命令执行自身不调模型。当前调用 `ctx.effect(() => ctx.commands.register(...))`。 |
| 工具（后续） | `packages/core/tools/src/schema.ts` 的 `defineTool`；`src/index.ts` 的 `ToolsService.register`；`src/contracts.ts` | schema 声明和执行输出需匹配。工具名前缀 `advisory_impact_`；默认返回摘要，不能倾倒 HTML。参考 `packages/core/tools/README.zh.md`、`docs/cookbook/adding-a-tool.zh.md`、`docs/subsystems/tools.zh.md`。 |
| 路径约束（后续） | `packages/core/tools/src/index.ts` 的 `ToolsService.restrict`、`guard`、`checkGuards` | `restrict` 在非 scoped context 会抛错，必须用 `agent.ctx`；可见性掩码不是路径验证。`guard` 是后置单调拒绝，仍须对路径与真实路径做边界验证。当前无项目目录写操作。 |
| 持久化（后续） | `packages/storage/storage-domain/src/index.ts` 的 `DomainFacility.open`、Context `storageDomain`；`src/spec.ts` 的 `defineDomain`；`src/domain.ts` 的 `Domain.close` | 采用 storageDomain 或插件自有缓存目录；调用者负责 close。原始响应、URL、抓取时间和源时间都需存储，TTL/失败回退留给后续任务。 |
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
