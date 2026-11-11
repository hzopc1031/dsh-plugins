# 开发状态 · dsh-github-triage 0.2.0

日期：2026-11-11。工作目录 `dsh-plugins-wt-github-triage`，分支 `feat/github-triage`，基于 `59356a2`。本次只修改本 worktree；没有 git add/commit/push、npm 发布或安装到用户 DSH，没有读取 _private / _tools，也没有修改 `D:\AIInfra\DSHarness`。

## 固定接口与模型路由

核对官方 [dsh-v0.2.1-rc.5 / b830ec950faba0a46dda564be3e2d854afed94f1](https://github.com/deepseek-ai/deepseek-harness/tree/b830ec950faba0a46dda564be3e2d854afed94f1)，同时核对本包安装的 `@deepseek-ai/dsh-llm` **0.2.1-rc.5** 发布类型及运行时。没有用其他宿主版本推测接口。

- [llm/src/index.ts](https://github.com/deepseek-ai/deepseek-harness/blob/b830ec950faba0a46dda564be3e2d854afed94f1/packages/llm/llm/src/index.ts)：`ctx.llm.stream(GenerateOptions)`，收集 text-delta，要求 finish.reason.kind 为 stop；tools 为 []，45 秒取消信号，1800 maxTokens。宿主适配器负责凭据，不读取 DSH 密钥文件。
- [llm/src/types.ts](https://github.com/deepseek-ai/deepseek-harness/blob/b830ec950faba0a46dda564be3e2d854afed94f1/packages/llm/llm/src/types.ts)：GenerateOptions 的 **provider 与 model 是两个独立字段**。provider 对应 LlmProviderInfo.id；model 对应 LlmModelInfo.id，不是显示名称或组合字符串。
- rc.5 确有只读 `llm.listProviders(): LlmProviderInfo[]` 和 `llm.listModels(provider): Promise<LlmModelInfo[]>`。新增 `/triage-models` 使用这两个接口，仅显示可复制 ID；目录为空/失败时提示到 DSH 模型设置查看，不读取配置密钥、不注册路由、不调用生成。目录只是适配器广告列表，不强制模型必须列入目录。
- [commands/src/index.ts](https://github.com/deepseek-ai/deepseek-harness/blob/b830ec950faba0a46dda564be3e2d854afed94f1/packages/interaction/commands/src/index.ts)：沿用 register({definitionId,name,description,recordInput:false,handler}) / execute；注册五个命令。返回 CommandResult.text，经 command/run、command/done 投影成现有文本卡片，没有虚构面板或通知接口。
- [storage-domain](https://github.com/deepseek-ai/deepseek-harness/blob/b830ec950faba0a46dda564be3e2d854afed94f1/packages/storage/storage-domain/src/index.ts)：沿用 storageDomain.open(defineDomain(...)) / global.get/set / close。域名仍为 github_triage，宿主域版本仍为 1；global 增加 formatVersion:2，通过 zod preprocess 在原域内兼容升级。保留 0.1.0 的仓库配置、删除标记、上次运行和用户纠正；清除旧派生结论、报告和待发简报，避免规则结论被当作 AI 结果。
- Schemastery 用于插件配置，zod 4.4.3 用于状态与输出。继续使用 ctx.effect 管理原生定时器及卸载取消；rc.5 的会话 schedule 服务不作为任意 callback 调度接口。

## 0.2.0 行为

规则只生成证据。最终 issue 的 type/exists/worthFixing/priority，PR 的 verdict/fitsDirection/risk/testing 均由模型给出；两者必填 businessReason/reason/evidence。模型判断不会被规则改写，但规则观察证据会保留。没有可用业务说明时明确写通用标准判断。

未配模型、禁用、服务不可用、调用失败或 JSON 解析失败时，报告顶部和条目显示原因，只展示「仅规则预筛，未经 AI 研判」证据，不形成结论、不写入已研判缓存。失败项后续会重试；相同失败观察不重复发简报。禁用模型后不会展示原 AI 缓存结论。用户纠正标记独立来源；同项优先采用，后续同仓库同类最多参考最近 8 条。

业务设置支持内联 business，以及相对仓库路径/本地绝对路径 businessFile。仓库 contents 默认分支 GET，本机只读普通文件，拒绝目录、设备、UNC、备用数据流；严格 UTF-8，文件最多 16KB。送模型最多 8KB，截断有标记；报告显示使用状态、来源、大小或失败。配置与带引号的 add/business/--file/--clear 命令均支持，命令覆盖只写自身域。

issue 根据关键词树和报错栈路径定位；PR 保留 patch 并读取改动文件的默认分支内容。每条最多尝试 3 个相关文本文件，源文件大于 64KB 跳过，片段每文件最多 3KB。整个模型 prompt 为有效结构化 JSON，最多 48KB UTF-8，超出时删减参考、文件等并标注。模型无工具；输入均标注不可信数据。

指纹包含条目时间、PR head、业务内容哈希（含截断外内容）和模型路由。配置/文件内容变化后重新处理；读取失败变成成功也会使指纹变化。CI 独立变化、相关代码独立变化可能不改变条目指纹，是当前限制。缓存最多 5000 条。

GitHub 继续固定 api.github.com、GET-only、拒绝重定向与 GraphQL mutation/多操作。认证 GH_TOKEN → GITHUB_TOKEN → 固定 execFile('gh',['auth','token'],shell:false) → 匿名；私有内存令牌、模型/公开文本/状态脱敏、异常不回显。新增 contents 不跟随 download_url。没有任何 GitHub 写接口。

## 验证

Windows，Node 24.20.0，npm 11.19.0。目标宿主 rc.5；未实机运行 Node 22。

最终验证：typecheck、**224/224 测试**、临时 rc.5 profile、verify-pack 全部通过；0 失败、0 跳过。

- typecheck：严格 TypeScript 通过。
- npm test：最终 **224/224** 通过，含模型主导、全部必填字段/枚举、失败无结论无缓存、内联/仓库/本地业务、截断/失败/未配置、指纹失效、引号/清除、GET 和 token 脱敏、相关文件上下限、模拟流程与官方临时 profile。含严格 UTF-8、UNC 参数、空模型返回，以及模型服务不可用时禁止旧缓存结论复用等边界。
- 临时 profile：官方 initProfile/loadProfileDirectory/boot；本 worktree .tmp 中独立 profile、storage root、junction，真实 storage/storage-json/storage-domain/session/commands/llm，注册测试 LlmAdapter；执行五个命令、业务设置、模型判断、用户纠正、报告、卸载重载，确认持久化且不改组合配置。GitHub 与模型均为替身。finally 恢复 DSH_HOME、关闭宿主并清理临时目录；没有接触用户 profile。
- verify-pack：最终通过 **32 个文件**精确白名单；含 business.js/d.ts、预构建 lib、exports、bundle、locale，版本 0.2.0、锁文件一致，无安装脚本。仅当前命令设置 npm_config_cache 为本 worktree 的 .tmp/npm-cache。
- lib 已按最终源码重新构建，含新增 business.js / business.d.ts。

## 真实 smoke

已尝试：

```powershell
node packages/dsh-github-triage/scripts/smoke-real.mjs cordiverse/cordis --limit 6 --mock-model --business "插件框架，核心是生命周期和依赖隔离；优先处理隔离失效、卸载异常与兼容性问题"
```

沙箱首次 GitHub 请求返回 **HTTP 403（限流或权限不足）**，脚本退出 1，未进入真实条目分析。最终复跑同样为 403；默认无模型的 --limit 1 也已确认先打印「未配置模型，仅规则预筛，未经 AI 研判」，随后收到相同 403。不能记为真实 smoke 通过，也不能据此断言完全没有网络。可在沙箱外使用同命令复跑。没有尝试读取额外凭据或改变认证方式。

离线确定性模拟模型已通过自动测试：issue + PR 都走同一模型主导流水线，业务说明注入、严格新 schema、输出明确标注「模拟模型」、持久化缓存及第二轮复用均检查。它证明流程和输出格式，不证明真实模型准确性。smoke 支持 --business / --business-file / --mock-model / 原 --model-adapter；默认无模型仅预筛、不缓存结论。--schedule-only 注入时钟在 0ms、3600ms 触发恰好两轮。

执行期间 Windows 沙箱启动器曾短暂失效（orchestrator_helper_incomplete），之后恢复；该异常没有被计作任何测试通过。

## 未测与风险

未安装到用户 DSH；未测 Electron 真实桌面渲染/交互、真实模型 provider 请求、Node 22 实机、长期运行/DST、大仓库完整审查。真实 GitHub smoke 本次被 403 阻断。部分文件/CI/关联 issue 证据可能不全，模型也不执行复现。待发状态和投递之间断电可能导致重复简报，不承诺跨进程 exactly-once。

README 已按中文三步上手重写，根 README 包描述同步；参考来源和 MIT / Apache-2.0 声明保留。未发布版本合入 main 前，README 的 main 安装地址仍会指向旧版。
