# 开发状态 · dsh-github-triage 0.3.0

日期：2026-11-11。仅在指定 worktree（feat/github-triage，任务基线 origin/main 0703303）改动。没有 git add/commit/push、npm 发布、安装到用户 DSH、修改 D:\AIInfra\DSHarness、访问 _private / _tools 或 GitHub 写操作。下方 0.2.0 记录为历史基线，不代表本次验证结果。

## rc.5 UI 能力调研与选择

固定官方标签 **dsh-v0.2.1-rc.5**，提交 **b830ec950faba0a46dda564be3e2d854afed94f1**。已通过 GitHub 只读连接器读取该标签源码（普通 web/raw 与 shell HTTPS 在沙箱内失败，改用连接器；没有用 main 的 API 推断 rc.5）。

- [ui-slots/src/index.ts](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-slots/src/index.ts)：SlotCore、SlotMap、kind/scope、register 的 children 声明及释放；不能自行取个 slot 名称就假定宿主有出口。
- [ui-renderer/src/client/registry.ts](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-renderer/src/client/registry.ts) 与 [client/index.ts](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-renderer/src/client/index.ts)：SlotRegistry、slots.inject、register、installScope 与真实 React 渲染。root 是 single，不应覆盖；整应用叠层应向 shell.overlay 贡献（[ui-layout 声明](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-layout/src/client/index.ts)），不是抢 root。
- [ui-sidebar/src/client/index.ts](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-sidebar/src/client/index.ts) 与 [contract/slots.ts](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-sidebar/src/client/contract/slots.ts)：真实侧栏扩展有 sidebar.panellist / sidebar.panellist.actions / sidebar.footer.action（list/root）。sidebar.settings 是 single，替换它会影响原设置入口。panellist id 对应 main 面板，需要配套布局与导航注册。
- [ui-conversation/src/client/apply.ts](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-conversation/src/client/apply.ts) 与 [contract/slots.ts](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-conversation/src/client/contract/slots.ts)：真实 **conversation.session.header.actions（list/session）**、header.utilities（list/session）、header.views.actions（list/root）、conversation.view、conversation.input.left/right/dock/overlay。当前采用 actions，在已打开会话顶部显示「GitHub 仓库研判」按钮。它有会话 ID，可直接调用现成的会话命令 remote；本仓库 draft-rescue 已用相同入口。
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
- [x] 明确已打开会话顶部「GitHub 仓库研判」、provider/model/modelEnabled、添加与首次分析、可见结果。
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
