# 草稿找回与截图附件：rc.1 功能适配

日期：2026-11-11。工作分支 `fix/rc1-gates`，基线 `cdd34c8aff2e6e5575facc316d7783be411dacb9`。两包从 0.2.1 升为 **0.2.2**。

只读获取官方 `dsh-v0.2.1-rc.5` 与 `dsh-v0.2.2-rc.1` 文件逐项对照，未从主分支推断。没有执行官方脚本。开发依赖仍为 junction 指向的原 rc.5 依赖，只读使用；没有安装依赖、修改用户配置/安装、发布或 commit/push。未读取 `_private` / `_tools`。

## 原门禁位置（基线行号）

- `packages/dsh-draft-rescue/src/core.ts:3,17–19`：SUPPORTED_VERSION/requireVersion 精确版本检查；`:50` 在扫描前调用。
- `packages/dsh-draft-rescue/src/client.tsx:68,79,86`：刷新前获取 localStorage、复制、追加前重复调用。
- `packages/dsh-snip-attach/src/intake.ts:15–18`：requireDesktop 将版本精确等于 rc.5 与桌面 origin 检查合并。
- `packages/dsh-snip-attach/src/client.tsx:66,77,90,114`：渲染禁用判断、截图前、取图后、确认注入前调用。
- 两包对应 `lib/core.js`、`lib/intake.js` 和打包 `lib/client.js` 都含这些检查；已通过 build 重生成。`src` 中不再存在 release/version 比较。package.json 的 engines 和开发依赖版本不是运行时精确门禁。

## 官方源码证据

下表列出读取的文件及两版行号。范围标识是定位信息，链接起点可直接打开。SHA 相同项指 GitHub 返回的文件 blob SHA 完全相同。

| 依赖 | 官方 rc.5 文件及行号 | 官方 rc.1 文件及行号 | 核对结论 |
| --- | --- | --- | --- |
| 存储键、初始值、读取 | [packages/client/ui-conversation/src/client/stores.ts:8-35、43-54](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-conversation/src/client/stores.ts#L8) | [packages/client/ui-conversation/src/client/stores.ts:8-35、43-54](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/packages/client/ui-conversation/src/client/stores.ts#L8) | 完全相同；dsh.conversation + Session ID，draft/view/viewRequest，兼容字符串草稿。 |
| JSON 持久化与会话后缀 | [packages/client/store/src/index.ts:139-166、219-227](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/store/src/index.ts#L139) | [packages/client/store/src/index.ts:139-166、219-227](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/packages/client/store/src/index.ts#L139) | 完全相同；localStorage JSON 整值读写，scopeKey 后缀。插件只调用读取方法。 |
| 持久化外层结构 | [packages/client/ui-conversation/src/client/contract/views.ts:20-29](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-conversation/src/client/contract/views.ts#L20) | [packages/client/ui-conversation/src/client/contract/views.ts:20-29](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/packages/client/ui-conversation/src/client/contract/views.ts#L20) | 完全相同；draft: DraftInput，view: string|null，viewRequest: {view,focus}|null。 |
| 语义草稿解码 | [packages/client/ui-conversation/src/client/draft.ts:5-36、55-69](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-conversation/src/client/draft.ts#L5) | [packages/client/ui-conversation/src/client/draft.ts:6-61、82-97](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/packages/client/ui-conversation/src/client/draft.ts#L6) | rc.1 增加 quotes（非空文本、格式化投影、跨度互不重叠）；旧字符串、references、command 规则保留。 |
| quotes 文本投影 | 不适用 / 未单独对照 | [packages/client/ui-primitives/src/markdown/quote-text.ts:8-9](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/packages/client/ui-primitives/src/markdown/quote-text.ts#L8) | rc.5 无此文件；rc.1 统一 CR/CRLF 到 LF，每行加 > 空格。新增解码遵循该规则。 |
| 输入动作与状态 | [packages/client/ui-conversation/src/client/contract/input.ts:255-277、288-308](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-conversation/src/client/contract/input.ts#L255) | [packages/client/ui-conversation/src/client/contract/input.ts:258-281、295-315](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/packages/client/ui-conversation/src/client/contract/input.ts#L258) | insertText(text, TokenSpan) 返回 boolean；rc.1 新增 insertQuote 与 sending，InputState 仍只暴露引用 occurrences，不暴露 quotes。 |
| 修订防护 | [packages/client/ui-conversation/src/client/input/facade.ts:124-130](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-conversation/src/client/input/facade.ts#L124) | [packages/client/ui-conversation/src/client/input/facade.ts:143-149](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/packages/client/ui-conversation/src/client/input/facade.ts#L143) | 两版在 insertText 前检查冻结状态、disposed 和 draftRev，再调用 insertAsyncText；未绕过宿主编辑接口。 |
| 坐标与原子引用块 | [packages/client/ui-conversation/src/client/input/editor/projection.ts:1-8](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-conversation/src/client/input/editor/projection.ts#L1) | [packages/client/ui-conversation/src/client/input/editor/projection.ts:1-8、80-98、203-225](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/packages/client/ui-conversation/src/client/input/editor/projection.ts#L1) | 两版引用胶囊均计一个 detect 字符；rc.1 的 QuoteNode 也计一个，但不进入 occurrences。 |
| 越界拒绝 | [packages/client/ui-conversation/src/client/input/editor/span-map.ts:69-78](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-conversation/src/client/input/editor/span-map.ts#L69) | [packages/client/ui-conversation/src/client/input/editor/span-map.ts:69-78](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/packages/client/ui-conversation/src/client/input/editor/span-map.ts#L69) | 文件完全相同；span 超过 detectLength 时返回 null，编辑返回 false，先校验后修改。 |
| UI 槽位与输入注入契约 | [packages/client/ui-conversation/src/client/contract/slots.ts:229-234、278-283、332-339](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-conversation/src/client/contract/slots.ts#L229) | [packages/client/ui-conversation/src/client/contract/slots.ts:247-252、311-316、385-392](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/packages/client/ui-conversation/src/client/contract/slots.ts#L247) | header.actions 和 input.left 仍为 session list；useInput、inputActions 的标准注入保持。 |
| 输入源装配与文件 intake | [packages/client/ui-conversation/src/client/apply.ts:313-334、488-533](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-conversation/src/client/apply.ts#L313) | [packages/client/ui-conversation/src/client/apply.ts:316-334、476-545](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/packages/client/ui-conversation/src/client/apply.ts#L316) | 标准 session 输入源仍存在；私有 addFiles 在 rc.1 调用 createDrafts(sessionId, uploads, ordinary)，增加是否立即上传图片参数。 |
| composer DOM 与 intake | [packages/client/ui-conversation/src/client/skeleton/InputBar.tsx:205-248、395-469](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-conversation/src/client/skeleton/InputBar.tsx#L205) | [packages/client/ui-conversation/src/client/skeleton/InputBar.tsx:240-283、439-514](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/packages/client/ui-conversation/src/client/skeleton/InputBar.tsx#L240) | data-composer-card 内隐藏 multiple file input 与 change 路径保留；rc.1 普通 Session 不再套子代理图片大小/数量本地限制，交由上传准入。 |
| 附件描述与上传状态 | [packages/client/ui-conversation/src/client/contract/slots.ts:28-62](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-conversation/src/client/contract/slots.ts#L28) | [packages/client/ui-conversation/src/client/contract/slots.ts:28-67](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/packages/client/ui-conversation/src/client/contract/slots.ts#L28) | 浏览器附件依旧按 ID 排序；rc.1 普通 Session 图片立即上传，ready 收据与 error 状态独立于 attachmentIds。 |
| 附件服务 | [packages/client/ui-conversation/src/client/service.ts:37-72、290-325](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-conversation/src/client/service.ts#L37) | [packages/client/ui-conversation/src/client/service.ts:37-72、318-347、377-434](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/packages/client/ui-conversation/src/client/service.ts#L37) | 公共 IConversation 没有 File -> accepted ID API；rc.1 createDrafts 第三个参数控制图片上传，不调用该私有方法，继续委托隐藏 input。 |
| Session hook 与投影注入 | [packages/client/ui-session/src/client/index.ts:154-183、261-279](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-session/src/client/index.ts#L154) | [packages/client/ui-session/src/client/index.ts:154-183、265-279](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/packages/client/ui-session/src/client/index.ts#L154) | useSessions/useSession/sessionId/useProjection 仍在；projection hook 来自当前 session.projections。 |
| 会话列表数据 | [packages/api/session-controller/src/client/sessions/service.ts:27-65](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/api/session-controller/src/client/sessions/service.ts#L27) | [packages/api/session-controller/src/client/sessions/service.ts:27-69](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/packages/api/session-controller/src/client/sessions/service.ts#L27) | title 为持久标题，cwd 可选，byId 索引仍在；displayTitle 含回退语义，继续不用。 |
| 当前会话状态 | [packages/api/session-controller/src/client/contract/snapshot.ts:69-81](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/api/session-controller/src/client/contract/snapshot.ts#L69) | [packages/api/session-controller/src/client/contract/snapshot.ts:69-81](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/packages/api/session-controller/src/client/contract/snapshot.ts#L69) | removed:boolean 和 subagent:对象|null 保留，截图拒绝 removed 和非 null subagent。 |
| 远程装配 | [packages/api/remotes/src/client/index.ts:8、188-198](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/api/remotes/src/client/index.ts#L8) | [packages/api/remotes/src/client/index.ts:8、188-199](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/packages/api/remotes/src/client/index.ts#L8) | commandsRemote import 及插件装配保留；rc.1 增加 tool-results remote，不影响 commands 命名空间。 |
| 命令注册和执行 | [packages/interaction/commands/src/index.ts:285-292、361-368](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/interaction/commands/src/index.ts#L285) | [packages/interaction/commands/src/index.ts:285-292、361-368](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/packages/interaction/commands/src/index.ts#L285) | 文件完全相同；register(definition)，execute(agent,line,submittedAttachments,signal)，仍返回 CommandExecution|undefined。 |
| 命令结果与品牌 ID | [packages/interaction/commands/src/types.ts:20-72](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/interaction/commands/src/types.ts#L20) | [packages/interaction/commands/src/types.ts:20-72](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/packages/interaction/commands/src/types.ts#L20) | 文件完全相同；结果 kind/text、CommandExecution.result 保留；brand.ts:15-24 也完全相同。 |
| 客户端远程调用示例 | [packages/client/ui-commands/src/client/service.ts:418-433](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-commands/src/client/service.ts#L418) | [packages/client/ui-commands/src/client/service.ts:418-433](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/packages/client/ui-commands/src/client/service.ts#L418) | 文件完全相同；execute(session.sessionId,line,attachments)，先检验 result.ok，再读 result.value?.result。 |
| slot 注册器 | [packages/client/ui-slots/src/index.ts:1-8](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-slots/src/index.ts#L1) | [packages/client/ui-slots/src/index.ts:1-8](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/packages/client/ui-slots/src/index.ts#L1) | index.ts、renderer.ts、store.ts 三个文件完全相同；inject/register 机制未变。 |
| Modal | [packages/client/ui-primitives/src/Modal.tsx:29-49](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-primitives/src/Modal.tsx#L29) | [packages/client/ui-primitives/src/Modal.tsx:29-49](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/packages/client/ui-primitives/src/Modal.tsx#L29) | 文件完全相同，body portal 保留；符合 rc.1 标题区域裁剪要求。 |
| 桌面 origin | [apps/desktop/src/ipc.ts:101-114](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/apps/desktop/src/ipc.ts#L101) | [apps/desktop/src/ipc.ts:101-114](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/apps/desktop/src/ipc.ts#L101) | SCHEME=dsh-app 保留；main.ts rc.1:473 构建 dsh-app://app/，820 校验相同 Origin。 |

用于复核的关键 Git blob SHA：

| 文件 | rc.5 | rc.1 |
| --- | --- | --- |
| packages/client/ui-conversation/src/client/stores.ts | `34e4261a264e43793a270d9aaad57dce7312cdd6` | `34e4261a264e43793a270d9aaad57dce7312cdd6` |
| packages/client/ui-conversation/src/client/draft.ts | `cc1c814f43b8d18ae8eeb42452438c46a7062075` | `e4cee855b2c7d9d9493200102b7c5f1d1a0d7322` |
| packages/client/ui-conversation/src/client/skeleton/InputBar.tsx | `ef95796577c6f53c0280a3e8c39c4a8eb10ec5eb` | `892a41022331f529188cbbed9221b89d7f6d62ad` |
| packages/client/ui-conversation/src/client/service.ts | `fc76701be68a059767de0a41cbdd39e2ad2add0d` | `af19eb7721bba847ea06ed570a1b2a2cb45bb1d0` |
| packages/interaction/commands/src/index.ts | `5464704516df8d228541aea331ce08bb8b0001cd` | `5464704516df8d228541aea331ce08bb8b0001cd` |
| packages/client/ui-slots/src/index.ts | `85c7d676cccc53c0958182eea8f98dd2bae9042a` | `85c7d676cccc53c0958182eea8f98dd2bae9042a` |

## 适配行为与安全拒绝

采用实际能力检测，不增加 semver 运行时依赖。插件管理器继续以 engines.dsh `>=0.2.1-rc.5 <0.3.0-0` 加 includePrerelease 决定版本准入。功能代码不再读取 __DSH_BOOT__ 或比较 release 字符串：未知/缺失版本标签，只要接口和数据结构完全符合已识别约定就可操作；未知接口或格式拒绝。此策略不代表未知版本已完成验证。

草稿：

- 扫描前验证 useInput、insertText、draft/draftRev/phase/occurrences；注册前检查 slots.inject/register。扫描器检查 StorageReader 的 length/key/getItem，只读取当前源下 dsh.conversation.<非空 Session ID>。
- 验证外层 draft/view/viewRequest，字符串草稿或 text/references/command/quotes。对外层及语义字段采用白名单，引用文字与跨度必须匹配，quotes 使用官方换行和 Markdown 投影规则，所有原子跨度互不重叠且位于命令 token 后。仅恢复 text，不重建语义节点或附件。
- 匹配前缀的任一记录 JSON 损坏、类型错误、未知字段/格式会让整次扫描抛出清晰错误，不返回已扫描的部分结果；空串/纯空白不展示，扫描中已删除的 null 记录跳过。插件不写、删除、迁移或修复原存储。格式验证必然需要读取候选原始 JSON，但验证前不会把内容作为草稿返回/显示/追加。
- 追加只在 plain，重新校验实时输入，使用 draftRev 和折叠文末 span；宿主 insertText 保留修订、冻结与坐标边界校验。
- **rc.1 目标输入框已有原子 quote 时保守拒绝追加。** quotes 不在公共 InputState，插件不调用私有 Lexical。缺少 quote 折叠会使计算末尾大于实际 detectLength，宿主在修改前返回 false；显示“含无法定位的引用块…请复制原文后手动粘贴”。不重试其他坐标、不替换现有内容。源草稿中的 quote 可以正常预览、复制，或以纯文字追加到无原子 quote 的输入框。

截图：

- 保留 dsh-app://app origin、removed/subagent/plain 检查；验证 useInput/useSession、Session ID、attachmentIds 字符串数组、remote.commands.execute。Host 在启动本机服务前检查 commands.register；Client 注册前检查 slots 方法和 remote 方法。
- 沿用 execute(sessionId, '/screenshot', [])，验证 RPC ok -> value.result.kind/text；错误、不可用、无效 URL 或 MIME 均停止流程。复用已有会话注入和 dsh-api-remotes 装配，无需改 manifest 注入清单。
- 保留本 composer 唯一隐藏 input/change 入口。截图前、取图后及确认时验证 picker，确认时重新检查原按钮所属 composer，防止预览期间 picker 被替换或变得不唯一。不会调用 rc.1 签名已变的私有 createDrafts。
- rc.1 普通会话图片确认加入后会立即上传到 Host，发送消息仍需用户另行操作；用户需在点“确认加入”前知晓。新增 ID 只是 intake 线索，不能证明属于截图，也不能证明上传成功；维持“已提交截图，请核对待发送图片”，上传/数量/大小拒绝由宿主处理，没有变化或 DOM 失败则给 Ctrl+V 回退。没有自动提交消息。

## 验证与剩余风险

- 两包各运行 npm run build、npm run typecheck、npm test、npm run verify-pack；草稿 **29/29**、截图 **50/50**，零失败/零跳过。verify-pack 保持精确白名单（草稿 17 个文件，截图 22 个文件），断言版本 0.2.2。
- node scripts/verify-engines.cjs 检查两包 0.2.2、自身 lock 元数据、rc.5/rc.1 准入、未来 0.2.x 及 0.3 边界；未对其他包重做功能测试。
- 测试运行实际预构建 browser factory；覆盖两版标签和未知标签下的有效接口，结构不符的零存储访问/零截图调用、存储损坏整批拒绝与字节不变、rc.1 quotes 投影/重叠、目标 quotes 的宿主拒绝、sending、remote 缺失、picker 变化、延迟 intake/上传失败提示、会话切换。上传失败测试仅模拟公共槽位可见的 ID 与外围状态，未连接真实上传服务。
- 官方源码复核与 rc.5 开发类型编译不等于 rc.1 依赖下的独立编译或 Electron 实机验收。没有向真实 DSH 安装插件，未做真实截图/剪贴板、CORS/本机网络策略、上传收据、Lexical 交互、布局/焦点验证。现有测试只执行 PS1 DryRun，不读取系统剪贴板或启动截图。
- 内部 localStorage 格式和 composer DOM 仍非稳定 API；未来新增字段将安全拒绝，甚至一条坏记录也会阻止本次恢复。目标 quote 追加暂需手动粘贴。未知宿主只能探测可见能力，不能证明相同接口的全部行为；不能将元数据范围理解为逐版本实测。


## README skill 自检

遵循本地 `C:/Users/Mayn/.dsh/skills/dsh-plugin-readme/SKILL.md`；本次只调整两包及根目录中相关内容，原有历史技术记录保留。

- [x] 两包标题后第一句说明用户所得，未先放版本或验证记录。
- [x] 两包各有 3 条以用户收益表达的亮点。
- [x] 差异围绕逐个翻会话、手动贴图和确认核对，不宣称竞品优劣。
- [x] 提供明确标注的示意输出/流程，不冒充实机截图。
- [x] 新增本地链接目标及官方证据路径已核对；既有外链未逐个联网复验，未新增占位素材。
- [x] 快速上手恰好三步，先完全退出桌面 DSH（含托盘），再安装，最后重开使用。
- [x] Git 地址格式、真实包路径、整段引号及 --profile desktop 保持一致。
- [x] 入口、无需额外配置、最小操作和预期结果明确。
- [x] 新增说明使用中文解释接口检查和手动回退，必要命令/键名准确。
- [x] 版本和兼容性放在文末，rc.1 确认后立即上传的提醒也在首次操作旁。
- [x] 开头无测试数量、typecheck、commit hash 或实测断言。
- [x] 区分源码复核、模拟测试、依赖编译和真实桌面验收。
- [x] 名称、locale、包描述和实际入口一致，无凭据和私人资料。
- [x] 所有改动与构建来自本次明确授权，未安装、发布或执行 Git 写操作。
