# 开发状态 · GitHub 哨兵（dsh-github-triage）0.4.4

## 0.4.4 冲突合并（2026-11-12）

审核者执行 rebase 后，仅编辑文件解决五处冲突，未暂存或继续 rebase。main 的 0afc59f 已占用 0.4.3，本地 151c12f 的界面改动因此顺延到 **0.4.4**；CHANGELOG 顶部是本轮 0.4.4，main 的 0.4.3 条目原样保留。下方 0.4.3 开发记录是升级前历史。

- 保留 main 的 system-proxy、Windows PAC / 静态代理检测、网络诊断、30 秒默认超时及 timeoutSeconds（10–120 秒）、detect-proxy / diagnose 路由与命令；保留本地官方 primitives、唯一左侧栏入口、类型/分析文案、表单、扫描说明和请求核算。未更改分析逻辑或增加 GitHub 写操作。
- 检测/诊断按钮改为宿主共享 `Button variant="outline"`；卡片使用现有 gt-card，诊断正文通过 gt-network-text 的 pre-wrap / overflow-wrap:anywhere 完整换行，无原生按钮、内联 style 或文本截断。新增两项 DOM 回归覆盖动作、完整长文本、失败保留结果与再次操作；DOM 测试不证明浏览器几何。
- 同步 package.json、锁文件根版本、User-Agent、相关断言、NOTICE、README 与 verify-pack 至 0.4.4；engines.dsh 保持 `>=0.2.1-rc.5 <0.3.0-0`。发布模块同时包含 system-proxy 和 client-controls。lib/client.js 未手工合并，由 `npm run build` 重建。
- Windows / Node.js 24：build、typecheck 通过；运行前 PATH 加入 `C:/Program Files/Git/mingw64/bin`，`npm test` **550/550 通过，0 失败、0 跳过**；verify-pack **56 文件通过**。node_modules 联接未改，未运行 npm install/publish，未读私密目录、凭据或已登录 Chrome。
- 工作区冲突标记扫描（排除 .git、node_modules、私密目录与凭据文件）无 `<<<<<<<` / `>>>>>>>`，`git diff --check` 通过；README 本地链接目标存在，main 0.4.3 更新记录逐字保留。Git 索引仍保留五个未合并项，这是未执行 git add 的预期状态，留给审核者暂存并继续 rebase。
- 请求核算已补充 `A = R + F`：自动系统代理失败回退最多为每个逻辑 GET 增加一次尝试，超时/取消共用原信号；下方原表格作为无该回退时的基数。main 自带的代理回退/显式代理不回退与超时测试均通过。
- 本轮实际 `npm run ui-smoke` **未通过：CDP timeout: Page.enable**，没有进入插件页或生成截图。诊断目录：`C:/Users/Mayn/AppData/Local/Temp/dsh-github-triage-ui-artifacts-W7Af47`。脚本无法确认自建 PID 25720 进程树结束，并报告临时 home `C:/Users/Mayn/AppData/Local/Temp/dsh-github-triage-ui-home-QLdOot` 的 EBUSY 清理失败；随后 Get-Process 未检出该 PID，但不代表子进程全部退出，定向 CIM 查询被拒绝访问。仅针对本轮确切 TEMP 路径、带绝对路径/非联接检查的清理请求被自动审批以 `blocked by policy` 拒绝，未提供具体原因，未绕过。烟测执行会话未确认结束；需沙箱外检查自建进程和该目录。未触碰历史残留。

### README 本轮必要修改自检

按权威 `C:/Users/Mayn/.dsh/skills/dsh-plugin-readme/SKILL.md` 逐项复核，保留现有结构，只合并网络说明、版本、术语与验证环境。

- [x] 第一屏紧接标题的一句话说明了用户能得到什么，未先讲实现细节。
- [x] 有 3–4 条各不重复的亮点，每条以具体用户收益表达。
- [x] 与同类插件或现有做法的差异清楚，比较有依据且没有夸大。
- [x] 亮点后有示例输入与输出，或真实截图/演示；示意内容已标注。
- [x] 图片、链接和锚点有效，没有失效素材或未替换的占位符（无图片；本地目标已核对，外部固定地址沿用既有文档，本轮未重新联网验证可达性）。
- [x] 快速上手恰好三步，明确先完全退出桌面 DSH（含托盘）再安装，随后重开使用。
- [x] Git 地址严格采用 `github:hzopc1031/dsh-plugins#main&path:/packages/<pkg>` 格式，已换成真实目录名，整段地址加引号。
- [x] 首次使用入口、必填配置、最小操作及可见结果足够具体，profile 如有要求已核实。
- [x] 术语先用大白话解释，命令和配置键准确，没有空泛宣传语。
- [x] 版本、详细限制、实现机制和测试说明集中在最后；必要操作提醒在步骤旁可见。
- [x] 开头没有测试数、typecheck、未实测、commit hash 或验收日志。
- [x] 所有能力及兼容性承诺都有依据，安装、运行和界面验证的结论没有混淆。
- [x] 名称、描述、入口与插件实际情况一致，示例和素材没有凭据或私人信息。
- [x] 只改授权文档，未因写作而执行安装、发布或未授权的 Git 写操作（实现、构建与项目测试由本次任务另行授权）。

---

## 0.4.3 第二轮：桌面反馈修复（2026-11-12）

在同一工作树上继续，保留上一轮官方控件和样式改动；只改本插件，版本仍为 0.4.3，engines.dsh 仍为 `>=0.2.1-rc.5 <0.3.0-0`。下方旧记录是历史验证，不代表本轮完成了真实桌面视觉验收。

### 两个入口的原因与修正

基线 `git show HEAD:packages/dsh-github-triage/src/client.tsx` 和上一轮 `_wip/triage-official/last.txt` 一致：0.3.0 先有会话动作，0.4.0 加入同 ID 的侧栏和中央页时仍保留会话导航；上一轮明确写了保留顶部入口。这是两个不同插槽的主动注册，不是 DSH 重复加载。当前 Client apply 只注册 `main` 与 `sidebar.panellist`，删除 TriageButton、会话动作注册、导航及其紧凑 Modal 回退。原命令和独立 commandCall 适配函数保留，不再提供页面入口。真实 renderer、组件测试、verify-pack 和 ui-smoke 均改为确认无会话动作。

### 逐区复查与修复

| 区域 | 本轮检查、修复与证据边界 |
| --- | --- |
| 侧栏与整页 | 仅保留左侧栏一级入口；main 与 sidebar 共用 ID；apply 的 style/locale 有 effect 清理，renderer 卸载验证通过 |
| 添加/编辑表单 | headless Modal 使用明确的 `height:min(860px,100%)`，按宿主遮罩可用高度收缩；中间 flex 链保持 min-height:0，正文滚动、头尾不收缩。此前仅有 max-height，嵌套正文的可分配高度不稳定 |
| 地址校验 | 去掉原长红字，改为简短中性文字“仓库地址无效，请改用 owner/repo 格式”；保留 schema 拒绝、aria-invalid、错误关联和非法数据零请求；输入修改时清除旧错误 |
| 表单保存 | 保存期间禁止 Escape/遮罩关闭；失败保留草稿和字段错误，恢复可编辑；取消/保存仍在独立页脚 |
| 类型与术语 | 表单、卡片、结果类型共用“issues 与 PR / 仅 issues / 仅 PR”；用户文案统一使用“分析”，命令说明、模型提示、报告、文档与断言同步 |
| 仓库卡片 | 原来 raw both/prs 改为用户标签；长仓库名/路径/摘要继续换行；立即分析提交期间禁用，避免等待快照时连点 |
| KPI | “待处理条目”改为“报告条目”，说明含历史报告和关闭条目；不把报告数当成 GitHub 开放待办总数 |
| 结果/筛选 | 保留官方 SegmentedTabs、Pill、Menu 及键盘行为、tab/panel 关联、分页加载；类型标签统一，三档/搜索/排序/仓库组合回归 |
| 详情/纠正 | 状态枚举显示“已确认/较可能/证据不足”等中文；移除无助于用户判断的内部缓存指纹；提交中锁定理由，保留证据及安全链接 |
| 规则查看/导入导出 | 保留按需读取、失败重试、显式复制/新文件导出/导入；导入后重新读回规则并同步编辑草稿，避免下一次导入使用旧显示值 |
| 普通/全面扫描选项 | 卡片按钮下方和选项正文均直接显示真实范围、继承上限与缓存条件；不依赖 hover/title。官方 Modal 的 contentClassName 指向独立可滚动内容，字段网格可变单列，错误完整换行，开始按钮在字段之后 |
| 日期与上限错误 | 明确结束日期不能早于开始日期，分别关联 aria-invalid、aria-describedby 与可见 alert；切换模式/修改值清除旧提示 |
| 删除确认 | 失败保留卡片与确认框，错误显示在确认框内部（此前显示在被遮罩盖住的主页面）；失败后可重试/取消 |
| 模型/空状态 | 保留可操作模型指引、实际 ID 读取、三步空状态；统一分析字样；模型未配置时明确仅规则预筛 |
| 加载/错误/布局 | 骨架、运行状态、错误重试、disabled 与长错误换行均检查；Menu 保留 body portal 并限制菜单滚动高度；390px、长路径、亮暗主题均沿用官方 tokens/组件，不伪造真实截图通过结论 |

使用本地只读的 dsh-client-ui-ux（含 alignment/spacing/icons）、dsh-responsive-ui、cordis-styling-nitpicking、社区 dsh-plugin-development 的 bundle/authority 指引，核对借用的 rc.5 Modal 实现/样式与类型。未运行第三方 skill 脚本；本次用项目自有的 build/test/verify-pack 验证。生命周期复查限定当前 Client apply、轮询和详情请求：没有新增模块单例/持久监听，保留计时器与 slot/effect 释放；没有据此宣称整个宿主无生命周期缺陷。

<a id="github-requests"></a>
### GitHub 请求次数核算

以下 R 先按 Github.request 的逻辑 GET 核算，即没有自动系统代理失败回退时的 HTTP GET 数；不含界面 POST、模型请求、本地 Git/文件读取、gh 本地认证命令。下面公式适用于成功完成的一轮；可选证据失败的 HTTP 尝试也要计数。强制请求失败/取消/限流会提前结束；队列已存在任务、输入拒绝或冷却期内可为 0，不自动重试补齐。

对单仓库定义：

- N：最终生效上限，普通 1–100（默认 20），全面扫描 1–500（默认 100）；本次参数优先于仓库，再优先于插件默认。I/P：合并并截取 N 条后，未复用 AI 缓存的 issues/PR 数，I+P≤N。
- L：列表阶段请求；普通 `1 + T`，T 为选中且功能未禁用的类型数（0/1/2）。全面扫描 `1 + Σ p_t`，每个有效类型 `1≤p_t≤ceil(N/100)`，短页或收集到本类型 N 条即停；两类分别读取后再合并截断，并非各处理 N 条。空列表也请求第一页；关闭功能的流不请求。
- B：有效的仓库相对业务文件 Contents 请求（正常 0 或 1，每轮都会读取）；绝对路径本机业务文件、业务文字和本机规则文件为 0。
- G：未缓存 issues 的共享默认分支元数据+递归树请求；I=0 时为 0，正常 I>0 时为 2。可选元数据失败只尝试 1 次并跳过树；每次 list 清除树缓存，而且每仓库每轮新建 Github 实例。
- S_i/S_p：每条 issues/PR 的 Contents 文件片段请求，0–3；没有按条目缓存 Contents。文件类型不支持/敏感路径跳过，读取失败的已发尝试仍计数。
- F_p：PR 文件页数，1–3，每页 100；即使文件数为 0 也有第一页，恰好 100 个文件且未达分页上限时还查下一页。正常稳定分页为 `min(3,floor(文件总数/100)+1)`。详情 1 次、combined status 1 次、check-runs 1 次，不为后两者继续翻页。
- K_p：PR 正文明确关闭同仓库 issues 的实际尝试数；不是固定 3。最多收集 3 个成功的 issues，按现有正文匹配和跨仓库过滤实际到达请求语句计数，禁用 issues 时为 0；失败或返回 PR 不增加成功数，重复引用不去重。
- H：本地 Git 对照成功解析到 sha 时为 1，否则 0。未缓存 PR 额外 1 次 commits（per_page=100，无翻页）。每条未缓存 issues 额外 1 次搜索（per_page=5），D_i≤5 个正文明确关闭本 issues 的候选 PR 详情；V_i≤2 次文件页、C_i≤2 次提交页（最多纳入 2 个已合入修复 PR）。正常完整获取时 V_i=C_i=修复 PR 数；失败会终止该条本地补充流程。

`R = L + B + G + Σ_issues S_i + Σ_PR(3 + F_p + K_p + S_p) + H × [P + Σ_issues(1 + D_i + V_i + C_i)]`

0.4.4 合入 main 网络层后的实际次数：`A = R + F`，F 为自动 Windows PAC / 静态系统代理请求抛错后，沿原路径执行的额外 GET 尝试数（每个逻辑请求最多 1 次，0≤F≤R）。显式代理、DIRECT、禁用/未检测到系统代理时不走该回退；HTTP 非成功状态本身不会触发网络层回退。下方表格和极端上界均为 R；若所有自动代理尝试均失败后回退成功，网络尝试上界为对应值的两倍。超时/取消可能在发出请求前或过程中终止，不能把 2R 当成已实际发送量。GitHub 默认超时 30 秒，timeoutSeconds 限制 10–120 秒；代理尝试与回退共用同一 AbortSignal，不各获一份新超时，也没有新增自动分页/分析逻辑。PAC 获取不是 GitHub 请求；手动诊断不属于分析轮次，代理路径诊断可另向 api.github.com 发 HEAD（同样可能回退），不计入本节 GET。

评论请求恒为 0：当前没有 comments/reviews 读取。PR 文件不等于额外一次“文件总请求”，上式已按页计入；本地代码只读操作本身不消耗 GitHub 请求。

默认 both、普通 N=20 / 全面扫描 N=100、仓库两类功能开启、无本地对照/业务文件/关联引用、PR 文件不足 100、无匹配代码片段，且条目全部未缓存时：

| 条目构成 | 立即分析（20 条） | 全面扫描（100 条） |
| --- | ---: | ---: |
| 全 issues | 3+2 = **5** | 3+2 = **5** |
| issues 与 PR 各半 | 3+2+10×4 = **45** | 3+2+50×4 = **205** |
| 全 PR | 3+20×4 = **83** | 3+100×4 = **403** |
| 全部命中有效 AI 缓存或空列表 | **3** | **3** |

每条实际匹配文件片段再加 0–3；有效仓库业务文件每轮加 1；可用本地对照每个 PR 加 1、每个 issues 加 1–10。仅 issues 或仅 PR 时，默认列表 L=2；关闭两类功能时 L=1。上限 500 的全面扫描 both 列表 L≤11，单类型 L≤6；缩小更新时间范围可能减少页数与入选数。仓库总请求是逐仓库 R 相加，最多配置 50 个仓库，不另乘隐藏的全局请求。

**范围必须带条件：** 不启用本地对照、无业务文件且每个 PR 的关联读取尝试不超过 3 时，默认 both 为普通 **3–243** 次、全面扫描 **3–1203** 次（每 PR 最多 1 详情+3 文件页+2 CI+3 关联+3 片段=12）。这不是任意正文的硬上界。

真实代码的 PR 正文在 list 规范化时截为 16,000 UTF-16 字符。最短关闭引用 `fix #0` 为 6 字符，连续匹配间至少需 1 个非词字符，因此单 PR 至多 `floor((16000+1)/7)=2285` 个匹配。全部引用读取失败且不触发冷却时，可尝试到这个数；不会因为 3 次失败而停。由此不加本地/业务的极端保守上界为普通 `3+20×(9+2285)=45,883` 次、默认全面扫描 `3+100×2294=229,403` 次；启用可用本地对照和 1 个仓库业务文件后，保守上界分别为 **45,904 / 229,504**。500 条、both 的相同极端上界为 `11+500×2294=1,147,011`（本地对照与业务文件再加 501）。这些是对现有分支的数学上界，不是典型用量；没有为了压低数字改变请求或关联逻辑。

缓存只省未变化条目的 enrich/localDetails/模型调用，不省列表和仓库业务文件。必须模型可用且已有 judgment、指纹一致；指纹含更新时间、PR head（full 搜索初始无 head，与普通列表可能不同）、业务、本地快照、规则与模型路由。规则/上下文变化或切换列表来源可导致重新处理；未配模型/失败条目不写 AI 缓存。全面扫描不是绕过缓存或强制重算；普通分析也不是只向 GitHub 请求“自上次以来变化”的列表。

源码依据（本轮文件行号）：[默认及每轮客户端](src/plugin.ts#L37) 37–38、90–95；[上限优先级](src/ui-service.ts#L43) 43–52；[列表](src/github.ts#L97) 97–140（metadata 102、full 分流 116–124、普通 133/137）；[正文截断](src/github.ts#L142) 142–145；[Contents/片段](src/github.ts#L146) 146–170 及 [片段数](src/business.ts#L10) 10；[issues 目录树](src/github.ts#L181) 181–196；[PR 详情/文件/CI/关联](src/github.ts#L199) 199–227；[本地补充](src/github.ts#L231) 231–258；[业务文件](src/business.ts#L47) 47–59；[缓存前后顺序](src/pipeline.ts#L64) 64–80、fingerprint 10–11、写缓存 103–104。

新增 request-count 测试直接组合真实 Github、run 和内存 fetch，核对上述 6 个默认构成、第二轮缓存仍 3 次，以及 5 个无效关联引用仍发 5 次请求；没有访问真实 GitHub/凭据。

### 本轮验证与限制

- 最终 `npm run typecheck`、`npm test` **532/532** 通过（0 失败、0 跳过）、`npm run verify-pack` **54 文件通过**；预构建产物已刷新，运行前 PATH 已加入 `C:/Program Files/Git/mingw64/bin`，未安装依赖。新增请求计数与界面错误/焦点/删除失败等回归。中间一次大小写断言失败已统一修正后完整复验；`git diff --check` 通过。
- 实际执行 `npm run ui-smoke`：再次失败于 **CDP timeout: Page.enable**，没有进入插件页面，未生成截图。本轮脚本保留 ui.png / ui-form.png，在 1440×800 检查表单页脚完整且正文滚动，新增 ui-form-invalid.png，并在系统主题确实切换时保存 ui-dark.png；不把媒体设置成功当作暗色已验证。
- 烟测临时 home：`C:/Users/Mayn/AppData/Local/Temp/dsh-github-triage-ui-home-A6m2Oe`；诊断：`C:/Users/Mayn/AppData/Local/Temp/dsh-github-triage-ui-artifacts-Wru5NW`。脚本 taskkill 未确认 PID 30228 进程树结束，Remove 报 EBUSY；随后 Get-Process 未检出该 PID，但这不证明全部子进程结束；定向查询自建 smoke Node 进程的 CIM 请求被拒绝访问，原烟测执行会话未确认结束。验证绝对路径位于 TEMP、非联接后的显式清理被自动审批以 **blocked by policy** 拒绝，未提供具体原因，未绕过。未满足“不留临时文件”；不触碰历史工作树外残留。烟测脚本末尾已改为所有写入等待后退出，避免无响应 CDP close 握手令一次性 CLI 挂住。
- 真实 DSH 0.4.2 Electron、亮暗主题、390px/短窗口最终几何与完整可访问性、菜单叠层/焦点外观、真实 GitHub/模型、长期定时仍未实测。组件/真实 renderer 的 DOM 回归、源码与 CSS 审查只能证明对应范围；审核者需在沙箱外复跑脚本并走查这些场景。

### README 必要修改自检

- [x] 第一屏紧接标题的一句话说明了用户能得到什么，未先讲实现细节。
- [x] 有 3–4 条各不重复的亮点，每条以具体用户收益表达（保留四条）。
- [x] 与同类插件或现有做法的差异清楚，比较有依据且没有夸大（对比逐条翻 GitHub）。
- [x] 亮点后有示例输入与输出，或真实截图/演示；示意内容已标注。
- [x] 图片、链接和锚点有效，没有失效素材或未替换的占位符（未新增图片，保留示意输出；请求核算链接对应上方固定锚点）。
- [x] 快速上手恰好三步，明确先完全退出桌面 DSH（含托盘）再安装，随后重开使用。
- [x] Git 地址严格采用 github:hzopc1031/dsh-plugins#main&path:/packages/<pkg> 格式，已换成真实目录名，整段地址加引号。
- [x] 首次使用入口、必填配置、最小操作及可见结果足够具体，profile 如有要求已核实（沿用 desktop）。
- [x] 术语先用大白话解释，命令和配置键准确，没有空泛宣传语（按本轮用户要求保留 issues/PR，统一“分析”）。
- [x] 版本、详细限制、实现机制和测试说明集中在最后；必要操作提醒在步骤旁可见。
- [x] 开头没有测试数、typecheck、未实测、commit hash 或验收日志。
- [x] 所有能力及兼容性承诺都有依据，安装、运行和界面验证的结论没有混淆（真实视觉仍未验证）。
- [x] 名称、描述、入口与插件实际情况一致，示例和素材没有凭据或私人信息。
- [x] 只改授权文档，未因写作而执行安装、发布或未授权的 Git 写操作（代码与临时隔离验证另由本轮开发任务授权，未装入用户 profile）。

---

以下为上一轮及更早记录，当前结论以上方第二轮记录为准。


## 0.4.3 官方 UI 资料核对与接入（2026-11-12）

工作目录为 `dsh-plugins-wt-triage-official`，分支 `feat/triage-official-ui`，基线 `origin/main 8e5de94`。本轮是现有页面的控件接入与样式修正，不重写插件、路由或分析逻辑，版本使用补丁号 0.4.3。版本同步 package.json、lock 顶层和根包、GitHub User-Agent、测试断言、THIRD_PARTY_NOTICES、README 与 verify-pack；engines.dsh 仍为 `>=0.2.1-rc.5 <0.3.0-0`。

### 为什么之前没用

实际打开了本文件的 0.4.0 dsh-context 对照与「0.4.1 表单调研与采用依据」、CHANGELOG、THIRD_PARTY_NOTICES，以及 `_wip/triage-ui/{prompt,last}.txt`、`_wip/triage-form/{prompt,last}.txt`。第一轮任务明确以 dsh-context 为主要参考，交付记录也是围绕它的布局、图标解析和路由。第二轮任务要求找现成 skill/组件，但记录显示只检查了统一目录索引和相关页面源码，没有记录表明读过官方内部 dsh-client-ui-ux 或社区 dsh-plugin-development。

本轮重新读取 `C:/Users/Mayn/.dsh/skills/README.md`，并确认两个同名目录均不存在；索引有 dsh-plugin-readme，没有上述两个 UI/开发 skill。这能解释自动发现未命中，不能代替继续检索官方资料。上一轮已看到 SettingsValueField，却把它的配置层语义一概视为不适合，仅使用 Modal/Input、借鉴字段布局。对上限这类确实支持继承的字段，这个排除范围过宽；其他原生控件也没有完成系统性替换。能从记录确认的是检索和采用不充分，不能据此编造当时的主观动机。

### 实际阅读的资料与采用范围

- 官方本地只读检出经单次 Git 命令核对为 `e8f7b93a344964de3dca1ace9e72b6e4d6de87cb`。完整打开 `dsh-client-ui-ux/SKILL.md`：UI change workflow / Minimum checks、Reuse before adding、Visual foundation、Component geometry、Interaction and feedback、Check the rules together；完整打开 `references/alignment.md`、`icons.md`、`spacing.md`。采用同角色轴线、完整图标盒与同前景色、组间/组内层级、共享控件、≤500 字重、在位错误、菜单 portal/关闭/焦点和真实渲染证据边界。
- 完整打开 `dsh-responsive-ui/SKILL.md` 第 1–9 节：以 390 CSS px 为最低验收目标，先分配空间与换行，保留主要动作和状态；完整展示长仓库名/路径/摘要，容器查询保留，粗指针输入字号至少 16px，不用 UA 判断布局，不因宽度变化重新挂载表单。标签页本身在局部横向滚动区保留单行，不造成整页横向滚动；实际几何仍待浏览器验证。
- 完整打开 `cordis-styling-nitpicking/SKILL.md` 的 Sources of truth、Review workflow 与三类 P0 规则。限定检查 Client apply、样式/locale/slot 注册、React 请求存活标记、轮询计时器和新增 Menu 的挂载/卸载；新状态留在组件内，没有新增模块级可变缓存、监听或计时器。原 ctx.effect 清理不变；真实 rc.5 renderer 测试仍检查卸载后样式移除，新增菜单测试检查 portal/backing 随表单卸载移除。这不是 Host 生命周期全面审计。
- 官方 skill 引用的资料不在本地稀疏检出中，另通过 GitHub 实际打开同一 e8f7b93 的 `docs/web-styling.md`（Ownership、Component rules、Input capabilities）、`docs/ui-radius.md`（Select the radius、Nested geometry、Settings card materials、Apply and verify）与 `ui-primitives/README.md`（Component catalog、Controls and icons、Settings form kit）。卡片使用正式 `--dsw-alias-settings-card-fill/stroke` 与 `--dsw-radius-xl`，不叠加中性边框和阴影；内部组采用共享 radius token，普通分隔线 0.5px；主题选择器由宿主拥有。旧版共享组件内部的 hover/材料实现保留宿主版本，不复制或跨包覆盖以追赶 master；本包自己的 hover 规则受 hover 媒体查询约束。另在线核对 rc.5 `ui-theme/src/styles/base.css`，确认这些卡片别名和 radius token 已存在。
- 社区本地只读检出核对为 `4dab80cbeb86f706aa6fa9cc8269049aa809ccc9`。完整打开 README、SKILL.md（Establish authority and intent、Execute selected workflow）、`component-routing.md`（Build a component plan、Add Client UI、Installable external bundle、Diagnose by failed boundary）、`installable-bundle.md`（包格式/层/打包验证）、`authority-and-verification.md`（来源优先级/Client UI 证据/未完成验证），以及指定的 `runtime-dynamic.md`、`workspace-plugin.md` 和 `scripts/check-artifact.mjs`。
- 按社区规则分类为 **外部可安装 bundle**，不会因本仓库目录叫 packages 就套用 DSH 宿主 workspace 规则。Client 由现有 apply + sidebar.panellist/main 槽拥有；持久化、校验与 GitHub 权限仍由原 Host ui-service/POST 路由拥有。只调整展示消费者，不扩展公共服务、路由或写 GitHub 能力。manifest、patch 和 client external/bundle 机制保留。
- README 完整读取并应用权威 `C:/Users/Mayn/.dsh/skills/dsh-plugin-readme/SKILL.md` 的「确认事实与范围」「已有好文案保留，只修改任务要求的部分」和「版本、限制、测试说明放文末」。仅更新上限继承操作、版本、共享控件说明与验证边界。

不采用：宿主专属的 workspace compiler aggregate、invariant、Agent Note 双语副本、内部 designer 审批名册/PR GIF 流程，不适用于本次外部插件本地修正且本轮不建 PR/合并。runtime-dynamic 的 inspect/define/run 不适用，不安装该社区适配器。仍保留既有 gt- 作用域 CSS + esbuild text loader + ctx.effect 注入，而非迁移宿主 CSS Modules 构建链；控件视觉材料来自宿主 primitives，没有复制实现或新增依赖。既有在位结果/错误状态保留，未新增全局通知系统。未把静态检查或 jsdom 当作视觉验收。

### primitives 版本依据与具体使用

本机包 package.json 明确为 **0.2.1-rc.5**；实际打开其 `lib/types/index.d.ts`、Button/Input/Modal/SegmentedTabs/SegmentedControl/Checkbox/Pill/Tag/Menu/InlineEditor 的声明、`settings-form/{fields,form-model,SettingsForm}.d.ts`，对应 `lib/index.js` 组件实现及 Button/Input/Modal/SegmentedTabs/Menu/MenuSurface/Checkbox/Pill/Tag/settings-form 字段 CSS。

通过 GitHub 实际打开固定 [rc.1 index.ts](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/packages/client/ui-primitives/src/index.ts)；再分别打开同 tag 的 Button.tsx、Input.tsx、Modal.tsx、SegmentedTabs.tsx、Checkbox.tsx、Menu.tsx、Pill.tsx、Tag.tsx、settings-form/fields.tsx 与 icons/index.tsx，确认以下实际使用的导出和 props 两边均有：

- **Button**：全页、仓库卡、规则、重试、保存/取消、纠正、删除、会话入口；使用 primary / outline / ghost 和 sm / md、icon、原生表单属性。删除语义色通过局部类消费 error token，其他外观不再由自写 button 规则覆盖。
- **Input**：搜索、路径、ref、仓库地址、定时时间、本次扫描日期/上限、导出路径。使用真实 wrapper 与内部 input，不再给 wrapper 叠加一套输入框边框/填充。
- **Menu（内部委托 MenuSurface）+ Button**：分析类型、定时、结果类型、排序、纠正结论。`client-controls.tsx` 仅将 tuple 数据和表单状态接到 Menu；portal、键盘遍历、边界定位、外部点击/Escape、焦点返回均由官方实现，不另造 select/菜单。rc.5 / rc.1 无独立导出的 Select。
- **SegmentedTabs + Pill**：五档结果视图（含全部/仅预筛）使用正式 tablist/tab/tabpanel 关系、方向键/Home/End；仓库筛选使用 Pill 的 active 状态。只使用 rc.5 支持的交集 props，没有采用 rc.1 才增加的 SegmentedTabs size。
- **Tag**：结论与运行状态使用 success/warning/danger/neutral tone；替换手写徽章。
- **Checkbox**：全面扫描选项；不用原生自写 checkbox，也没有本次需要新增的 Switch 场景。
- **Modal**：仓库表单继续 headless；分析选项、删除确认继续共享 Modal（旧版整页回退本轮移除），并约束真实外层卡片宽高。菜单放到 body，避免正文滚动区裁切。
- **SettingsValueField**：普通/全量仓库上限，用真实 label、numeric、hint/invalid、override badge 和 reset。仓库已有/草稿非空值表示单独设置；「继承插件设置」只暂存空值，保存时经原 changedFields/dirty 逻辑发送 null，不触发即时写入或更改其他字段。
- **官方现有图标**：Branch/Plus/Settings/Search/Clock/ChevronDown，rc.5 声明与 rc.1 icons 导出逐个确认；展开箭头由共享 ChevronDown 旋转，不新画 SVG。图文控件使用同色/统一 16px 盒，保留文字标签，不增加需要额外 tooltip 的无名图标操作。

未采用 SettingsForm / SettingsFormModel：它们绑定 revision-fenced settings scope、mutate 路径及 discard 生命周期；现有仓库操作是独立 add/patch 协议，接它们会改变持久化语义。仅复用能真实表达上限继承的 SettingsValueField。`ConfigField` 未出现在 rc.5 primitives 的 index 导出中，不假设宿主内部同名字段可用。业务说明、纠正理由与规则文档保留原生 textarea：两版没有通用 Textarea 导出，InlineEditor 会自动聚焦、Enter 保存/Escape 取消，不符合整表保存/长文档导入；这些 textarea 只消费已核对的 DSH 主题/半像素边框/圆角/伸缩规则。

### 验证与未完成项

- Windows / Node.js **24.20.0**；测试前 PATH 前置 `C:/Program Files/Git/mingw64/bin`，未安装任何依赖。`npm run typecheck`、`npm test`：**521/521 通过，0 失败、0 跳过**。最后图标/材料调整后重新 build、typecheck 和两组 UI/renderer 测试 **34/34 通过**。
- jsdom 不再用自制 Modal/Input 替身。`test/primitives-fixture.mjs` 从已安装 rc.5 单体产物提取精确组件及依赖区域，在内存执行，绕开未使用的 Markdown/highlighter 依赖；CSS 仅用类映射、DOM 有有限适配。因此证明的是组件交互与本插件接线，不证明完整官方模块加载、图标 sprite 或视觉。真实 rc.5 renderer/slot 测试保留。
- 回归保持地址解析（HTTPS/SSH/owner/repo）、原命令、POST 路由、局部更新/显式清空、删除确认、扫描/三档筛选/详情/纠正/规则等；分析代码未改，src/github.ts 仅更新 User-Agent。新增菜单键盘选择、Escape 不关底层表单、点击外部关闭、焦点返回、卸载移除 backing、tab 焦点/panel 关系、上限继承 reset 只提交 null、保存失败保留草稿并释放 disabled。
- 已按本次用户授权运行社区只读 `check-artifact.mjs bundle .`：**PASS，0 warnings**；它只检查 manifest/patch，不是宿主运行证明。`npm run verify-pack`：**PASS，0.4.3，54 文件精确白名单**；新增 client-controls 的 JS/声明也进入白名单，primitives/React 仍为宿主 external；`git diff --check` 通过。
- `npm run ui-smoke` 已尝试。临时 web 通过启动前提，但独立 Edge 在 **CDP timeout: Page.enable** 失败，未进入插件页面，未生成 `ui.png` / `ui-form.png`。原脚本仍保留整页与长路径表单两张截图及几何检查。诊断目录：`C:/Users/Mayn/AppData/Local/Temp/dsh-github-triage-ui-artifacts-jPrsh0`。没有接触已登录 Chrome 或用户 desktop profile。
- 未验证：真实宿主亮/暗主题、390px 与断点两侧、长内容的最终几何/焦点外观、菜单边界和重叠层、图标 sprite、Electron/macOS 框架间隙、rc.1 实机页面、真实 GitHub/模型请求、长期调度。审核者需在沙箱外复跑烟测并检查这些场景；不宣称视觉验收完成。
- 清理限制：烟测报告自建进程树 PID **10764** 停止未确认，临时 home `C:/Users/Mayn/AppData/Local/Temp/dsh-github-triage-ui-home-j98KCd` 最终 rmdir **EBUSY**。随后 Get-Process 未检出该 PID；CIM 进程归属查询被拒，不能据此保证整棵进程树停止。烟测命令在报告失败后未正常结束，仍需审核者核对自建进程。
- 初始 git status 干净；验证期间 worktree 根新增 `cache.db`、`data/`、`webui/`（创建时间 15:08:18），未读取其中配置内容。这些不是提交目标。精确列举并校验路径后的清理（包括以上 TEMP home），以及再收窄到 worktree 生成物的清理，均被自动审批以 **blocked by policy** 拒绝，没有提供更具体原因，未用其他删除方式绕过。verify-pack 还使用本包 `.tmp/npm-cache`，这是本地 npm 诊断缓存，不进入发布物。审核者需清理这些验证产物；本轮无法满足「不留临时文件」这一项。

以下保留此前开发记录，其中上轮关于排除 SettingsValueField 的结论已由本节修正。


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

原 `types.ts` 的 repoName 只用正则接受 owner/repo 并转小写；`ui-contract.ts`、`config.ts`、settings 加载及路由已共用该 schema。本轮在这一入口增加 HTTP/HTTPS、www、无协议 github.com、Git SSH，处理首尾空白、.git、尾斜杠、网页子路径、查询和锚点，输出始终是小写 owner/repo。精确主机白名单拒绝子域、仿冒主机、凭据及非法字符；错误使用固定文字，不回显凭据。补齐 GitHub enrich 与纠正命令原先校验后未使用规范值的位置，仅更改地址处理，不改分析算法。

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
| `src/client/insightPage.ts` | 同 ID 的 `sidebar.panellist` list/root 与 `main` keyed/root，侧栏入口 `order:25`，中央完整页面。当前仅保留侧栏及中央页，旧版会话导航与紧凑 Modal 已于本轮移除。 |
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
| 一级侧栏页面与中央页面 | 本轮真实 rc.5 renderer 验证 main/root、sidebar/list 可用，header/session 无本插件动作；页面通过 POST 加载。 |
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

已更新 `scripts/ui-smoke.mjs`：系统 TEMP 下独立 DSH_HOME/web profile，使用现有桌面 rc.5 CLI **离线、本地路径、ignore-scripts** 安装，只启动独立无头 Edge；检查侧栏入口、无活动 agent 的中央页面、六 KPI、仓库与结果区、模型指引，再确认没有会话重复入口。加入带诊断噪声的版本行提取、失败时自建进程停止诊断与句柄释放；三个离线脚本契约测试通过。

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
- [x] 首次使用入口、必填配置、最小操作及可见结果足够具体，profile 如有要求已核实。desktop、左侧栏“GitHub 哨兵”、provider/model/modelEnabled 和首次分析步骤明确。
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
- [ui-conversation/src/client/apply.ts](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-conversation/src/client/apply.ts) 与 [contract/slots.ts](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-conversation/src/client/contract/slots.ts)：真实 **conversation.session.header.actions（list/session）**、header.utilities（list/session）、header.views.actions（list/root）、conversation.view、conversation.input.left/right/dock/overlay。此处为旧版会话接入依据；0.4.3 本轮已移除该注册，仅保留侧栏一级入口。
- [ui-session/src/client/index.ts](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-session/src/client/index.ts)：会话域标准 props/Hook、session scope 适配，不是任意业务远程方法。
- [ui-settings/src/client/contract/slots.ts](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-settings/src/client/contract/slots.ts)：有 settings.section、settings.plugins.tab、settings.action、settings.general.item；可扩展设置，旧版使用会话 remote commands；当前整页已改为 POST，不依赖会话，模型配置继续用原插件设置的 provider/model/modelEnabled。
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

在临时 profile 创建一个无提示词的空会话并命名，启动 loopback web，使用独立 Edge user-data-dir 与内置 WebSocket/CDP 选择会话，确认没有重复会话入口，并通过侧栏检查主页面、“仓库列表”、未配模型提示并截图。临时 web 的自动生成认证 URL 仅用于内存中导航，诊断剔除 URL query/hash，不输出凭据。最后关闭自建进程并校验路径位于 TEMP 后删除临时 DSH_HOME 和浏览器目录；截图、result.json 和脱敏日志留在 TEMP/dsh-github-triage-ui-artifacts-*，终端打印路径。退出码：0 通过/help，1 安装/启动/UI 检查失败，2 参数或环境前提不足，3 清理失败。

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
- [x] 明确左侧栏「GitHub 哨兵」、provider/model/modelEnabled、添加与首次分析、可见结果。
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

formatVersion:2 以及 0.1.0 状态保留仓库设置、删除标记、lastRun 和人工纠正，清除派生 cache/reports/pending，映射旧人工结论到新字段。缓存指纹另含业务内容、规则内容和模型路由。规则只供证据，业务与本地事实不替代模型独立分析；无模型/失败只预筛、不缓存。新规则或本地提交变化后重新处理，同一条目的用户纠正仍优先采用。

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
- [x] 与同类插件或现有做法的差异清楚，比较有依据且没有夸大。只比较逐条翻 GitHub 与集中分析，不宣称竞品优劣。
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
- 两次复跑结果一致（退出码 1）：侧边栏「GitHub 哨兵」入口、无活动 agent 的中央整页、6 项 KPI、仓库列表、分析结果列表、模型未配置指引均真实出现，数据经宿主 POST 路由加载成功，无错误条。
- 失败项：会话顶部快捷按钮未检出。临时 web 左栏显示「暂无会话」并弹出登录引导，种子会话未在列表出现，无法进入会话；判断为 smoke 环境未种出可见会话，而非按钮缺失。这是旧版 smoke 的结果；当前注册与回退组件已删除，改为验证会话动作缺席。
- 未验证：真实桌面 DSH（Electron）中的页面视觉与交互；DSH 0.2.2-rc.1 实机；真实 GitHub/模型长跑与定时。
- 上文列出的 TEMP 遗留目录（dsh-github-triage-ui-home-*、ui-artifacts-*）已由审核者在沙箱外清理。
