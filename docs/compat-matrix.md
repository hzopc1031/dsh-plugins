# DSH 插件兼容矩阵

目标运行时为 **DSH 0.2.2-rc.1**。源码依据是只读官方 tag `dsh-v0.2.2-rc.1` / `66491b05e3f05ad35bcdd4f6cd7ed26041d9e3db`，不是开发树 HEAD。2026-11-11 在 Linux / Node 24.22.1、已安装 CLI 0.2.2-rc.1、临时 DSH_HOME 的 Web profile 中插入本 worktree 全部 17 个预编译入口；17 个宿主 fiber 均 ACTIVE，没有兼容拒绝。此表的“是”表示该次实际加载及所列验证，不表示 Windows Desktop 功能验收。

npm registry 可用的发行版包含 `@deepseek-ai/dsh@0.2.1-rc.5` 与 `0.2.2-rc.1`（registry 的 latest）；本次 CLI 只实际加载 **0.2.2-rc.1**，未启动 rc.5 CLI 或 Desktop；原有单元/集成测试沿用精确 rc.5 开发依赖，不等同整套 rc.5 宿主验收。合并后范围上界统一采用 main 的 `<0.3.0-0`，排除 0.3.0 预发布版本，不是对尚未核对版本的实测承诺。

| 插件 | 声明最低 DSH（均 `<0.3.0-0`） | Node | Windows / Electron 说明 | 0.2.2-rc.1 已验证 |
| --- | --- | --- | --- | --- |
| dsh-task-review | 0.2.1-rc.5 | ≥22 | 本地归档；本次未实测 Windows 路径与进程 | 是：实际加载、离线测试；移除 BOM |
| dsh-heartbeat-monitor | 0.2.1-rc.5 | ≥22 | 依赖宿主工具/进程事件；未实测桌面通知 | 是：实际加载、离线测试；移除脚本 BOM |
| dsh-plugin-combo-lab | 0.2.1-rc.5 | ≥22 | 槽位及远程调用；未实测 Electron UI | 是：实际加载、离线测试 |
| dsh-source-impact | 0.2.1-rc.5 | ≥22 | 本地引用追踪与输入动作；未实测 Electron | 是：实际加载、离线测试 |
| dsh-permission-doctor | 0.2.1-rc.5 | ≥22 | 只读审批/策略证据；未实测 Windows 权限 | 是：实际加载、离线测试 |
| dsh-instruction-conflicts | 0.2.1-rc.5 | ≥22 | 规则文件读取；未实测 Windows | 是：实际加载、命令注册、离线测试；修复精确版本锁与 JSON/脚本 BOM |
| dsh-draft-rescue | 0.2.1-rc.5 | ≥22 | 内部草稿结构；按实际输入能力与严格存储结构校验；未知版本标签不单独拒绝 | 是：实际加载、版本/引用块与 browser factory 测试；未实测系统剪贴板 |
| dsh-file-ref-copy | 0.2.1-rc.5 | ≥22 | 完成回答的 legacy Markdown 与剪贴板；没有客户端版本锁 | 是：实际加载、路径/客户端离线测试；未实测系统剪贴板 |
| dsh-snip-attach | 0.2.1-rc.5 | ≥22 | 仅 Windows；保留 `dsh-app://app` 与会话、附件、命令接口能力检查 | 是：Linux 加载、明确不支持、版本/附件注入/服务器测试；未实测 Windows 截图 |
| dsh-file-holder | 0.2.1-rc.5 | ≥22 | 仅 Windows；Linux 返回「暂不支持（仅 Windows）」 | 是：实际加载、平台拒绝/离线测试 |
| dsh-dll-doctor | 0.2.1-rc.5 | ≥22 | 仅 Windows；Linux 返回「暂不支持（仅 Windows）」 | 是：实际加载、平台拒绝/离线测试 |
| dsh-github-triage | 0.2.1-rc.5 | ≥22 | 沿用宿主 fetch；插件代理/CA 可覆盖；未实测 Windows gh 凭据链 | 是：实际加载、只读 API/本地 TLS 代理测试；未调用真实模型 |
| dsh-invoice-gate | 0.2.1-rc.5 | ≥22 | 本地票据 I/O 与拒绝不安全路径；未实测 Windows | 是：实际加载、离线测试 |
| dsh-html-deck-export | 0.2.1-rc.5 | ≥22 | 需本机 Chrome；本地 HTML 捕获，不新增外网抓取 | 是：实际加载、离线测试；未实测 Windows Chrome |
| dsh-content-evidence | 0.2.1-rc.5 | ≥22 | main/sidebar 槽位；Windows 导出仍安全拒绝 | 是：实际加载、离线测试；保留原声明范围 |
| dsh-advisory-impact | 0.2.1-rc.5 | ≥22 | main/sidebar 与浏览器鉴权；公司网络配置见内网说明 | 是：实际加载、离线缓存/快照/代理测试；保留原声明范围 |
| dsh-apache-radar | **0.2.2-rc.1** | ≥22 | MarkdownText.omitHtml、connection.fetch；公司网络见内网说明 | 是：实际加载、Web 故障/诊断/导入截图、离线与代理测试 |

2026-11-12 合并说明：上表加载与界面记录属于分支此前的验证；本次保留 main 的 GitHub 哨兵 0.4.0 页面、POST 路由和草稿/截图能力检查，再整合内网功能。本次自动测试结果单独记录，不将历史加载视作合并版本的实机验收。

## 修复内容与可重复检查

原先精确 pin `engines.dsh: "0.2.1-rc.5"` 的七个包（DLL、草稿、占用、文件引用、截图、GitHub、指令冲突）会被 rc.1 拒绝；现放宽声明和 optional peers，保留精确开发依赖。`instruction-conflicts` 的 package.json / locale BOM 还会导致直接 `JSON.parse` 失败；清单、locale、源码、脚本与配置的开头 BOM 已移除，不改变正文语义；票据包的 CSV 编码夹具保留其原有 BOM。

合并保留 main 的能力检查（不再精确比较版本号）。草稿额外核对 rc.1 的 `quotes`：校验引用块投影及与 references 的不重叠范围；追加前按宿主能力通过 `persistDraft()` 核对当前输入快照，以引用块一字符坐标计算文末，快照不一致则中文提示复制后粘贴，不覆盖现有输入。截图仍检查桌面 origin 与接口能力，不把普通 Web 或未知版本标签当成桌面功能已验证。

实际对照 rc.5 tag 后确认 main/sidebar.panellist 与 connection.fetch 已存在，因此公告与内容证据保留原先 rc.5 起的声明范围，不能将它们说成 rc.1 新增 API；本次没有实际加载 rc.5。雷达使用的 MarkdownText.omitHtml 在 rc.5 缺失，继续保留已有 rc.1 最低要求。三联网插件的诊断与离线方式见[公司内网访问](intranet-network.md)。

安装每个包的开发依赖后，在根运行 `node scripts/check-compat.mjs`，使用现有 semver，逐一检查 rc.1 准入、51 个 package/locale JSON 的原始解析，以及三份 vendored HTTP helper 同步。各包 `npm test` 不使用实时公网数据；新网络测试只启动进程内 HTTP CONNECT 代理和自签名 HTTPS 源站。实时 chooser GET 单独运行，不属于 npm test。

## API 核对位置

以下路径均相对上述官方 tag 根；可按符号查找，不能用其他开发树替代。

| API / 结论 | 官方源码路径与符号 |
| --- | --- |
| 版本来源、engines 优先、预发布 semver | `packages/boot/app-boot/src/plugin-compatibility.ts`: `getDshRuntimeVersion`, `evaluatePluginCompatibility`, `satisfies`（`includePrerelease: true`）；`src/compatibility-preflight.ts`: `JSON.parse(readFileSync(..., 'utf8'))` |
| 命令 | `packages/interaction/commands/src/index.ts`: `CommandRuntime.register/list/execute`；`src/brand.ts`: `CommandDefinitionId` |
| 工具/事件/agent | `packages/core/tools/src/index.ts`: `defineTool`、guard/restrict；`packages/core/agent/src/index.ts`: `AgentRegistry.list/create`；`packages/core/agent/src/runtime-types.ts`: Agent 事件合同 |
| 权限与回顾 | `packages/interaction/user-approval/src/index.ts`、`packages/sandbox/sandbox-policy/src/index.ts`、`packages/interaction/permission-presets/src/index.ts`；`packages/deliverables/workspace-changes/src/index.ts` |
| 会话查询与指令组装 | `packages/session-query/session-query/src/index.ts`: `observeSession`；`packages/session/session-format-catalog/src/message-projections.ts`: `currentSessionMessageProjections`；`packages/core/system-prompt/src/index.ts`: `system-prompt/assemble` |
| 模型与持久化 | `packages/llm/llm/src/index.ts`: LlmRuntime；`packages/storage/storage-domain/src/index.ts`: `DomainFacility.open`；本次不发起模型请求 |
| 子进程与有效目录 | `packages/subprocess/subprocess/src/index.ts`: `SubprocessRuntime`；`packages/session/working-directory/src/index.ts`: `WorkingDirectoryService.get` |
| main 与 sidebar | `packages/client/ui-layout/src/client/index.ts`: `SlotMap.main`；`packages/client/ui-sidebar/src/client/index.ts`: `syncPanels`、`sidebar.panellist`；rc.5 tag 已有这些槽位，未据此提高最低声明版本 |
| connection.fetch 与鉴权 | `packages/client/connection/src/rpc.ts`: `HostConnectionFetch`；`src/rpc-host.ts`: `HostConnectionService.fetch/requestRejection`；`packages/host/webserver/src/index.ts`: `WebServer.register` |
| MarkdownText | `packages/client/ui-primitives/src/markdown/MarkdownText.tsx`: `MarkdownText`、`omitHtml`（rc.5 尚无该属性） |
| 草稿存储/输入动作/坐标 | `packages/client/ui-conversation/src/client/stores.ts`: `CONVERSATION_STORE_KEY`；`draft.ts`: `snapshotSchema`；`contract/input.ts`: `InputActions.persistDraft/insertText`；`input/editor/projection.ts`: `$composerLayout`、quote 与 reference 均为 atomic chip |
| 截图附件 DOM | `packages/client/ui-conversation/src/client/skeleton/InputBar.tsx`: `data-composer-card`、hidden multiple file input；`packages/client/ui-session/src/client/index.ts`: session 槽位数据 |
| 完成回答 Markdown | `packages/client/ui-conversation/src/client/contract/records.ts` 与 `packages/client/ui-chat/src/client/contract/snapshot.ts`: `ChatSnapshot.legacy`；完成态 node/message 读取保持可用 |
| 代理与 CA | `packages/util/http-proxy/src/install.ts`: `installProxyFromEnvironment`、`applyPolicyEnv`、`proxyRouteFor`；`src/policy.ts`: 环境优先级/绕过；`docs/user/guide/network-proxy.zh.md`: 系统代理/PAC/自定义 CA 限制 |

Node 特性按最低 22 核对：fetch、AbortSignal.any/timeout、Error.cause、fs/promises、ES2023 输出均存在。`O_NOFOLLOW` 等平台标志不作为 Windows 支持证据；位运算在缺少标志时不会提供同等防链接保障。保留既有固定文件名、路径/普通文件校验和拒绝不安全平台的策略，新增快照不接收调用者路径。Windows 路径使用既有平台 path 或明确的浏览器路径转换；没有执行 Linux 上的 Windows 专用工具。没有因本任务放松内容证据的 Windows 导出拒绝，也没有把 Puppeteer 本地渲染扩大到外网爬取。
