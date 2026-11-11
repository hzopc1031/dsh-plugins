# 开发状态 · dsh-github-triage 0.1.0

日期：2026-11-11。目录 packages/dsh-github-triage；分支 feat/github-triage。MIT。已提交并推送到 hzopc1031/dsh-plugins main；未 npm publish，未安装进用户 DSH，未读取 _private / _tools，未修改 D:\AIInfra\DSHarness 或其他 worktree。

## 改名

包由开发期名称统一改为 dsh-github-triage（目录、包名、服务/命令定义 ID、存储域 github_triage、locale、文档、预构建 lib）。旧目录已在沙箱外删除，全仓库搜索旧名称无残留。

## 名称与接口核对

执行 npm view dsh-github-triage name version --registry=https://registry.npmjs.org --fetch-retries=0 --fetch-timeout=15000，官方 registry 返回 E404 / Not Found，查询时包名未占用。不保证未来仍可用。

官方标签 [dsh-v0.2.1-rc.5](https://github.com/deepseek-ai/deepseek-harness/tree/dsh-v0.2.1-rc.5) 经 GitHub tree API 确认 SHA 为 b830ec950faba0a46dda564be3e2d854afed94f1。联网读取该 ref 的下列实现，并安装 @deepseek-ai/* 0.2.1-rc.5 的发布包核对 lib/types 声明。未用其他 DSH 版本猜接口。

- 命令：[packages/interaction/commands/src/index.ts](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/interaction/commands/src/index.ts)。ctx.commands.register({ definitionId, name, description, recordInput, handler }) 返回 disposer；name 必须是不带斜杠的小写标识。handler 收到 {agent, rawInput, signal, ...}，返回 CommandResult。ctx.commands.execute(agent, '/triage-report ...', [], signal) 实际生成 command/run / command/done。注册四个 triage 命令，均 recordInput:false。
- 配置：发布包 @deepseek-ai/schemastery ~3.18.5，Config = z.object(...)，repositories 默认 []，配置字段含 repo / mode / daily / everyHours / limit。运行时另用 zod 严格校验时间、枚举、repo 和数值。对照本仓库 task-review、heartbeat-monitor、file-holder 的导出、bundle 和命令 effect 写法。
- 展示：[ui-chat 的 command 节点](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-chat/src/client/conversation-nodes/command.ts) 消费 command/run、command/done，并投影 outcome.text。本包与 heartbeat-monitor、task-review 一样返回文本卡片，将 Markdown 格式的理由/证据/链接附在每条结果内。未声称有专用可展开交互面板。
- UI 扩展点确实存在：[packages/client/ui-slots/src/index.ts](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-slots/src/index.ts) 提供声明合并的 SlotMap、SlotFactoryMap、register 等契约，browser factory 可贡献 React UI；本仓库 draft-rescue 也使用该机制。不是“rc.5 不支持面板”，而是本包选择现有命令卡片 + /triage-report、/triage-fix，不添加前端 bundle/webview，不虚构 ctx.panel / ctx.notify 等接口。真实桌面文本格式、链接点击/布局仍待验证。
- 模型：[packages/llm/llm/src/index.ts](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/llm/llm/src/index.ts) 与 [types.ts](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/llm/llm/src/types.ts) 明确提供 ctx.llm.stream(GenerateOptions): AsyncIterable<StreamChunk>。GenerateOptions 含 provider、model、system、messages、tools、signal；一次性 user input 可不带持久消息 id/source。收集 text-delta，要求 finish.reason.kind === stop。本包用此真实低层一次性接口，不创建有写工具的子代理，也不伪造 agents.completion。DSH AgentRegistry 实际提供 create/resume、withInitiator 等生命周期接口，不是本包所需的简短 completion。
- 模型路由：显式配置已经由 DSH 注册的 provider/model，tools:[]，45 秒超时、1800 maxTokens、严格 JSON schema + zod 校验。凭据由宿主 LLM adapter 持有。空 route / 未挂 llm / 异常 / 畸形输出都回退并标注。没有读取 DSH credentials 文件，没有自建外部模型 HTTP 客户端，也没有默认猜测会话 route。模型流使用替身验证，真实 provider 请求未测。
- 存储：[storage-domain](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/storage/storage-domain/src/index.ts) 的 ctx.storageDomain.open(defineDomain(...))、domain.global.get/set、domain.close；zod 是其记录 schema，schemastery 是插件配置 schema，二者不可混用。本包独立域名 github_triage（官方 UNIT_NAME_RE 允许下划线、不允许连字符），version:1。状态仅含配置覆盖/删除标记、结论缓存、纠正、报告、上次运行与待发简报。宿主 backend/routes 决定路径，JSON single 布局是 <storage-json.config.root>/github_triage.json；不硬编码用户数据目录，不写全局配置。
- 调度：[packages/schedule/schedule/src/index.ts](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/schedule/schedule/src/index.ts) 确有 ScheduleService，提供 create(sessionId, {title,prompt,daily/every_seconds/cron/...}, signal)，但它属于会话提醒/投递领域，不是注册任意插件 callback 的 cron 服务。本包不创建隐式会话 prompt；改用 Cordis ctx.effect 管理原生 setInterval(30_000) 和启动 setTimeout，effect teardown 清理。发布的 Cordis 核心声明未提供本包可直接依赖的 ctx.setInterval 方法，因此没有编造该方法。纯函数 dueSlot(schedule,lastRun,now) 计算最新到期轮次，持久化成功时间，启动合并补跑一次，队列串行防重入，失败退避。
- 简报：在 changed.length > 0 或首次发现仓库功能关闭时保存并用上述 commands.execute 发送；相同关闭提示不会重复推送。无可用根会话时缓存在自身域中；agent/created 后延迟到 macrotask 投递，避免 Session 发布事件中重入 append。没有 OS 通知。

## 实现与边界

- 多仓库默认空清单；issues / prs / both；手动上限、全局/仓库上限；静态配置 + 命令持久覆盖及删除标记。
- 规则预筛、bigram 重复检测、通用模板分段与复现/版本/报错、关键词树路径定位；PR 规模/风险/CI/statuses/checks/测试/同仓库关联 issue 文本对应性/敏感文件证据。
- 指纹 number+updated_at（PR 加 head SHA），旧结论复用；模型只判最终 JSON；保留规则证据和风险标记；用户纠正同项直接覆盖，后续同仓库同类条目附最近纠正参考。
- GET-only REST，GraphQL GET 仅单 query，拒绝 mutation 等文档与所有非 GET；固定 API 主机、禁止重定向。认证 GH_TOKEN → GITHUB_TOKEN → 固定 execFile('gh',['auth','token'],shell:false) → 匿名。真实 token 和包含 token 的构造选项使用 JS # 私有字段；脱敏覆盖模型/输出/状态，不回显原始异常。
- 每轮首先 GET 仓库元数据；仅 has_issues / has_pull_requests 显式 false 时跳过该功能接口，缺失字段视为开启。报告始终展示关闭提示，首次发现生成简报，重复提示保持静默；已关闭 Issues 的关联 issue 详情也跳过。元数据失败不伪装成功。
- 单次网络 20 秒，gh 5 秒，支持 AbortSignal；403/429 按响应头冷却；候选最多 N、PR files 最多 300、检查最多各 100、关联 issue 最多 3、树最多 5000 个 blob。
- 两个运行时依赖：undici 用于 Node 22 的 EnvHttpProxyAgent（HTTP_PROXY / HTTPS_PROXY / NO_PROXY）；zod 精确 4.4.3 与 rc.5 storage-domain 匹配。安装锁文件独立。undici Agent 会发实验性警告；未改全局 dispatcher。
- 未执行代码级复现；“真问题/合并价值”是带不确定性的研判建议。相似度、模板、路径、关联 issue 对应性均是启发式。CI 独立变化可能不会改变缓存指纹。详细边界见 README。

## 已测

环境 Windows，Node 24.20.0、npm 11.19.0；目标宿主 API rc.5；Node 22 未实机运行。开发依赖安装使用 --ignore-scripts，未执行安装期脚本。

- typecheck：strict TypeScript 通过。
- npm test：先 tsc 生成 lib，node --test 共 **115 / 115 通过**，0 失败，0 跳过。
- 覆盖 issue/PR 样例、中文/英文重复检测、全部缓存状态（新增/更新/未变/head SHA）、每日/间隔/跨天/错过补跑/无重复/时钟回拨、配置与命令增删/冲突参数、上限与继承。
- 模型正常/代码块/畸形/缺字段/额外字段/错误枚举/类型、服务异常回退、实际 llm.stream 参数替身、错误 finish、证据保留、纠正同项/缓存命中/更新/few-shot、无变化无简报、取消后不缓存。
- 新增 26 项测试：仓库功能开启/关闭/缺失字段与 issues/prs/both 模式、元数据失败、开关刷新/跨仓库提示隔离、关闭 Issues 时跳过关联拉取、零条目报告/首次简报/持久化后静默、混合条目简报、匿名无条目静默及 smoke CLI 参数。
- mock fetch 断言拉取、PR 文件、CI、关联 issue 全部只有 GET；非 GET 在认证前拒绝；GraphQL mutation/多操作/直接 request 绕过被拒绝；固定 host、重定向拒绝、超时取消、403/429 冷却、认证顺序、匿名、异常不回显凭据、公开对象/模型/报告/状态不含测试凭据。
- **临时 profile 加载验证通过**：test/profile.test.mjs 使用官方 initProfile、loadProfileDirectory、boot，在本包 .tmp 下创建独立 profile 和 storage root，用 junction 指向预构建包。加载真实 storage / storage-json / storage-domain / session / commands 服务；执行四种命令、fixture 研判、纠正、报告；卸载重载后配置/纠正/报告仍在，组合配置未改。GitHub list/enrich 在这项集成测试中使用替身，不调用真实网络；finally 关闭宿主、恢复 DSH_HOME 并删除该临时 profile。没有接触桌面用户 profile。
- verify-pack：npm pack --dry-run --json --ignore-scripts 精确白名单 **30 文件**通过，校验 JS/声明、exports、bundle、locale、无 install/prepare/postinstall。首次运行因默认 npm cache 不可写失败；仅为当前命令设置 npm_config_cache=<worktree>/packages/dsh-github-triage/.tmp/npm-cache 后通过，未改 npm 全局配置。Windows npm 固定命令的 shell:true 有 DEP0190 提示，未拼接任何用户参数。
- 预构建 lib/ 为交付内容，纳入本次工作区文件；没有依赖安装时构建。
- smoke --schedule-only：注入时钟 0ms、1000ms、3600ms，对 0.001 小时周期恰好触发两次后退出。

## 真实 smoke 验收

2026-11-11 在本 worktree 的沙箱中通过匿名 GET 读取仓库元数据，确认：

- cordiverse/cordis：has_issues=true、has_pull_requests=true。它是 DSH 的底层框架，作为真实 issues/PR 验收仓库。
- deepseek-ai/deepseek-harness：has_issues=false、has_pull_requests=false。DSH 官方仓库已关闭 Issues/PR；此前 issues 为空、pulls 返回 HTTP 404 是功能关闭，不再归因为网络/权限不明。

执行 `node packages/dsh-github-triage/scripts/smoke-real.mjs --limit 5`，默认 cordiverse/cordis：分析 2 issues + 3 PR，逐条输出结论/证据；TEMP 持久化往返后，同一快照第二轮 0 重分析、5 条缓存命中。沙箱外用 GITHUB_TOKEN 以 --limit 10 复跑：2 issues + 8 PR，第二轮 0 重分析、10 条缓存命中，输出不含令牌、无简报；退出 0。无真实模型调用。

执行 `node packages/dsh-github-triage/scripts/smoke-real.mjs deepseek-ai/deepseek-harness --limit 5`：只读取元数据，提示“该仓库已关闭 Issues/PR 功能；已跳过对应拉取。”，0 条目；第二轮 0 重分析、0 缓存命中、无重复简报；退出 0。没有把关闭功能当作 HTTP 404 错误。

两次运行的调度注入时钟演示均在 0ms / 3600ms 触发两次；finally 清除 TEMP 缓存。脚本支持任意 [owner/repo] 与 --limit（1–100 的合计候选上限，默认 5），条目数量按实际快照断言，不要求每种各 5 条。保留 --schedule-only / --model-adapter，新增 --help。

## 未测与风险

- 未在真实 Electron 桌面 DSH 中加载/观察；未安装到用户 DSH，没有修改 D:\AIInfra\DSHarness。
- 临时官方 Loader/profile 验证不等同于桌面面板视觉、按钮、输入焦点、链接点击、真实通知或 git 安装 UI 端到端验收。
- 未真实调用 DSH 模型，也未实测代理服务器/真实限流 headers、长时间运行、DST 转换与大规模仓库。
- 断电可导致已投递但待发状态尚未删除，从而下次重复简报；普通运行有投递互斥，但不承诺跨进程 exactly-once。
- 只在宿主运行时调度；无 webhook、全历史扫描、仓库专属 issue 表单解析、完整 diff/代码级审查或安全证明。
- 首次调度会补跑最近一轮；间隔按成功任务开始时间计算。缓存指纹不变时不会因配置模型/规则改变而强制重判。
- 官方 git 子目录安装约定、files/exports 和预构建结构已验证；没有实际安装到用户 DSH。推送到 main 后即可用 git 子目录地址安装。
- 忽略的 node_modules 与本地 .tmp/npm-cache 是本 worktree 本地开发产物，不进入打包白名单。

## 参考与移植

联网阅读了 [ItQianChen/dsh-github-flow](https://github.com/ItQianChen/dsh-github-flow) 的 credential/executor/review-rules 思路，以及 [PerryLink/dsh-github-bot](https://github.com/PerryLink/dsh-github-bot) 的 credential、ci/review-rules、jobs/polling 组织。许可分别 MIT 与 Apache-2.0（用户已确认兼容）。全部功能由本包自行实现，未直接移植代码片段；THIRD_PARTY_NOTICES 与 README 留有来源/许可说明。没有引入上游任何 GitHub 写操作。

