# 开发状态 · GitHub 哨兵（dsh-github-triage）0.4.2

说明：本轮（表单与 https 地址）原按 0.4.1 开发；rebase 时 main 的 0.4.1 已被内网兼容合并占用，故发布为 **0.4.2**，下文「0.4.1 表单/地址」小节即 0.4.2 内容。

日期：2026-11-12。分支 `fix/triage-form-https`，基线/HEAD `a6d4cea`。本轮仅修改 `packages/dsh-github-triage`，使用已有依赖 junction；未安装依赖、未改 node_modules、未读 `_private` / `_tools`、未改全局配置或用户 DSH、未发布、未 commit/push。下文 0.4.0 内容为此前记录。

## 0.4.1 表单调研与采用依据

实际读取了 `C:/Users/Mayn/.dsh/skills/README.md` 索引及目录清单：没有通用 UI、表单或 DSH 组件设计 skill；公众号排版、图片卡片等 skill 的用途不适合本次表单。读取并遵循权威 `C:/Users/Mayn/.dsh/skills/dsh-plugin-readme/SKILL.md:13` 的“已有好文案保留，只修改任务要求的部分”，也检查了仓库 `.agents/skills` 中同名副本（本仓库只有该 skill）。额外阅读现有 `plugin-creator:update-plugin` 的 source-first 指导，未安装插件或运行参考仓库脚本。

本仓库已打开 `dsh-apache-radar/src/client.tsx:267`（目录输入）、`:494`（flex 换行）、`dsh-advisory-impact/src/client.tsx:645`（报告 textarea）与 `src/panel.css`，以及 `dsh-content-evidence/src/client/index.tsx:60`、`styles.ts:8–13`（标签在上、100% 宽输入、纵向 resize、fieldset min-width:0）。这些可参考但不足以解决官方弹层宽度；最终以官方组件和 dsh-context 设置布局为主。`D:/AIInfra/DSHarness` 已只读核对存在，没有修改或遍历其配置。

已读取 junction 中 `@deepseek-ai/dsh-client-ui-primitives/lib/types/index.d.ts:23,40,64`、`Input.d.ts`、`Modal.d.ts:9–17`、`settings-form/fields.d.ts:10–59`：现成可用 Input、Modal、SettingsValueField，没有导出的 Drawer。仓库表单实际复用宿主共享的 **Modal + Input**；SettingsValueField 要求配置覆盖、继承与重置语义，本表单保留自己的局部 patch 语义，采用其 label / hint / aria-invalid / aria-describedby 做法，不冒充配置字段。

通过 GitHub 连接器实际打开了官方仓库两个 tag 的文件。裁切根因是 [rc.5 Modal.module.css:33–46](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-primitives/src/Modal.module.css#L33) 的默认卡片 `width:min(380px,100%)` 与 `overflow:hidden`，而原内部 `.gt-dialog` 单独设约 720px 宽。[rc.5 添加插件向导:1116–1164](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-plugin-manager/src/client/PluginManagerPage.tsx#L1116) 使用 Modal 的 className / contentClassName / footer 和就近错误；[其 CSS:541–549、900–917](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-plugin-manager/src/client/PluginManagerPage.module.css#L541) 给外层宽高上限、让内容区 min-height:0 后独立滚动，操作区留在外面。本次按该文件同样采用的 **headless Modal + 头部 / 滚动正文 / 底部操作区**（向导 TSX:1340–1414），只调整仓库弹层外框，不重写总页面。

字段按 [rc.1 自动化任务 TaskEditorFields.tsx:167–178](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/packages/client/ui-schedule/src/client/TaskEditorFields.tsx#L167) 的 fieldset、上方 label、官方 Input，以及 [TaskManagerPage.module.css:134–138、1107–1124](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/packages/client/ui-schedule/src/client/TaskManagerPage.module.css#L134) 的网格、min-width:0、100% 宽 textarea 排列；[rc.5 Input.module.css:25–38](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-primitives/src/Input.module.css#L25) 确认输入可收缩及主题变量。[rc.1 SettingsValueField:60–108](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/packages/client/ui-primitives/src/settings-form/fields.tsx#L60) 提供 label、hint 与错误关联的具体做法；另读取 rc.5 GeneralSection.tsx 确认设置内容采用单列。rc.5 / rc.1 Modal.tsx 的公开定制接口一致。

社区参考实际读取 `D:/Ai Infra Tools/DeepSeek Harness/插件开发/_wip/triage-ui/dsh-context-ref/src/client/components/settingsCard.tsx:69–99,128–133`、`clearableInput.tsx:61–87`、`styles/settings.css:1–19`、`styles/base.css:22–25,48–51,90–94`：采用分组间距、标签在上、textarea 垂直伸缩、容器查询与输入 min-width:0；不复制其组件实现。也实际打开 [GitHub deepseek-harness topic](https://github.com/topics/deepseek-harness)，并检索 npm 的 dsh- 与社区 dsh-context；npm 搜索页返回 403、forum.dshtui.com 无法访问，未将搜索摘要当作新的 UI 实现依据。没有找到需要安装才能使用的现成表单插件；可用的官方组件和参考源码已足够。

具体落地：仓库 / 本地代码 / 业务说明 / 定时与上限四组；外框最大 760px、正文独立滚动、底部保存/取消固定；弹层自己的 `gt-repo-form` 容器在 560px 以下改单列。路径字段跨整行，字段/网格/输入都可收缩，完整路径另有 `overflow-wrap:anywhere` 预览及 title。textarea 可纵向拉伸，帮助与错误靠近字段并关联可访问性属性。所有新颜色均使用 `var(--dsw-alias-*)`，延续 gt- 前缀。局部更新、显式清空、删除确认保持。

## 0.4.1 地址与验证

原 `types.ts` 的 repoName 只用正则接受 owner/repo 并转小写；`ui-contract.ts`、`config.ts`、settings 加载及路由已共用该 schema。本轮在这一入口增加 HTTP/HTTPS、www、无协议 github.com、Git SSH，处理首尾空白、.git、尾斜杠、网页子路径、查询和锚点，输出始终是小写 owner/repo。精确主机白名单拒绝子域、仿冒主机、凭据及非法字符；错误使用固定文字，不回显凭据。补齐 GitHub enrich 与纠正命令原先校验后未使用规范值的位置，仅更改地址处理，不改研判算法。

- `npm run build`、`npm run typecheck`：通过；`npm test`：最终 **509/509 通过，0 失败、0 跳过**；预构建产物已更新。
- `npm run verify-pack`：通过，**0.4.1 / 50 文件**精确白名单；版本同步 package.json、lock 顶层/根包、User-Agent、THIRD_PARTY_NOTICES、README 与断言。engines.dsh 保持 `>=0.2.1-rc.5 <0.3.0-0`。`git diff --check` 通过。
- 新增测试覆盖各地址写法和边界、配置/命令/路由、凭据错误不回显、服务端 canonical key 持久化、表单四组、外框宽度/长路径规则/响应式/底部操作区、失焦与提交归一化；原局部更新、清空、并发保留、删除确认回归通过。jsdom 不计算真实几何布局，不等同于视觉验证。
- `npm run ui-smoke`：未通过，独立 Edge 的 **CDP timeout: Page.enable**，尚未进入页面，未生成本轮 `ui-form.png`。脚本已新增打开添加仓库、填写长路径、不提交、核对宽度/换行/底部区域并保存 `ui-form.png` 的步骤，审核者需在沙箱外复跑。
- 本轮 smoke 诊断目录：`C:/Users/Mayn/AppData/Local/Temp/dsh-github-triage-ui-artifacts-PdMtQQ`。脚本报告自建进程树 PID 34280 无法确认停止、临时目录 `C:/Users/Mayn/AppData/Local/Temp/dsh-github-triage-ui-home-T6OZKr` 清理遇 EBUSY；后续 Get-Process 未检出该 PID，CIM 查询被拒。对该 TEMP 子目录的后续删除被自动审批以 “blocked by policy” 拒绝，未绕过。审核者请检查并清理本轮临时目录。
- 未验证：真实宿主表单亮/暗主题、窄容器与长路径的最终截图，Electron 桌面及 rc.1 实机，真实 GitHub/模型请求和定时；没有据此扩大兼容性承诺。

## 0.4.0 历史记录

日期：2026-11-12。工作目录为本 worktree，分支 `feat/triage-ui-v4`，HEAD `cb2a882`。本轮从 0.3.2 重做页面与数据接入，保留分析逻辑、GitHub GET 边界、原命令、存储域及共享串行队列。未安装依赖、未新增依赖、未改 junction/node_modules、未读 `_private` / `_tools`、未改全局 DSH 配置、未安装到用户 profile、未发布、未 commit/push。

## 页面与 dsh-context 对照

只读参考：`../_wip/triage-ui/dsh-context-ref`（实际目录与当前 worktree 同属“插件开发”，非本包内目录），commit `4d8fb8a`，包版本 0.83.1。没有运行参考仓库脚本，也未移植其源码或 CSS。THIRD_PARTY_NOTICES 已列出 Apache-2.0 来源与所研究的做法。

| 参考文件（相对于 dsh-context-ref） | 核实后落地的做法 |
| --- | --- |
| `src/client/insightPage.ts` | 同 ID 的 `sidebar.panellist` list/root 与 `main` keyed/root，侧栏入口 `order:25`，中央完整页面。会话顶部按钮调用 `layout.selectPanel` 打开同一页面，保留工作空间、避免两份操作流程；仅缺少布局能力的宿主回退紧凑 Modal。 |
| `src/host/connection.ts`、`postRoute.ts`；`src/client/route.ts`、`apiRoutes.ts` | `ctx.inject(['connection'], ...)` 能力检测，精确 POST 路由、buffered body、effect 生命周期、`{ok,value,error}` 信封、no-store；浏览器 fetch 与 zod 按动作解码。复用现有 ui-service，没有新端口或会话 agent 依赖。 |
| `src/client/components/overviewPanel.tsx`、`styles/overview.css` | 全高 flex 页面 → 独立滚动区 → 页头与胶囊 → 六项 KPI → 仓库卡片网格 → 结果工具栏、仓库 chip、结果卡片 → 按需规则区。 |
| `src/client/styles/base.css`、`stats.css` | `gt-` 类名前缀、DSH bg/border/label/button/state/shadow 令牌、亮暗主题、color-mix、容器查询、分段控件与可清空搜索、三步空状态。CSS 以 esbuild text loader 注入并随插件卸载移除。 |
| `src/client/components/cardSkeletons.tsx` | 与最终 KPI/仓库卡结构对应的骨架；详情也有占位；错误可重试，运行中显示排队/进行中状态和不确定进度条，不编造百分比。 |
| `src/client/primitives.ts`、`dshFaces.ts` | 安全解析宿主 Icon 导出、缺失时空组件；设置胶囊调用 `pluginNavigation.openBundle('dsh-github-triage')`，缺能力则显示配置指引。 |
| `src/client/index.ts`、`components/settingsCard.tsx` | 本轮选择页面内模型配置指引卡，未覆盖宿主已有配置表单，也未另建 configForms 设置卡。可看 provider/model/modelEnabled 与真实可复制模型 ID。 |
| `docs/host-client-principles.md` | 首次只读摘要（不含完整证据/理由/本地对照正文），展开单项请求 detail；规则点开才读。列表先挂载 30 条、IntersectionObserver 续载，保留手动续载兜底；关闭详情即释放、离开页面停止轮询与观察器，无 localStorage 缓存。 |

UI 源码拆分为 `client.tsx`、`client-forms.tsx`、`client-route.ts`、`client-icons.tsx` 和 `client.css`。保留中文全文；侧栏命名空间用 locale.register/bind 注册（英文环境当前也显示中文名称，未承诺完整英文翻译）。仓库表单按仓库/本地代码/业务规则/定时上限分组，沿用 dirty 字段集合 + changedFields delta；`null` 显式清空，遗漏字段保留服务端最新值。

## 官方接口证据

通过只读 GitHub 连接器按两个固定 tag 读取原始源码，不用 main 推断。rc.5 为 `b830ec950faba0a46dda564be3e2d854afed94f1`，rc.1 为 `66491b05e3f05ad35bcdd4f6cd7ed26041d9e3db`。两个版本的下列 connection 文件 blob 相同：index.ts `d563cd40e83f6048dd993f297650f821f6921d62`，rpc-host.ts `88e7b48baa54df58392b0f1bcec6d4416cb30c7a`，rpc.ts `aec79d07285e43d9bc0659499dbec18cf0940d98`。

| 官方源码位置 | 证据与决定 |
| --- | --- |
| [rc.5 connection/src/index.ts L136–160](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/connection/src/index.ts#L136)、[rc.1 同文件](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/packages/client/connection/src/index.ts#L136) | HostConnectionService 与 `/api` 共享 Fetch bridge 已存在。插件名 `client-connection`（L59）与读取的服务名不是同一概念。 |
| [rc.5 rpc-host.ts L62–118](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/connection/src/rpc-host.ts#L62)、[rc.1 同文件](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/packages/client/connection/src/rpc-host.ts#L62) | Context 合并与 `super(ctx,'connection')`（L92）确认服务名 **connection**；fetch getter/register（L115–118）确认注册方法。采用局部结构类型，不补装 SDK。 |
| [rpc-host.ts L207–250](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/connection/src/rpc-host.ts#L207)、[rc.1 对照](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/packages/client/connection/src/rpc-host.ts#L207) | 按完整 pathname 匹配；L219–222 只允许 owner；L244–249 注册归属调用方 effect，卸载移除。宿主原有 Host/Origin 与认证照常生效。 |
| [rpc.ts L146–175](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/connection/src/rpc.ts#L146)、[rc.1 同文件](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/packages/client/connection/src/rpc.ts#L146) | 精确路由结构包含 path/methods/requestBody/fetch，register 返回卸载函数；`buffered` 可用。 |
| [ui-sidebar index.ts L51–89](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-sidebar/src/client/index.ts#L51)、[contract/slots.ts L44](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-sidebar/src/client/contract/slots.ts#L44) | 宿主按 panellist id/label/order 整理入口，点击交给 layout.selectPanel；插件只贡献图标与元数据。 |
| [ui-layout index.ts L73、L183](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-layout/src/client/index.ts#L73) | main 是 keyed/root，除 conversation 外不带 Session。用相同 id/key 配对即可，不覆盖 root/sidebar。 |
| [ui-plugin-manager index.ts L36–42、L137–146](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-plugin-manager/src/client/index.ts#L137) | pluginNavigation.openBundle 是打开该包设置的真实接口。只加相应 `dsh.client.inject`（sidebar/layout/locale/ui-plugin-manager），无新增 devDependencies 或运行依赖。 |

结论：**rc.5 已支持 POST，无需默认回退 remote.commands**。Host 用可选注入检测 connection.fetch.register，命令环境即使没有 connection 仍可正常加载。主页面只用 POST；保留 `/triage-ui` JSON 命令。仅紧凑会话适配器遇到 HTTP 404/405 才用既有命令 transport；403/网络超时/解码失败不重提，防止重复变更。

路由均为 `/api/dsh-github-triage/` 下的 POST：snapshot、repos、run、correct、rules、models、jobs、detail。以 requestSchema 校验动作和严格字段，并校验动作所属路由，最多 150KB；无效 JSON、字段、服务失败均返回结构化错误。仓库、扫描与纠正仍调用 ui-service；规则导入复用 importDocument，导出复用默认 O_EXCL 的只写新文件逻辑。未修改 pipeline/model/local/rules 的分析实现。

## 功能逐项回归（自动测试）

| 项目 | 结果 / 证据 |
| --- | --- |
| 一级侧栏页面与会话顶部按钮 | 通过。真实 rc.5 renderer 的 main/root、sidebar/list、header/session 同时渲染，顶部导航同 ID；命令执行替身故意拒绝，页面仍靠 POST 加载。另测缺布局的紧凑 Modal。 |
| 仓库添加、删除确认、编辑与所有字段 | 通过。类型、业务/文件、本地路径/ref、规则文件、每天/间隔、两种上限均保留；前后端校验、并发最新字段保留与显式清空。 |
| 模型状态、配置指引、真实 ID | 通过。已配置/禁用/缺失状态、设置入口和可复制模型目录；真实服务商调用未实测。 |
| 增量/全量、since/until/上限、全部分析 | 通过。表单校验、请求形状、防重复、非阻塞入队、进度状态；与命令/定时共享串行队列。 |
| 三档、类型、仓库筛选、搜索/清空/排序 | 通过。KPI 与分段计数不把仅规则预筛算入三档；类型及搜索可叠加，列表排序与筛选后空态。 |
| 展开详情、证据与 GitHub 外链 | 通过。详情按需读取及释放，包含 businessReason、本地对照、PR 测试与规则证据；外链仅固定 https GitHub 条目 URL，noopener/noreferrer，拒绝危险协议与注入。 |
| 纠正结论形成规则 | 通过。三档与必填理由，请求等价 triage-fix；现有 pipeline 测试验证报告更新、规则、历史纠正优先。 |
| 规则查看、复制、导出/导入 | 通过。按需读取；剪贴板动作替身、新文件绝不覆盖、同仓库首行和 UTF-8 字节上限、错误不保存。 |
| 骨架、三步空态、错误重试、运行中 | 通过。首屏骨架、无仓库指引、失败重试、运行按钮禁用与 progress；定时器/观察器/样式卸载清理。 |
| `/triage`、`/triage-repo`、`/triage-fix`、`/triage-report`、`/triage-models`、`/triage-rules`、`/triage-ui` | 全部通过。原官方临时 profile 测试验证注册、分析、局部配置、报告、纠正、规则、持久化、卸载重载。 |
| POST 信封、校验与错误 | 通过。成功、字段错误、JSON/大小/方法/动作路由不匹配、异常脱敏、解码错误、404/405 专属回退、认证错误和不确定网络失败不重提、注册卸载与缺能力。 |
| GitHub 只读与既有分析逻辑 | 原回归全部通过；本轮仅 User-Agent 版本变化，没有新增 GitHub 写请求或分析算法变化。 |

## 最终验证

环境：Windows / Node.js 24.20.0 / npm 11.19.0。使用用户预先提供的只读依赖 junction，不执行 npm/pip install 或参考仓库脚本。

- `npm --prefix packages/dsh-github-triage run build`：通过，tsc + esbuild（CSS text loader），预构建 lib 已更新。
- `npm --prefix packages/dsh-github-triage run typecheck`：通过。
- `npm --prefix packages/dsh-github-triage test`：**413/413 通过，0 失败、0 跳过**。原 391 项保留并按新交互更新，新增 22 项。jsdom Modal 为明确的 DOM 替身，不能当作真实宿主 Modal 视觉验证。
- `npm --prefix packages/dsh-github-triage run verify-pack`：通过，**0.4.0、50 文件**精确白名单；client CSS 内嵌、8 个新增 JS/d.ts 产物，安装脚本为空、运行依赖仍仅 undici/zod。校验命令自身使用包内 `.tmp/npm-cache`，避免 npm 默认全局缓存写权限失败。
- 版本已同步 package.json / lock 顶层及根包 / User-Agent / THIRD_PARTY_NOTICES / verify-pack；engines.dsh 原值 `>=0.2.1-rc.5 <0.3.0-0` 未变；根 README 行同步。`git diff --check` 通过。

## 真实 UI smoke 与未验证项

已更新 `scripts/ui-smoke.mjs`：系统 TEMP 下独立 DSH_HOME/web profile，使用现有桌面 rc.5 CLI **离线、本地路径、ignore-scripts** 安装，只启动独立无头 Edge；检查侧栏入口、无活动 agent 的中央页面、六 KPI、仓库与结果区、模型指引，再检查会话快捷导航。加入带诊断噪声的版本行提取、失败时自建进程停止诊断与句柄释放；三个离线脚本契约测试通过。

本机实际执行：CLI 为 0.2.1-rc.5，TEMP profile 本地安装与 web 启动完成，日志宣布 loopback `127.0.0.1:52060`。随后 **CDP `Page.enable` 超时**，尚未进入页面 DOM/截图检查，不能声称真实 UI 通过。退出清理初次报 EBUSY；对本次工具会话发出中断后再核对，该监听端口已停止。TEMP 根目录仍存在，进一步单独清理也被自动审批策略以 `blocked by policy` 拒绝，没有继续绕过。

- 诊断：`C:\Users\Mayn\AppData\Local\Temp\dsh-github-triage-ui-artifacts-Rk5NPu`（version/install-local/host 脱敏日志；未生成成功页面截图）。
- 待沙箱外清理的本次测试目录：`C:\Users\Mayn\AppData\Local\Temp\dsh-github-triage-ui-home-Y0OJwF`。不属于用户 desktop profile 或 D:\AIInfra\DSHarness。
- 未验证：真实 Electron/浏览器亮暗主题与响应式视觉、宿主 Modal 焦点/滚动行为、rc.1 实际运行、真实 GitHub/模型端到端、长期定时与大数据量内存表现。rc.1 只核验上述源码，自动测试不能替代这些实测。
- 沙箱外复核：在包目录运行 `npm run ui-smoke`，再用自己的真实仓库/小上限手工检查亮暗主题、窄窗口、编辑/纠正与规则；不要将本轮 413 项自动通过解释为已做这些实测。

## README skill 自检（本轮）

按 `C:\Users\Mayn\.dsh\skills\dsh-plugin-readme\SKILL.md` 权威版本逐项核对：

- [x] 标题后一句话说明用户收益，未先讲实现。
- [x] 四条各不重复亮点，以管理、业务判断、筛选和规则复用为收益。
- [x] 与逐条翻 GitHub 的差异有功能依据，无性能或竞品优越性宣传。
- [x] 亮点后提供明确标注虚构内容的示意输入/输出，无冒充实机截图。
- [x] 本地链接目标存在；未加入失效图片、锚点或截图占位；官方链接固定版本，来源链接对应已读取项目。
- [x] 快速上手恰好三步，包含完全退出桌面与托盘、安装、重开配置使用。
- [x] Git 安装地址严格为带引号的 `github:hzopc1031/dsh-plugins#main&path:/packages/dsh-github-triage`。
- [x] 首次入口改为侧栏页面，provider/model/modelEnabled、最小分析、预期结果清楚；desktop profile 沿用已核实 CLI。
- [x] 业务语言解释问题/待合并改动，必要命令与正式键名保持准确。
- [x] 版本、限制、机制与验证范围放文末；发送代码给模型的必要提醒保留在首次操作处。
- [x] 开头没有测试数、typecheck、commit 或验收日志。
- [x] 区分声明兼容、源码核对、自动测试与真实界面验证，不扩大承诺。
- [x] 名称/入口/描述一致，示例无账号凭据与私人信息。
- [x] 文档修改均在授权范围；实现与隔离 smoke 另有本次任务书授权，未向用户 DSH 安装、发布或执行 Git 写操作。

## 历史记录 · 0.3.1

日期：2026-11-11。本次基于 origin/main `8df6a00`，在 `feat/github-triage` 更新中文名称与版本。会话入口、弹窗、插件设置、命令描述、报告标题、README 和测试断言同步；包名、命令名和功能逻辑不变。系统提示改用中性的“只读 GitHub 仓库分析员”。

## 0.3.1 验证与 README 自检

`npm run typecheck` 通过。从包目录执行 `npm test` 在构建写入 lib 时遇 EPERM；从 worktree 根目录执行 `npm --prefix packages/dsh-github-triage test` 成功，内含 `npm run build`，lib 由构建重新生成，391/391 测试通过，0 失败、0 跳过。`npm --prefix packages/dsh-github-triage run verify-pack` 通过：0.3.1、42 文件白名单。未安装依赖，也未运行真实 UI smoke、安装到用户 DSH 或发布。

旧名称检索仅命中 CHANGELOG 的 0.3.0 历史条目；旧更新记录未修改。`git diff --check` 通过。

按 `C:\Users\Mayn\.dsh\skills\dsh-plugin-readme\SKILL.md` 权威版本逐项核对，保留既有收益、示例、三步上手与能力边界，仅同步本次名称和版本。

- [x] 第一屏紧接标题的一句话说明了用户能得到什么，未先讲实现细节。
- [x] 有 3–4 条各不重复的亮点，每条以具体用户收益表达。
- [x] 与同类插件或现有做法的差异清楚，比较有依据且没有夸大。沿用集中查看与逐条翻 GitHub 的比较。
- [x] 亮点后有示例输入与输出，或真实截图/演示；示意内容已标注。使用虚构仓库与条目演示。
- [x] 图片、链接和锚点有效，没有失效素材或未替换的占位符。无图片；本地链接存在，外部链接沿用既有正式仓库及固定官方版本地址。
- [x] 快速上手恰好三步，明确先完全退出桌面 DSH（含托盘）再安装，随后重开使用。
- [x] Git 地址严格采用 `github:hzopc1031/dsh-plugins#main&path:/packages/<pkg>` 格式，已换成真实目录名，整段地址加引号。
- [x] 首次使用入口、必填配置、最小操作及可见结果足够具体，profile 如有要求已核实。desktop、顶部“GitHub 哨兵”、provider/model/modelEnabled 和首次分析步骤明确。
- [x] 术语先用大白话解释，命令和配置键准确，没有空泛宣传语。
- [x] 版本、详细限制、实现机制和测试说明集中在最后；必要操作提醒在步骤旁可见。
- [x] 开头没有测试数、typecheck、未实测、commit hash 或验收日志。
- [x] 所有能力及兼容性承诺都有依据，安装、运行和界面验证的结论没有混淆。未增加兼容性承诺，保留真实界面未验证说明。
- [x] 名称、描述、入口与插件实际情况一致，示例和素材没有凭据或私人信息。
- [x] 只改授权文档，未因写作而执行安装、发布或未授权的 Git 写操作。本任务另明确授权源码、测试、版本与构建产物更新。

## 以下为 0.3.0 开发与验证记录（入口名称已同步）

日期：2026-11-11。仅在指定 worktree（feat/github-triage，任务基线 origin/main 0703303）改动。没有 git add/commit/push、npm 发布、安装到用户 DSH、修改 D:\AIInfra\DSHarness、访问 _private / _tools 或 GitHub 写操作。下方 0.2.0 记录为历史基线，不代表本次验证结果。

## rc.5 UI 能力调研与选择

固定官方标签 **dsh-v0.2.1-rc.5**，提交 **b830ec950faba0a46dda564be3e2d854afed94f1**。已通过 GitHub 只读连接器读取该标签源码（普通 web/raw 与 shell HTTPS 在沙箱内失败，改用连接器；没有用 main 的 API 推断 rc.5）。

- [ui-slots/src/index.ts](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-slots/src/index.ts)：SlotCore、SlotMap、kind/scope、register 的 children 声明及释放；不能自行取个 slot 名称就假定宿主有出口。
- [ui-renderer/src/client/registry.ts](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-renderer/src/client/registry.ts) 与 [client/index.ts](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-renderer/src/client/index.ts)：SlotRegistry、slots.inject、register、installScope 与真实 React 渲染。root 是 single，不应覆盖；整应用叠层应向 shell.overlay 贡献（[ui-layout 声明](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-layout/src/client/index.ts)），不是抢 root。
- [ui-sidebar/src/client/index.ts](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-sidebar/src/client/index.ts) 与 [contract/slots.ts](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-sidebar/src/client/contract/slots.ts)：真实侧栏扩展有 sidebar.panellist / sidebar.panellist.actions / sidebar.footer.action（list/root）。sidebar.settings 是 single，替换它会影响原设置入口。panellist id 对应 main 面板，需要配套布局与导航注册。
- [ui-conversation/src/client/apply.ts](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-conversation/src/client/apply.ts) 与 [contract/slots.ts](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-conversation/src/client/contract/slots.ts)：真实 **conversation.session.header.actions（list/session）**、header.utilities（list/session）、header.views.actions（list/root）、conversation.view、conversation.input.left/right/dock/overlay。当前采用 actions，在已打开会话顶部显示「GitHub 哨兵」按钮。它有会话 ID，可直接调用现成的会话命令 remote；本仓库 draft-rescue 已用相同入口。
- [ui-session/src/client/index.ts](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-session/src/client/index.ts)：会话域标准 props/Hook、session scope 适配，不是任意业务远程方法。
- [ui-settings/src/client/contract/slots.ts](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-settings/src/client/contract/slots.ts)：有 settings.section、settings.plugins.tab、settings.action、settings.general.item；可扩展设置，但本插件需要当前会话的 remote commands，选择顶部面板更直接，模型配置继续用原插件设置的 provider/model/modelEnabled。
- [ui-primitives/src/Modal.tsx](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-primitives/src/Modal.tsx)：真实共享 Modal，open/onClose/title/closeLabel；portal 到 document.body，自带关闭、Escape 和焦点层。使用宿主共享包，不复制实现、不打包私有 React。
- [api/remotes/src/client/index.ts](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/api/remotes/src/client/index.ts) 是已生成 Remote contribution 的显式集合，mount commandsRemote / llmRemote 等；不是动态 ctx.remote.anyName 的通用注册器。[api/gateway/src/index.ts](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/api/gateway/src/index.ts) 依赖 Typert 已登记描述/Remote 元数据做派发。不能随手提供一个服务方法就宣称有浏览器 remote。
- [interaction/commands/src/index.ts](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/interaction/commands/src/index.ts) 的 CommandRuntime.execute 真实标注 @Remote；包内 rc.5 生成类型 typert.remote-client.d.ts 确认为 **ctx.remote.commands.execute(agentId, line, submittedAttachments, signal?) → RemoteResult<CommandExecution | undefined>**。沿用 snip-attach 的调用方式，新增插件自身结构化命令 /triage-ui，requestSchema 严格分发只读查询和本插件配置/纠正/导出，不新增 HTTP 服务或虚构 remote API。模型 ID 目录仍通过已验证的 llm.listProviders/listModels（同 /triage-models）只读返回。
- [client/modules/src/index.ts](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/modules/src/index.ts)：扫描 Loader 行的 dsh.client，读取 exports["./client"]，ClientModuleRegistry.graph/clientPath/fetchBundle 为真实接口。按 snip-attach 的 dsh.client {platform:"web",inject:[ui-conversation,ui-session,api-remotes]} 与 scripts/build-client.mjs 注册 lazy-CJS window.__ModuleLoader__.load({id,factory})。React、jsx-runtime、primitives 外部共享；zod 随 bundle，完整许可写入 THIRD_PARTY_NOTICES。
- 已通读 packages/dsh-draft-rescue 的 client/打包方式与 packages/dsh-snip-attach 的 package/client/build-client。没有使用 dsh-Go 的 API 或把其表单面板想法当作宿主能力。

## 0.3.0 实现

- 中文面板管理仓库、分析类型、业务文字/文件、本地路径/ref、规则文件、每日/间隔定时、普通/全量上限；未配置模型提示及只读 ID 目录。模型路由只展示，不在界面填写凭据。
- 前后端复用 repoSchema、patchSchema、scanSchema/requestSchema；服务端补充实际 Git 根目录与 ref 存在性校验，就地返回字段错误，校验失败不写状态。
- 编辑通过 changedFields 只发送改动字段，null 清除可选项；服务端在原串行队列中 mergeRepo(最新仓库, patch)，不会用旧表单整体替换。/triage-repo add 同名仓库也保留未明确传入的字段；六个旧命令保留，新增 /triage-ui 为界面数据命令。
- 界面 start 立即返回任务状态，实际 run 进入原 serialize 链，与命令/定时共用，按仓库防重复入队；读取快照/状态不排在长分析后。任务跟随插件生命周期，关面板不取消，卸载会取消；任务状态内存保存，报告继续自身存储持久化。
- 三档分组并按优先级排序，issue/PR 筛选、详情、本地证据、业务理由、风险/测试；规则预筛单独明确标注。安全外链仅接受 https://github.com/<owner>/<repo>/(issues|pull)/<number>，新标签页 noopener noreferrer，不渲染输入 HTML。
- 纠正复用 correct；查看规则复用 rulesDocument；导出复用 exportDocument，界面不提供覆盖开关。所有 GitHub/本地代码访问仍只读。
- commands.execute 自带 command/run 与 command/done 会话生命周期。recordInput:false 不重复记原始请求，但返回配置/结果会进入当前会话命令日志；README 已说明专用会话建议。这是选择已有真实 transport 的代价，不声称独立、无日志配置通道。

## 本次验证

本轮由 Liu 在沙箱外完成依赖安装，未再次安装、未增加依赖。Windows / Node.js 24.20.0 / npm 11.19.0。`npm run build`（tsc + esbuild）、`typecheck`、`npm test`、`verify-pack` 均通过；最终 **391/391 测试通过，0 失败、0 跳过**。npm cache 使用包内 `.tmp/npm-cache`。预构建 `lib/` 已更新；package.json files 与 verify-pack 精确白名单共 **42 文件**，包括 client/UI contract/UI service 的 JS 和 d.ts，不含测试、脚本、node_modules、临时文件，无安装脚本。

- 原回归测试继续通过；UI 服务覆盖列表/新增/字段 patch 保留最新其他字段/删除/校验失败不写入/异步触发与防重复/命令和定时共享串行队列/查询结果/纠正/模型状态/导出。
- jsdom 组件加载真实预构建 bundle，覆盖列表、前后端字段错误、只提交变化字段、清除可选值、立即分析状态、三档与 issue/PR 筛选、业务理由、证据、本地对照、安全原链接、纠正与未配模型提示。修正 VM 跨 realm 数组的比较方式，不修改接口行为。
- 真实 rc.5 renderer 通过官方 lazy-CJS factory 加载，验证 list/session 插槽在声明后注册、渲染、打开内容和关闭。测试会话域是有限 adapter（包括 renderArea）；Modal 使用明确标注的 DOM 替身，**不把它称作真实共享 Modal 渲染测试**。官方 primitives 的单文件构建引用了未安装的开发依赖（例如 clsx、simple-icons、shiki），因此不在组件测试中打包整个库，也未补装；生产 bundle 外部共享宿主 primitives，Modal 参数由 tsc 对官方声明核验。
- 官方 rc.5 临时 profile 真实 load/boot/commands/storage/client-modules：覆盖七个命令、client platform/inject/exports 声明、实际 clientPath 与 graph、界面查询和编辑、异步分析/结果/纠正、卸载重载持久化。GitHub 和模型使用替身。
- UI smoke 另有 3 项离线脚本测试：help/退出码、缺失环境拒绝、假 CLI（本仓库测试生成）验证 TEMP 隔离、本地安装参数、环境凭据剔除、日志 URL 脱敏和失败清理；它们不代表真实 DSH/浏览器通过。

完整打包官方 primitives 库做额外单测时，当前未安装的开发依赖为：`@deepseek-ai/dsh-client-store`、`@deepseek-ai/dsh-util-code-language`、`@deepseek-ai/dsh-util-workspace-path`、`clsx`、`diff`、`anser`、`katex`、`shiki`、`@shikijs/langs`、`simple-icons`、`micromark-core-commonmark`、`micromark-util-character`、`micromark-util-classify-character`、`micromark-util-symbol`、`micromark-util-types`、`micromark-factory-space`、`micromark-extension-math`、`micromark-extension-gfm`、`micromark-util-sanitize-uri`、`mdast-util-from-markdown`、`mdast-util-gfm`、`mdast-util-math`。没有自行安装；这些不是当前已通过的本插件 build/jsdom/profile 测试所缺的依赖，也不加入插件生产依赖。真实宿主中的共享 Modal 仍由 UI smoke 验证。

### rc.5 源码与本地类型交叉核对

本轮通过只读 GitHub 连接器重新读取上方每个官方文件。标签 ref 已核对为 b830ec950faba0a46dda564be3e2d854afed94f1；下列路径均相对于包内 node_modules/@deepseek-ai，列出的已安装包版本均为 0.2.1-rc.5。

| 调研项（官方源码链接见上方逐项条目） | 本地声明 / 核对结论 |
| --- | --- |
| ui-slots：SlotCore、SlotMap、children、kind/scope | dsh-client-ui-slots/lib/types/index.d.ts、renderer.d.ts；声明后注册、根 single、session 作用域一致。 |
| ui-renderer：slots.inject/register/installScope | dsh-client-ui-renderer/lib/types/client/registry.d.ts、index.d.ts；与真实 factory 渲染测试一致。 |
| ui-conversation：顶部 action 及其他 slots | dsh-client-ui-conversation/lib/types/client/contract/slots.d.ts；header.actions 是 list/session，header.views.actions 是 list/root；采用接口一致。 |
| ui-session：标准会话 props 与 scope adapter | dsh-client-ui-session/lib/types/client/index.d.ts、ui-slots/lib/types/renderer.d.ts；sessionId 与 renderArea/绑定来源一致。 |
| ui-primitives：共享 Modal | dsh-client-ui-primitives/lib/types/Modal.d.ts、index.d.ts；open/onClose/title/closeLabel、portal 返回与源码一致，真实视觉尚待浏览器。 |
| api-remotes：显式 remote 集合 | dsh-api-remotes/lib/types/client/index.d.ts；包含 commands/remote 的声明合并，与源码挂载 commandsRemote 一致。 |
| commands.execute | dsh-commands/lib/typert.remote-client.d.ts、lib/types/index.d.ts；远端 agentId 为 SessionId，attachments 为 readonly 数组，signal 可选；返回 RemoteResult<CommandExecution 或 undefined>。Host 原方法接收 Agent 并由 Remote 转换；已修正文档遗漏的 undefined。 |
| client-modules：dsh.client 与 client 入口 | dsh-client-modules/lib/types/index.d.ts；graph/clientPath/fetchBundle 一致，临时 profile 已实际扫描本包入口。 |
| sidebar/settings/gateway/ui-layout（未采用的替代入口或底层背景） | 已逐一重新读取上述固定标签源码；本包未安装 dsh-client-ui-sidebar / dsh-client-ui-settings / dsh-api-gateway / dsh-client-ui-layout，不能声称做过这些包的本地类型比对。当前实现不直接依赖这些包，无需为本任务补装；不以其背景说明承诺额外 UI 能力。 |

所采用的 UI 接口无源码/类型差异，未更换插槽或虚构 remote。修正的是测试加载方法、session adapter 和文档对验证范围的描述。

## UI smoke

`scripts/ui-smoke.mjs` 默认使用桌面版自带 `%LOCALAPPDATA%\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd` 与系统 Edge。在**系统 TEMP** 下创建全新 DSH_HOME，以官方 web 模板初始化，由 CLI `plugin --profile web add --offline --ignore-scripts --config.auto-install-peers=false --store-dir <TEMP子目录> <本包绝对路径>` 进行真实本地路径安装。不会再用手工 junction 冒充安装；不下载依赖、不运行安装脚本。脚本默认不会接触 desktop profile、用户 Chrome 或 D:\AIInfra\DSHarness。

在临时 profile 创建一个无提示词的空会话并命名，启动 loopback web，使用独立 Edge user-data-dir 与内置 WebSocket/CDP 选择会话，确认顶部按钮，点击后检查共享 Modal、“仓库列表”、未配模型提示并截图。临时 web 的自动生成认证 URL 仅用于内存中导航，诊断剔除 URL query/hash，不输出凭据。最后关闭自建进程并校验路径位于 TEMP 后删除临时 DSH_HOME 和浏览器目录；截图、result.json 和脱敏日志留在 TEMP/dsh-github-triage-ui-artifacts-*，终端打印路径。退出码：0 通过/help，1 安装/启动/UI 检查失败，2 参数或环境前提不足，3 清理失败。

从包目录在沙箱外运行：

```powershell
node scripts/ui-smoke.mjs
# 或指定现有路径：
node scripts/ui-smoke.mjs --dsh "$env:LOCALAPPDATA\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd" --browser "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
```

**本次真实运行：未通过，退出码 1。** 在 CLI `--version` 阶段即收到 Windows「拒绝访问」，与沙箱对桌面安装目录可执行文件的限制一致；没有执行本地安装、没有启动 web/Edge、没有截图。临时 home 已成功清理。脱敏诊断目录由终端打印（最后一次尝试为 TEMP/dsh-github-triage-ui-artifacts-fbeo5r，version.log 已解码读回「拒绝访问。」）。`node --check`、help 和上述 3 项脚本离线测试通过；不将脚本测试等同于真实 UI 冒烟。沙箱外真实安装与浏览器渲染仍需 Liu 运行确认，未声称在真实桌面 DSH 中看到界面。

未验证：真实桌面 Electron、浏览器中的官方共享 Modal、真实模型请求/质量、长期调度、其他系统/Node 22 实机。历史真实全量 GitHub smoke 的 HTTP 403 限制仍保留在下方。

## README skill 自检（0.3.0）

按 C:\Users\Mayn\.dsh\skills\dsh-plugin-readme\SKILL.md 权威版本核对，本环境将 .agents 设为只读，复制同步被拒绝；进一步逐字核对并忽略 CRLF/LF 与末尾换行后，两份正文完全一致，git diff --no-index 也无差异，无需修改副本。

- [x] 第一屏紧接标题说明打开界面后的用户收益，未先讲实现细节。
- [x] 有四条不重复亮点，以配置、业务判断、结果比较、纠正规则的收益表达。
- [x] 比较集中看业务结论与逐条翻 GitHub，有依据且不宣称竞品优劣。
- [x] 亮点后为明确标注的示意输出，不伪装截图或真实 AI 结果。
- [x] 无空图片或占位符；相对 README/STATUS/LICENSE/NOTICE 路径存在；官方链接固定 rc.5。
- [x] 快速上手恰好三步：完全退出桌面/托盘、使用桌面自带 CLI 安装、重开配置并得到首份结果。
- [x] 安装命令准确使用桌面 runtime 的 dsh.cmd、desktop profile、加引号的 Git main 子目录地址。
- [x] 明确已打开会话顶部「GitHub 哨兵」、provider/model/modelEnabled、添加与首次分析、可见结果。
- [x] 用大白话解释问题与代码改动、三档和本地适用性；命令、字段准确。
- [x] 版本、边界、机制、验证集中在补充说明；模型外发、费用、定时、导出不覆盖放在操作旁。
- [x] 开头无测试数/typecheck/commit/验收日志。
- [x] 最终构建、391 项自动测试与打包已通过；清楚区分 Modal 替身、真实 renderer、临时 profile 与被沙箱阻断的真实 UI smoke，未声称桌面实测。
- [x] 名称、描述、入口同步；示例虚构，无凭据与私人数据。
- [x] 文档与实现修改均在本任务授权范围；没有因 README 执行安装/发布/未授权 Git 写操作。

---

## 以下保留 0.2.0 历史记录

# 开发状态 · dsh-github-triage 0.2.0

日期：2026-11-11。工作目录 `dsh-plugins-wt-github-triage`，分支 `feat/github-triage`，基于 `origin/main bb21204`。版本仍为 0.2.0，尚未发布 npm。源码、文档、构建和测试仅在此 worktree 内进行；没有暂存、提交或推送本 worktree，没有发布 npm、安装到用户 DSH、读取 `_private` / `_tools`、修改 `D:\AIInfra\DSHarness` 或向 GitHub 写入。临时测试仓库按用例执行 git init/add/commit，用后清理；这与对真实本地仓库只读的插件行为分开。

## 固定接口与实现选择

继续遵循官方 [dsh-v0.2.1-rc.5 / b830ec950faba0a46dda564be3e2d854afed94f1](https://github.com/deepseek-ai/deepseek-harness/tree/b830ec950faba0a46dda564be3e2d854afed94f1)。本次再次核对包内安装的 rc.5 类型：

- `@deepseek-ai/dsh-llm/lib/types/index.d.ts`：`stream(GenerateOptions)`、`listProviders()`、`listModels(provider)`；`types.d.ts` 的 provider/model 是独立字段。仍通过 `llm.stream`、无工具、45 秒取消、1800 maxTokens 生成模型结论，严格检查正常 finish。
- `@deepseek-ai/dsh-commands/lib/types/index.d.ts`：`commands.register`，保留 definitionId/name/description/recordInput:false/handler，返回 CommandResult.text。现在共六个命令：triage、triage-repo、triage-report、triage-models、triage-fix、triage-rules。
- storageDomain.open(defineDomain(...)) / global.get/set / close；域名仍 github_triage、宿主域版本仍为 1，内部数据 formatVersion 从 2 升为 3。`ctx.effect` 继续管理原生定时器、卸载和取消；没有虚构 UI、通知或会话任意回调调度接口。
- 已读同仓库 dsh-file-holder/query.ts 与 dsh-dll-doctor/process.ts 的 subprocess 用法。本次本地 Git **选择 Node 官方 `child_process.execFile`**，不依赖或臆造 ctx.subprocess 接口，不增加宿主 peer dependency。`shell:false`、固定 argv、windowsHide、清理 GIT_* 环境、禁止可选锁与 lazy fetch，禁用 hooks/fsmonitor/外部 diff/textconv。
- 外网读取固定提交的官方源码页面本次未成功（缓存未命中）；没有据此猜测新接口。沿用已记录的固定版本接口，并以已安装 rc.5 类型、运行时和真实临时 profile 验证；新增本地能力全部为 Node/Git 接口。

## 本次并入 0.2.0 的内容

### 本地仓库对照

仓库配置支持 localRepoPath / localRef；命令支持 `add --local ... [--ref ...]`、`local owner/repo <路径> [--ref ...]` / `--clear`。命令设置先验证再保存；读取失败的静态配置在报告中提示。要求本地绝对路径、真实目录、Git 仓库根目录、ref 可解析为提交，拒绝 UNC/设备/备用数据流；不向父目录偷偷查找另一个仓库。Git worktree 的 .git 元数据文件会检查指向本地路径。

只读白名单限定命令及参数形状：rev-parse、ls-tree、cat-file、show、log、merge-base、patch-id，代码拒绝其他命令和额外选项。单次默认 5 秒，256KB 输出（blob 正文更小），可取消；取消等待子进程退出再返回，避免 Windows 句柄未关闭。每条最多 3 文件、每文件 3KB 片段，源 blob 超 64KB 跳过，总本地上下文 16KB。读 ref 的已提交对象，不跟随代码符号链接，不读取未提交工作区。

文件路径/函数片段交给模型；历史只查最近 80 条，按 issue 号、标题词、上游提交消息找线索；merge-base 判断提交包含关系，完整简单文本修改可与本地 git log -p 计算真正的 `git patch-id --stable`。重命名、新增、删除、二进制、不完整 patch 跳过 patch-id。缺失对象不 fetch，浅克隆与历史窗口都可能漏掉修复，不能把“未找到”当作“未修复”。本地选择解析后的提交参与缓存指纹。

配置本地对照才额外 GET PR commits 或关联修复 PR；issue 修复搜索最多 5 候选，正文须明确关闭该 issue 且已合入，最多纳入 2 PR，每个最多读 100 commits。未配置时不发额外请求，卡片明确“未配置本地仓库对照”。模型输出 localApplicability（present/already-fixed/not-applicable/unclear）与 localReason；对照未配置/失败时统一保持 unclear。

### 三档结论与缓存

issue / PR 都必填 recommendation（adopt/manual-review/not-recommended）、priority、reason、businessReason、evidence 及本地字段。原 type/exists/worthFixing/verdict/fitsDirection/risk/testing 保留。卡片和简报先建议采纳，再需人工看，再不推荐，组内按模型优先级；简报每组最多列 20 条编号。保留 fenced JSON 容错，缺少新字段则解析失败，不能把旧模型输出当成新结论。

formatVersion:2 以及 0.1.0 状态保留仓库设置、删除标记、lastRun 和人工纠正，清除派生 cache/reports/pending，映射旧人工结论到新字段。缓存指纹另含业务内容、规则内容和模型路由。规则只供证据，业务与本地事实不替代模型独立研判；无模型/失败只预筛、不缓存。新规则或本地提交变化后重新处理，同一条目的用户纠正仍优先采用。

### 全量与增量

修复 scan.full 在 both 模式缺少搜索类型限定导致 HTTP 422：分别以 is:issue / is:pr 独立分页并遵守功能开关与各自上限，按 updated_at 倒序合并后截取总上限，以两类 total_count 之和判断超限提示，增量和关联已合并 PR 搜索已核对保留类型限定，并补充对应 mock fetch 回归测试。

`/triage [owner/repo] --full [--since YYYY-MM-DD] [--until YYYY-MM-DD] [--max N]`：GET GitHub Search，开放与关闭条目均包含，按最后更新时间范围（日期首尾包含）筛选并倒序分页；合计默认 100、最多 500。全局/仓库 fullMax、add --full-max 可配；单次 --max 优先。超限只取最近并提示，不完整搜索结果也提示；不能与 --limit 混用。未实现标签区间，README 明确原因。

定时保持原开放条目最近窗口，跳过已有且指纹未变的结论，不继承手动 full 模式。全量提示请求数/模型费用和限流；仍遵守 GitHub 403/429 冷却。依据 [GitHub Search 官方 API](https://docs.github.com/en/rest/search/search#search-issues-and-pull-requests)，不承诺扫描超过上限的全部历史。

### 仓库级规则

`/triage-fix` 接受三档新值，旧细分值仍可用且同步三档。业务快照和纠正形成 Markdown 文档，保存在自身存储域；`/triage-rules owner/repo` 查看，export 指定路径导出，import 读取编辑后的文档。导入保留编辑后的纠正规则文本；同一条目权威纠正仍需 triage-fix 修改。查看/导出与后续模型都能使用这些规则。

导出仅写显式给定的本地绝对路径，默认 O_EXCL 原子拒绝覆盖；--force 拒绝链接、硬链接、目录和特殊文件，并检查已打开文件身份后才截断。不自动建目录；除宿主自身状态外，这是插件唯一主动写用户本地文件的行为。导入需保留仓库标识首行，UTF-8、16KB；rulesFile 则只读普通本地 Markdown。注入总上限 8KB，外部/内部并用各约 4KB，截断或读取失败有提示，外部文件被截断之外的内容变化也改变指纹。整个模型 prompt 仍上限 48KB。

## 验证结果

Windows / Node.js 24.20.0 / npm 11.19.0，Git 临时仓库真实运行。最终 **345/345 测试通过**，0 失败、0 跳过；typecheck、build、verify-pack 通过，lib 已重建。verify-pack 精确白名单 **36 文件**，包含 local 与 rule-files 的 JS / d.ts，版本及锁文件仍 0.2.0，无安装脚本。npm cache 设为包内 `.tmp/npm-cache`。

覆盖本地文件存在/不存在、修复提交、上游提交包含、不同 SHA 的同 patch-id、ref 固定与 HEAD 变化、未配置、非法路径/非 Git/父仓库继承、写操作/参数注入拒绝、真实超时/取消/输出上限、片段/总量上限、仓库文件与 Git 元数据逐字节不变。三档解析/无效枚举/排序分组/纠正、旧缓存失效、全量参数/分页/模式/硬上限、规则生成/拒绝覆盖/force/硬链接拒绝/导入编辑/注入/指纹变化均有覆盖。原回归用例继续通过，变更后的 schema、优先级和状态版本断言同步更新。

临时官方 profile 使用真实 rc.5 initProfile/loadProfileDirectory/boot 与 storage/storage-json/storage-domain/session/commands/llm，GitHub/模型用替身。验证六个命令、本地路径拒绝与保存、三档卡片、full 参数传递、规则导出拒绝覆盖/导入/查看、卸载重载后规则和纠正持久化；组合配置不变，恢复 DSH_HOME 并清理临时 profile，没有接触用户 profile。

沙箱从包目录直接启动构建曾遇 EPERM；改由允许的 worktree 根目录执行 `npm --prefix packages/dsh-github-triage ...` 后构建和写入正常，未提权或改系统权限。

## 真实 smoke

1. `node packages/dsh-github-triage/scripts/smoke-real.mjs cordiverse/cordis --limit 6 --mock-model`：**通过**，4 issues + 2 PR，三档均出现；第二轮同快照经 TEMP 缓存持久化重载后，0 重新处理 / 6 命中，无重复简报。
2. 在本 worktree 包内 `.tmp` 临时目录执行 `git clone --depth 50 https://github.com/cordiverse/cordis`，成功。对该临时仓库运行相同命令并加 `--local <临时克隆路径> --local-ref HEAD`：**通过**，HEAD `261c5fdae6ed`，4 issues + 2 PR，本地文件与提交证据出现在卡片，第二轮 6 命中。没有 checkout/fetch 或更改克隆工作区；演示目录随后清理。
3. 额外尝试 `cordiverse/cordis --full --since 2000-01-01 --max 6 --mock-model`：**未通过，HTTP 403（限流或权限不足）**。未绕过限流、未改变认证方式；全量真实 API 端到端仍需在额度可用时重跑。全量确定性替身测试及临时 profile 参数传递已通过。

模拟模型按编号轮流输出三档，明确标注“模拟模型”，不请求真实 AI、不证明判断质量。smoke 支持 --local / --local-ref、--full / --since / --until / --max、原 --limit / --business / --business-file / --mock-model / --model-adapter / --schedule-only；无模型默认仍仅规则预筛。

## 未测与风险

未测用户桌面安装/Electron 实际渲染、真实 AI provider 请求及判断质量、Node.js 22 实机、其他系统、长期运行/DST。真实全量 smoke 被 403 阻断。大仓库树、Git 输出与文件大小、浅克隆、历史窗口、上游搜索索引与关联 PR 不全都可能缺证据。未读取未提交代码；上游默认分支内容与 PR 实际 head 也可能不同。CI/相关上游代码独立变化未必推进条目时间；用户纠正不会自动因业务或本地版本变化撤销，需人工留意。待发状态与投递间中断仍可能重复简报。

## README skill 自检

逐项核对 `.agents/skills/dsh-plugin-readme/SKILL.md`，以下清单记录本次实际审阅；根 README 只同步本包功能行，完整上手链接到包 README，不把其他包重写成同样结构。

- [x] 第一屏紧接标题的一句话说明了用户能得到什么，未先讲实现细节。
- [x] 有 3–4 条各不重复的亮点，每条以具体用户收益表达。首条是结合业务说明和自己的代码。
- [x] 与同类插件或现有做法的差异清楚，比较有依据且没有夸大。只比较逐条翻 GitHub 与集中研判，不宣称竞品优劣。
- [x] 亮点后有示例输入与输出，或真实截图/演示；示意内容已标注。示例包含三档，不伪装真实结果。
- [x] 图片、链接和锚点有效，没有失效素材或未替换的占位符。无图片和自定义锚点；本地文档路径已核对，外部链接使用明确的仓库/官方文档地址。
- [x] 快速上手恰好三步，明确先完全退出桌面 DSH（含托盘）再安装，随后重开使用。本地对照放第三步内的可选操作。
- [x] Git 地址严格采用 github:hzopc1031/dsh-plugins#main&path:/packages/<pkg> 格式，已换成真实目录名，整段地址加引号。
- [x] 首次使用入口、必填配置、最小操作及可见结果足够具体，profile 如有要求已核实。沿用 desktop 与真实 triage-models ID 目录。
- [x] 术语先用大白话解释，命令和配置键准确，没有空泛宣传语。命令/参数/字段已对照 src/config.ts、plugin.ts 与 smoke 解析。
- [x] 版本、详细限制、实现机制和测试说明集中在最后；必要操作提醒在步骤旁可见。费用、业务和本地代码外发、导出覆盖在对应操作旁说明。
- [x] 开头没有测试数、typecheck、未实测、commit hash 或验收日志。
- [x] 所有能力及兼容性承诺都有依据，安装、运行和界面验证的结论没有混淆。未承诺真实模型、桌面、全历史或标签区间已支持/验证。
- [x] 名称、描述、入口与插件实际情况一致，示例和素材没有凭据或私人信息。locale 描述同步，版本保持 0.2.0。
- [x] 只改授权文档，未因写作而执行安装、发布或未授权的 Git 写操作。本任务另有明确实现与临时 Git 测试授权；没有对本 worktree 暂存/提交/推送或对 GitHub 写入。

## 0.4.0 沙箱外 ui-smoke 实测（2026-11-12，审核者复跑）

- 环境：桌面自带 CLI 0.2.1-rc.5，系统 TEMP 下临时 DSH_HOME 的 web profile，本地路径离线安装，独立无头 Edge；不涉及用户 desktop profile。
- 两次复跑结果一致（退出码 1）：侧边栏「GitHub 哨兵」入口、无活动 agent 的中央整页、6 项 KPI、仓库列表、研判结果列表、模型未配置指引均真实出现，数据经宿主 POST 路由加载成功，无错误条。
- 失败项：会话顶部快捷按钮未检出。临时 web 左栏显示「暂无会话」并弹出登录引导，种子会话未在列表出现，无法进入会话；判断为 smoke 环境未种出可见会话，而非按钮缺失。代码中按钮仍注册于 `conversation.session.header.actions`，点击调用 `layout.selectPanel('dsh-github-triage')` 打开同一页面，失败时回退共享 Modal 渲染同一 Dashboard；jsdom 测试覆盖。
- 未验证：真实桌面 DSH（Electron）中的会话顶部按钮、页面视觉与交互；DSH 0.2.2-rc.1 实机；真实 GitHub/模型长跑与定时。
- 上文列出的 TEMP 遗留目录（dsh-github-triage-ui-home-*、ui-artifacts-*）已由审核者在沙箱外清理。
