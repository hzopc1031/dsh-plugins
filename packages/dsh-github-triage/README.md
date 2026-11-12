# GitHub 哨兵

打开侧边栏「GitHub 哨兵」，把多个仓库的待办、业务判断和本地代码对照放在一起，决定先修哪些问题、先审哪些 PR。

- **不必为管理仓库新开会话：** 侧边栏进入完整页面，概览仓库数、待办和三档结论；用卡片管理本地路径、分支和定时，只保存你编辑的字段。
- **按自己的业务看问题：** 相比逐条翻 GitHub，集中查看“在我这里是否存在、值不值得修、是否符合业务方向”，附本地对照和证据。
- **先看值得处理的内容：** 按「建议采纳 / 需人工看 / 不推荐」、issue/PR 和仓库筛选，搜索标题与业务理由，展开详情后查看证据或打开原链接。
- **把纠正留给下次参考：** 在详情中改结论并填写理由，形成仓库规则；在同一页面复制、导出新文件或导入编辑后的规则。

## 打开界面后的示例

主入口是与「插件」「自动化任务」同级的侧边栏 **GitHub 哨兵** 页面。点击「添加仓库」，填写业务和本地路径后「保存仓库」，再点「立即分析」。会话顶部保留同名快捷按钮，直接打开这个页面。

以下是虚构内容的**示意输出**，不是桌面截图或真实 AI 研判：

```text
GitHub 哨兵
模型：已配置 · provider：my-route · model：my-model
跟踪仓库 1    待处理条目 2    建议采纳 1    需人工看 1    不推荐 0

example-team/plugin-kit · 两者 · 每天 09:30
业务：插件框架，优先保障文件变化后正确重载
本地：C:\work\my-plugin-kit · main
[编辑] [删除] [查看结果] [查看/导出规则] [立即分析]

建议采纳（1）
#42 连续写入后插件没有重新加载 · issue
真实存在：likely · 值得修 · 优先级：高
结合业务：正确重载是核心流程，需要优先核实。
本地适用性：present · 本地 watcher 函数存在，尚未实际复现。
[查看详情与纠正]

需人工看（1）
#43 调整目录变化事件分类 · PR
改完再合 · 符合业务方向：yes · 风险：中
测试：需补目录替换后连续写入的回归场景。
```

「建议采纳」表示 issue 值得修或 PR 值得合入/回迁；「需人工看」表示还需补证据或调整；「不推荐」表示当前不值得处理。`likely` 是较可能存在；本地 `present / already-fixed / not-applicable / unclear` 分别表示存在、已有修复、不适用、证据不清楚。AI 不能替代复现与代码审查。模型不可用时明确显示「仅规则预筛，未经 AI 研判」。

## 3 步快速上手

1. **完全退出桌面 DSH（含托盘）。** 关闭所有窗口，并从系统托盘退出 DSH，确认完全关闭后再安装或更新。

2. **在 PowerShell 安装或更新插件。** 使用桌面版自带 CLI：

   ```powershell
   & "$env:LOCALAPPDATA\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop add "github:hzopc1031/dsh-plugins#main&path:/packages/dsh-github-triage"
   ```

3. **重开 DSH，配置后得到第一份结果。** 在插件设置找到 **GitHub 哨兵（dsh-github-triage）** 并启用。先在 DSH 模型设置配置服务商，再点击侧边栏 **GitHub 哨兵** → 模型状态胶囊 → **查看可复制的模型 ID**，用页面的 **插件设置** 按钮打开设置，将 `provider`、`model` 分别填入同名字段，并启用 `modelEnabled`。这里填准确 ID，不填 API key；目录为空时去 DSH 模型设置查 ID。页面会显示当前路由和配置指引，无需活动会话或 agent。

   在面板点 **添加仓库**，填 `owner/repo`、分析类型和业务说明；按需填写本地 Git 仓库绝对路径和 ref（空为 HEAD）、业务文件、定时和单次上限。点 **保存仓库**，先用小上限（例如 6）点 **立即分析**；按钮会显示排队/进行中，完成后在三档结果中展开 **查看详情与纠正**。

   本地对照只读选定 ref 的已提交快照，不读取未提交修改。业务文字、规则与相关代码片段会交给所选模型服务商，只选择愿意发送的内容。公开仓库可匿名读取；私有仓库需启动环境已有 `GH_TOKEN` / `GITHUB_TOKEN` 或 GitHub CLI（`gh`）读取权限，界面不提供凭据填写项。

## 在界面中日常使用

- **改仓库配置：** 点对应仓库「编辑」。仓库名固定，需要换仓库时添加新条目。编辑仅提交变化字段；清空可选字段表示清除，留空的单次上限继承全局值。服务端还会检查本地路径是 Git 根目录、ref 可解析，失败不保存。
- **自动检查：** 定时可选不定时、每天 HH:MM、每 N 小时。每天按本机时间执行，DSH 和插件需持续运行；定时仍只检查开放条目的新增和变化。
- **手动分析：** 仓库卡点「立即分析」，或在页头点「全部分析」。点「分析选项」可改本次上限；点「全量扫描」可填最后更新时间的开始/结束日期及全量上限。全量含关闭条目，达到上限会截断并提示，会增加请求和模型费用。与命令、定时共用串行队列，同仓库的界面任务未结束时不会重复入队；离开页面后任务继续，重开可查状态。
- **看业务结论：** 结果区用结论分段、issue/PR 类型、仓库 chip 和搜索一起缩小范围，可按优先级、最近分析或编号排序。点击标题或「查看详情与纠正」按需读取业务理由、证据、本地对照；原链接在每张卡上。未经 AI 研判的条目单独标注，不混入三档。「待处理条目」统计最新报告中的全部条目，不代表 GitHub 当前开放总数。
- **纠正并留规则：** 在已有 AI 结论的详情中选三档、填理由并提交；等同 `/triage-fix`。点「查看/导出规则」可复制文档，或填新绝对路径导出（不覆盖）。展开「导入规则」，粘贴编辑后的同仓库文档并点「确认导入规则」；也可继续用下方命令导入文件。
- **停止跟踪：** 点「删除」再「确认删除」。不再调度该仓库，保留历史报告和纠正。

## 命令补充

原有命令全部保留：`/triage`、`/triage-repo`、`/triage-fix`、`/triage-report`、`/triage-models`、`/triage-rules` 及结构化 `/triage-ui`。界面配置和命令共用插件自身存储；以下用于批量操作或在会话中补充管理。

### 先全量扫，再定时看变化

```text
/triage owner/repo --full --since 2026-01-01 --until 2026-11-11 --max 100
/triage-repo add owner/repo --both --daily 09:30 --limit 20 --business "核心业务说明" --local "C:\work\my-repo"
```

全量扫描包括开放与已关闭的 issue/PR，按**最后更新时间**筛选，日期首尾均包含；不填日期就不限制时间。`--max` 为两者合计上限，默认 100、最大 500。超过上限只取最近更新的，并提示你缩小时间范围；搜索结果不完整时也会提示。因此“全量”是扫描范围，不保证超过上限的历史全部读完。暂不支持 `--from-tag` / `--to-tag`：提交标签区间不能可靠表示 issue/PR 范围。

全量扫描会增加 GitHub 请求和模型费用。建议先用小条数与时间范围试跑；遇到 GitHub 限流时等待后重试，插件不会绕过限流或自动追完所有历史。

之后定时只看开放条目最近窗口里的新增和变化；未变且已有结论的直接复用。`--daily HH:MM` 按本机时间，或用 `--every 6` 每 6 小时检查；两者二选一，都不填则仅手动运行。定时需要 DSH 和插件持续运行，有变化才发简报。

再次 `add` 同一仓库只合并本次明确提供的字段，不再清除其他业务、本地、规则、类型或定时设置；原命令语法兼容。要清除定时或可选字段可在界面编辑。全量扫描不改变定时模式。

普通 `/triage [owner/repo] [--limit N]` 上限为 1–100，默认 20；全量模式使用 `--max`，不能与 `--limit` 混用。命令上限优先于仓库 `limit` / `fullMax`，再优先于全局同名配置。不带仓库处理全部已配置仓库，临时指定仓库则可直接运行；最多配置 50 个仓库。

### 更换或清除本地对照

```text
/triage-repo local owner/repo "C:\work\my fork" --ref release
/triage-repo local owner/repo --clear
```

这两条保留其他设置。也可以添加时写 `--local "C:\work\my fork" --ref release`。路径必须是存在的本地 Git 仓库根目录，且选定 ref 能解析为提交；拒绝 UNC、设备路径、备用数据流和相对路径，不展开 `~` 或环境变量。无效命令设置不会保存；静态配置失效时报告会显示对照失败。

### 补充业务说明

```text
/triage-repo business owner/repo "新的业务方向：优先保障认证与会话隔离"
/triage-repo business owner/repo --file "C:\my docs\business.md"
/triage-repo business owner/repo --clear
```

分别设置文字、设置文件、清除说明，并保留其他设置。设置文字或文件会替换原有两项业务设置。`add` 可用 `--business` / `--business-file`，同时提供则合并。文件相对路径读取 GitHub 默认分支，绝对路径只读本机 UTF-8 普通文件，最多 16KB。文件失败仍可使用内联文字；没有可用说明时模型理由注明“未提供业务说明，按通用标准判断”。

### 纠正结论，导出编辑规则

```text
/triage-fix owner/repo#123 not-recommended 本地没有这个模块，不需要回迁
/triage-rules owner/repo
/triage-rules export owner/repo "C:\work\triage-rules.md"
/triage-rules import owner/repo "C:\work\triage-rules.md"
```

先取得条目的 AI 结论，再用 `adopt` / `manual-review` / `not-recommended` 纠正。保留旧写法：issue 可改 `bug`、`需求`、`提问`、`重复`、`无效` 或 `值得修`、`待补充`、`不值得修`；PR 可改 `值得合并`、`改完再合`、`不建议合`。旧写法会同步映射三档建议；新三档也会同步对应的修复/合入价值字段。

纠正、当时的业务说明会形成仓库级 Markdown 规则，保存在插件自己的存储中。同一条目优先采用用户纠正；后续其他条目由模型参考这些规则，规则不会自动变成确定事实。查看、导出时能读到业务背景、纠正理由及最终建议；可以编辑规则后导入，必须保留第一行的仓库标识。导入不是批量修改历史卡片；要修改某条已有用户结论，仍用 `/triage-fix`。

**导出是插件唯一主动写入用户指定本地文件的功能**（自身状态仍由宿主存储管理）。只写你在命令中指定的绝对路径，不自动创建目录；默认拒绝覆盖已有文件，确需替换加 `--force`，仍拒绝链接和特殊文件。导入仅读取，不修改源文件。文件须为 UTF-8，最多 16KB。

也可在仓库配置填 `rulesFile`，或 `add` 时用 `--rules-file "C:\work\my-rules.md"`，每轮只读该外部文件；它可写普通 Markdown，无需导入格式头。规则会送给模型，合计最多 8KB，超过会截断并提示；外部文件与内部规则并用时各取约 4KB。最新纠正优先纳入，较长历史可能被截断。

### 看报告或停止跟踪

```text
/triage-repo list
/triage-report owner/repo
/triage-repo remove owner/repo
```

`/triage-report` 不重新分析，不带仓库则看全部最近报告。`remove` 屏蔽静态配置中的同名仓库，再次 `add` 可恢复。命令设置只保存在插件自身存储中，优先于静态配置，不修改全局配置。

### 用配置统一管理

```yaml
modelEnabled: true
provider: "my-route"  # 换成 /triage-models 列出的 provider
model: "my-model"    # 换成对应的 model ID
limit: 20
fullMax: 100
repositories:
  - repo: owner/repo
    mode: both
    business: "企业登录服务，认证与会话隔离是核心业务"
    businessFile: docs/business.md
    localRepoPath: 'C:\work\my-repo'
    localRef: main
    rulesFile: 'C:\work\my-rules.md'
    daily: "09:30"
    limit: 20
    fullMax: 200
```

`mode` 为 `issues`、`prs`、`both`。定时配置的 `daily` 与 `everyHours` 二选一，都不设置则仅手动运行。本地路径、ref、规则文件均可选；`localRef` 默认 HEAD。命令添加时可用 `--full-max 200` 设置仓库的全量默认上限。

## 补充说明

### 版本与兼容

当前版本 **0.4.0**，尚未发布 npm。开发基线为 **DeepSeek Harness 0.2.1-rc.5**，并对照 **0.2.2-rc.1** 的页面与连接接口源码，要求 Node.js 22 或以上；本地对照需要 PATH 中可用的 Git。开发验证环境为 Windows / Node.js 24，其他平台与 Node.js 22 实机尚未验证。未发布改动合入 main 前，上面的 main 安装地址仍指向现有 main 内容。

### 只读边界与证据局限

- 绝不自动改代码、推送、创建 PR、评论、改标签、关闭问题、合并或向 GitHub 写入任何内容。不会 checkout、fetch 或修改本地工作区。回迁执行（自动打补丁/建分支）暂不做。
- 本地对照使用 Node 官方 `child_process.execFile('git', 固定参数数组, { shell:false })`；没有新增或猜测 DSH 服务接口。代码只接受 `rev-parse`、`ls-tree`、`cat-file`、`show`、`log`、`merge-base`、`patch-id` 的限定参数形状；其他命令及额外参数均拒绝。关闭可选锁、外部 diff/textconv、hooks、fsmonitor 与缺失对象自动获取；不主动启动网络操作。
- 本地读取选定 ref 的**已提交快照**。每条最多检查 3 个文件，每文件片段最多 3KB，源 blob 超过 64KB 跳过，总本地上下文最多 16KB。不会跟随代码中的符号链接去读取目标。历史取最近 80 条，查 issue 号、标题关键词和上游修复提交信息；用提交包含关系及完整简单文本 diff 的稳定 patch-id 寻找已合入/回迁线索。浅克隆、旧修复、重命名、二进制、截断 patch、架构改变都可能缺证据；“没找到”不能证明问题不存在或没有修复。
- 关联修复 PR 搜索最多看 5 个候选，只接受正文明确关闭该 issue 的已合入 PR，最多 2 个；每个 PR 最多读 100 个提交。Git 每次最多 5 秒、输出最多 256KB（正文读取更小），超时、取消、超限都停止并提示，证据不足由模型标注 `unclear`。
- 上游相关文件来自默认分支，每条最多 3 个片段、每片段 3KB；PR patch 与模型上下文均有界，不是完整代码审查。AI 不运行测试或复现，不保证适用性判断正确。
- 业务说明送模型最多 8KB，整个请求最多 48KB，超出会删减并提示。每条最多一次模型生成，45 秒超时、1800 tokens 输出上限；模型失败只展示证据，不写已研判缓存。仓库内容、业务、本地代码、规则和纠正参考会发送给所选模型服务商；模型无工具，输入都当作不可信数据。已知 GitHub 令牌会脱敏，但任意机密无法自动识别。
- GitHub 凭据按 `GH_TOKEN` → `GITHUB_TOKEN` → 固定参数的 `gh auth token` → 匿名读取，只在内存用于请求头，不写报告、不送模型、不读 DSH 密钥文件。请求固定 GitHub API、仅 GET、拒绝重定向，20 秒超时；限流遵守响应头，支持 `HTTP_PROXY` / `HTTPS_PROXY` / `NO_PROXY`。

### 调度、缓存和真实宿主接口

界面参考 dsh-context 的侧边栏与中央页面组合、设计令牌、卡片层级及按需读取方式，保留本仓库 lazy-CJS 打包。`sidebar.panellist` 与 `main` 使用相同 ID；会话顶部快捷按钮调用宿主布局服务打开同一页面。表单使用宿主共享 Modal。

主页面通过宿主 `connection.fetch.register` 注册的 POST 路由获取数据，不依赖活动 agent，不把页面操作写入会话命令日志；沿用宿主认证，没有新增监听端口或凭据项。首次只取结果摘要，展开单项再读完整证据，规则按需读取，列表按批挂载；离开页面释放轮询与详情。仅宿主缺少布局服务时，顶部入口才回退为同组件的紧凑 Modal；仅 POST 返回 404/405 时，该会话入口的旧命令适配器才回退 `/triage-ui`，这时结果仍会记入会话日志。认证失败、网络超时、返回数据错误均不会自动重提操作。

沿用 rc.5 的 `llm.stream`、`llm.listProviders()` / `llm.listModels(provider)`、`commands.register` 文本卡片及 `storageDomain` 自身存储域。接口依据固定 [DSH dsh-v0.2.1-rc.5](https://github.com/deepseek-ai/deepseek-harness/tree/dsh-v0.2.1-rc.5/packages/preset/agent-preset/skills/cordis-plugin-development)。全量扫描采用 [GitHub 只读搜索 API](https://docs.github.com/en/rest/search/search#search-issues-and-pull-requests)，受搜索索引、结果完整性和限流约束。

内部计时器每 30 秒检查一次，重启只补最近一轮；不借会话调度服务执行任意回调。发现变化才投递简报，无可用会话先保存，异常中断仍可能重复投递。没有 webhook 或独立后台服务。

缓存指纹包括条目更新时间、PR head、模型设置、业务内容、本地路径及解析后的提交、规则内容；最多 5000 条。规则、业务或本地 ref 提交变化后重新处理。旧结论结构自动清除派生缓存、报告与待发简报，保留设置和用户纠正。CI 或上游相关代码独立变化可能不改变条目时间，不能单独触发重判。用户对同一条目的纠正会持续优先采用，业务或本地代码变化后需留意这条旧纠正是否仍适合。

### 验证范围

自动测试覆盖界面组件、字段 patch、队列状态和数据接口，使用 jsdom 加载本插件的预构建 bundle；另加载官方 rc.5 renderer 验证插槽注册与会话域渲染。组件测试的 Modal 使用 DOM 替身，官方共享 Modal 的参数另由 rc.5 类型声明校验，不能据此声称桌面弹窗已实测。

原测试继续覆盖真实临时 Git 仓库、只读白名单、三档、全量分页、规则文件、模型失败与缓存迁移；独立临时 rc.5 profile 验证命令、持久化、重载及 client 入口扫描。`verify-pack` 核对预构建 lib 与发布文件白名单。全部自动测试与构建结果见 [STATUS.md](STATUS.md)。

沙箱外可在本包目录执行 `node scripts/ui-smoke.mjs`（已有 Node ≥22、桌面自带 rc.5 CLI 与系统 Edge），也可运行 `--help` 查看路径参数和退出码。它通过桌面 CLI 将本包本地路径离线装入系统 TEMP 下的临时 web profile，使用独立无头 Edge，检查侧边栏、无活动 agent 的中央页面、KPI、仓库/结果区和会话快捷按钮，并保存截图与脱敏诊断，退出清理临时 DSH_HOME。实际执行结果与未验证项见 [STATUS.md](STATUS.md)。Electron、真实模型请求与长期调度仍需实机验证。

### 来源与许可

原创实现，使用 [MIT 许可](LICENSE)。界面与数据交互方式参考 [dsh-context](https://github.com/bowenliang123/dsh-context)（Apache-2.0）；另参考 [dsh-github-flow](https://github.com/ItQianChen/dsh-github-flow)（MIT）的凭据复用与证据组织思路，以及 [dsh-github-bot](https://github.com/PerryLink/dsh-github-bot)（Apache-2.0）的有界拉取、轮询与 PR/CI 证据思路，未直接移植代码。详见 [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES)。


### 兼容性范围

本版声明 DSH `>=0.2.1-rc.5 <0.3.0-0`。官方版本检查使用 `semver.satisfies` 并开启 `includePrerelease`：接纳 0.2.1-rc.5、0.2.2-rc.1 及后续 0.2.x 预发布/正式版，排除 0.3.0（含预发布）。DSH peer 显式覆盖两个已知 RC，Cordis / Schemastery peer 覆盖两个官方 tag 的版本；开发依赖不变。此次没有安装到用户 DSH；准入通过不等于逐版本功能或界面验证通过。

校验逻辑、源码对照与本次检查结果见[兼容性报告](../../docs/engines-compatibility.md)。
