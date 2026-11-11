# DSH 接口依据

核对只读源码 `fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159`（DSH `0.2.2-rc.1`）。以下均为该源码仓库内路径。本包不修改 DSH，最低开发 peers 为 `0.2.1-rc.5`；实际加载和浏览器验收使用 `0.2.2-rc.1`。

| 用途 | 源码 / 符号 | 本包用法 |
| --- | --- | --- |
| Bundle | `docs/user/develop/basic/publish.md`：bundle manifest、profile 和 patch | `dsh.bundle.patch` 插入 `advisory-impact` / `dsh-advisory-impact`，入口 re-export 预编译 `lib/plugin.js`；宿主依赖为 optional peers + 精确 dev dependencies，无安装钩子。 |
| 命令 | `packages/interaction/commands/src/index.ts`：`CommandDefinition`、`CommandInvocation`、`CommandRuntime.register`；`src/brand.ts`：`CommandDefinitionId` | 通过 `ctx.effect` 注册 `/advisory-impact`，消费 rawInput/agent/signal，返回 success/error；没有 locale 假设或模型调用。 |
| 工具 | `packages/core/tools/src/schema.ts`：`defineTool`；`src/contracts.ts`：`ToolRunContext`；`src/index.ts`：`ToolsService.register/restrict/guard` | 六个 `advisory_impact_*` 工具，在 scoped `agent.ctx` 内限制继承入口，再注册调用者绑定版本。guard 拒绝错误调用者和额外路径参数；不影响其他工具。默认摘要最多 20 项，保留 total/truncated，不返回 HTML。 |
| Agent 生命周期 | `packages/core/agent/src/runtime-types.ts`：`Agent.ctx`、`agent/created`、`agent/disposed`；`src/index.ts`：`AgentRegistry.list` | 为已有/新增 agent 安装受约束工具，销毁时 dispose fiber。 |
| 项目目录 | `packages/session/working-directory/src/index.ts`：`WorkingDirectoryService.get`；`docs/cordis-api/context.zh.md`：`ctx.get` | 命令/工具取得有效目录，缺服务时回退 session header cwd。所有本地文件使用固定文件名，拒绝 `..` 和目录/文件 symlink，原子替换写入。 |
| 本地缓存 | `packages/storage/storage-domain/src/index.ts`：`DomainFacility.open`，用于核对平台能力 | 没有 first-class `ctx.cache`。本包选择插件自有目录 `~/.cache/dsh-advisory-impact/{official,osv}`，不调用 storageDomain；保存 URL/响应/抓取时间/源时间，遵循 TTL。当前进程记住最近失败，避免报告在 TTL 内隐藏刚发生的刷新错误；成功抓取后清除错误。 |
| Client 发现 | `packages/client/modules/src/index.ts`：`clientExportOf`、`ClientModuleRegistry.resolveMeta`；`src/client/manifest.ts`：`parseDshClient`、`ClientModuleLoader` | `dsh.client.platform: web`，inject layout/sidebar，真实 `exports["./client"]` 指向 `lib/client.js`。通过宿主 lazy factory 加载，唯一外部 require 是宿主 React。 |
| 原生页面与导航 | `packages/client/ui-layout/src/client/index.ts`：`SlotMap['main']`；`packages/client/ui-sidebar/src/client/contract/slots.ts`：`sidebar.panellist`；`src/client/index.ts`：`syncPanels` | 注册 main key 与 sidebar id `advisory-impact`，入口中文「公告影响」。root 页面无需 Session、Agent、聊天轮次或模型 key。 |
| Slot 生命周期 | `packages/client/ui-renderer/src/client/registry.ts`：`SlotRegistry.inject/register`；`packages/client/ui-slots/src/index.ts`：`SlotCore.register`、`SlotLabel` | 等待 slot owner 再注册贡献，不覆盖 owner；CSS 由 `ctx.effect` 清理。组件不接收 Context。 |
| 本地 HTTP | `packages/host/webserver/src/index.ts`：`WebRoute`、`WebServer.register` | 可选注入 webServer/connection，exact POST `/advisory-impact/api`；JSON 请求上限 64 KiB，严格 action/args 校验，固定目录边界。CLI 无 web 服务仍可用命令。 |
| 浏览器鉴权 | `packages/client/connection/src/rpc-host.ts`：`HostConnectionService.requestRejection/admit`；`src/rpc.ts`：`ConnectionTrustRequest` | 每请求先检查 Host/Origin 与活跃浏览器凭据，401/403 拒绝；浏览器只用相对路径和 same-origin cookie，不读取或打印凭据。没有 Remote API。 |
| 主题 | `packages/client/ui-theme/src/client/index.ts`：主题服务；`src/styles/design-platform.css`：`--dsw-alias-*`；`packages/client/ui-layout/src/client/theme-presenter.ts`：`ThemePresenter` | 背景、文字、边框、阴影与 error/success/warn 语义色均来自 DSH。无插件级主题开关；浏览器烟测改变系统 prefers-color-scheme，让宿主投影明暗主题。 |

`AdvisoryService` 为命令、工具和原生面板共享的零模型管线。`createViewModel` 统一证据与三态，`renderReport` 只消费证据时间，固定输入确定性输出。Suppressions 和 OSV-only 独立，官方不可用是 null，不能当成空清单。默认配置只有关注列表，没有默认运行版本。

原生面板路径：侧栏「公告影响」→ 输入已有本地项目绝对路径 → 保存版本/关注列表 → 强制刷新或按 TTL 使用缓存 → 查看/复制中文 Markdown。修改配置清除旧判定与报告。命令可保存/打开固定 Markdown 文件；`open` 不启动外部浏览器。

参考插件只读借鉴 API 和视觉组织，没有复制业务代码或素材：`dsh-context`（Apache-2.0）的 main/sidebar、主题卡片与层级；`dsh-context-effort`（MIT）的 slots 与宿主 React 工厂；`dsh-media-desk`（MIT）的逐请求鉴权和本地路由。未修改参考克隆或已安装副本。

## 验证边界

离线测试使用录制 HTTP 和故障注入，包含真实 Cordis 注册器、客户端 bundle 工厂、React 交互、路径约束和鉴权路由合同；不联网、不调用模型。

最终在独立 DSH_HOME、临时 Web profile 及本地 overlay 启动已安装 CLI，真实侧栏/客户端发现/浏览器鉴权/版本编辑/三态/报告/明暗主题和缓存失败回退均已通过。没有模型 key 或聊天轮次。命令烟测通过真实 `CommandRuntime.list/execute`，配置 idle agent 依据 `packages/core/agent-loop/src/index.ts` 的 `AgentLoop.Config`（agents/id/sessionId/cwd），不启动模型步骤。

截图为历史夹具回放；Kafka 受控子集仅演练 OSV-only，不声称是完整或实时清单。独立实时烟测串行读取六个官方端点及单条 OSV GET，报告逐条保留实际链接与抓取时间。证据在仓库外 `/workspace/dev/advisory-impact-shots/task06/`；README 仅附经检查的真实 DSH 截图。没有 Electron 桌面安装实测。
