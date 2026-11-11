# dsh-github-triage

让 AI 结合你的业务说明和本地代码，判断上游问题在你这里是否存在、PR 是否适合合入或回迁，帮你决定先处理什么。

- **结合业务说明和你自己的代码来判断：** AI 不只看上游，还对照你选择的本地仓库，解释问题在你那里存不存在、修复是否已有、PR 适不适合你。
- **先看值得做的事：** issue 和 PR 都分成“建议采纳、需人工看、不推荐”，每组按优先级排列，附业务理由、本地适用性与证据；比逐条翻 GitHub 列表更方便比较。
- **第一次扫一遍，以后少做重复分析：** 第一次可以全量扫一遍（可限时间范围和条数），之后定时只看新增和有变化的内容，复用已有结论。
- **把纠正变成下次的参考：** 你纠正过的结论会沉淀成规则，以后自动参考，可导出编辑，再导入继续用。

## 示例输出

以下仓库、编号和内容均为虚构示意；不是已经验证的研判结果。

```text
/triage-repo add example-team/plugin-kit --business "插件框架，优先保障文件变化后能正确重载" --local "C:\work\my-plugin-kit"
/triage example-team/plugin-kit --full --since 2026-01-01 --max 100
```

示意输出（节选，省略原链接与部分证据）：

```text
GitHub 仓库研判 · example-team/plugin-kit
业务说明：已使用（内联文本，0.1KB）
本地仓库对照：HEAD @ 0123456789ab（已提交代码）

建议采纳
#42 连续写入后插件没有重新加载
建议采纳 · 优先级：高
本地适用性：present · 本地 src/watcher.ts 存在对应函数，暂未找到修复线索。
高 · bug · 真实存在：likely · 值得修
结合业务：正确重载是核心流程，建议先核实这个问题。
描述与代码片段中的事件合并逻辑相符，尚未实际复现。

需人工看
#43 调整目录变化事件分类
需人工看 · 优先级：中
本地适用性：unclear · 本地事件层已有调整，需核对架构差异。
改完再合 · 符合业务方向：yes · 风险：中
测试：需补目录替换后连续写入的回归场景。
结合业务：方向符合，但现有测试不足以确认不会漏掉真正的文件变化。

不推荐
#44 修正重复的监听器清理
不推荐 · 优先级：低
本地适用性：already-fixed · 本地历史已包含该上游修复提交。
不建议合 · 符合业务方向：yes · 风险：低
测试：仍需确认本地已有修复的回归覆盖。
结合业务：问题重要，但当前版本已处理，无需重复回迁。
```

`adopt` 对应“建议采纳”（issue 值得修，PR 值得合入或回迁），`manual-review` 对应“需人工看”，`not-recommended` 对应“不推荐”。`likely` 表示较可能存在；`present`、`already-fixed`、`not-applicable`、`unclear` 分别表示本地存在、已有修复、不适用、证据不清楚。本地未配置时卡片明确注明“未配置本地仓库对照”。AI 结论不能代替复现与代码审查。

## 3 步快速上手

1. **完全退出桌面 DSH。** 关闭所有窗口，并从系统托盘退出 DSH，确认已完全关闭后再安装或更新。

2. **在终端安装插件。** 用桌面版自带的命令行（PowerShell），包内已带编译文件，安装时无需构建。

   ```powershell
   & "$env:LOCALAPPDATA\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop add "github:hzopc1031/dsh-plugins#main&path:/packages/dsh-github-triage"
   ```

3. **重开 DSH，配置并运行一次。** 在插件设置找到 **GitHub 仓库研判（dsh-github-triage）** 并启用；先在 DSH 模型设置配置服务商，再在会话运行 `/triage-models`，把输出的 `provider`、`model` 分别填入插件同名字段，启用 `modelEnabled`。这里填准确 ID，不填 API key，也不把 `provider/model` 整串填入 `model`。目录为空时到 DSH 模型设置查 ID。

   添加上游仓库与业务说明：

   ```text
   /triage-repo add owner/repo --both --business "插件框架，优先处理生命周期异常与依赖隔离失效"
   ```

   **可选：配置本地仓库对照。** 换成你自己的仓库绝对路径，需已安装 Git；只读取选定分支或提交，默认当前 HEAD，不切分支、不拉取远程、不读取未提交修改。业务文字与相关代码片段会送给所选模型服务商，请只选择愿意发送的内容。

   ```text
   /triage-repo local owner/repo "C:\work\my-repo" --ref main
   ```

   先少量试跑，看到按三档分组的卡片、理由、证据和原链接即完成首次使用：

   ```text
   /triage owner/repo --limit 6
   ```

   公开仓库可匿名读取，但额度较低；私有仓库需要 DSH 启动环境中的 `GH_TOKEN` / `GITHUB_TOKEN`，或本机 GitHub CLI（`gh`）已有相应读取权限的登录。插件没有令牌填写项。模型不可用、禁用或输出无效时只展示“仅规则预筛，未经 AI 研判”，不缓存为已研判结论。

## 日常使用

### 先全量扫，再定时看变化

```text
/triage owner/repo --full --since 2026-01-01 --until 2026-11-11 --max 100
/triage-repo add owner/repo --both --daily 09:30 --limit 20 --business "核心业务说明" --local "C:\work\my-repo"
```

全量扫描包括开放与已关闭的 issue/PR，按**最后更新时间**筛选，日期首尾均包含；不填日期就不限制时间。`--max` 为两者合计上限，默认 100、最大 500。超过上限只取最近更新的，并提示你缩小时间范围；搜索结果不完整时也会提示。因此“全量”是扫描范围，不保证超过上限的历史全部读完。暂不支持 `--from-tag` / `--to-tag`：提交标签区间不能可靠表示 issue/PR 范围。

全量扫描会增加 GitHub 请求和模型费用。建议先用小条数与时间范围试跑；遇到 GitHub 限流时等待后重试，插件不会绕过限流或自动追完所有历史。

之后定时只看开放条目最近窗口里的新增和变化；未变且已有结论的直接复用。`--daily HH:MM` 按本机时间，或用 `--every 6` 每 6 小时检查；两者二选一，都不填则仅手动运行。定时需要 DSH 和插件持续运行，有变化才发简报。

再次 `add` 会替换该仓库**全部设置**，请一并写上要保留的业务、本地、规则和定时设置。全量扫描不改变定时模式。

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

当前版本 **0.2.0**，尚未发布 npm，面向 **DeepSeek Harness 0.2.1-rc.5**，要求 Node.js 22 或以上；本地对照需要 PATH 中可用的 Git。开发验证环境为 Windows / Node.js 24，其他平台与 Node.js 22 实机尚未验证。未发布改动合入 main 前，上面的 main 安装地址仍指向现有 main 内容。

### 只读边界与证据局限

- 绝不自动改代码、推送、创建 PR、评论、改标签、关闭问题、合并或向 GitHub 写入任何内容。不会 checkout、fetch 或修改本地工作区。回迁执行（自动打补丁/建分支）暂不做。
- 本地对照使用 Node 官方 `child_process.execFile('git', 固定参数数组, { shell:false })`；没有新增或猜测 DSH 服务接口。代码只接受 `rev-parse`、`ls-tree`、`cat-file`、`show`、`log`、`merge-base`、`patch-id` 的限定参数形状；其他命令及额外参数均拒绝。关闭可选锁、外部 diff/textconv、hooks、fsmonitor 与缺失对象自动获取；不主动启动网络操作。
- 本地读取选定 ref 的**已提交快照**。每条最多检查 3 个文件，每文件片段最多 3KB，源 blob 超过 64KB 跳过，总本地上下文最多 16KB。不会跟随代码中的符号链接去读取目标。历史取最近 80 条，查 issue 号、标题关键词和上游修复提交信息；用提交包含关系及完整简单文本 diff 的稳定 patch-id 寻找已合入/回迁线索。浅克隆、旧修复、重命名、二进制、截断 patch、架构改变都可能缺证据；“没找到”不能证明问题不存在或没有修复。
- 关联修复 PR 搜索最多看 5 个候选，只接受正文明确关闭该 issue 的已合入 PR，最多 2 个；每个 PR 最多读 100 个提交。Git 每次最多 5 秒、输出最多 256KB（正文读取更小），超时、取消、超限都停止并提示，证据不足由模型标注 `unclear`。
- 上游相关文件来自默认分支，每条最多 3 个片段、每片段 3KB；PR patch 与模型上下文均有界，不是完整代码审查。AI 不运行测试或复现，不保证适用性判断正确。
- 业务说明送模型最多 8KB，整个请求最多 48KB，超出会删减并提示。每条最多一次模型生成，45 秒超时、1800 tokens 输出上限；模型失败只展示证据，不写已研判缓存。仓库内容、业务、本地代码、规则和纠正参考会发送给所选模型服务商；模型无工具，输入都当作不可信数据。已知 GitHub 令牌会脱敏，但任意机密无法自动识别。
- GitHub 凭据按 `GH_TOKEN` → `GITHUB_TOKEN` → 固定参数的 `gh auth token` → 匿名读取，只在内存用于请求头，不写报告、不送模型、不读 DSH 密钥文件。请求固定 GitHub API、仅 GET、拒绝重定向，20 秒超时；限流遵守响应头，支持 `HTTP_PROXY` / `HTTPS_PROXY` / `NO_PROXY`。

### 调度、缓存和真实宿主接口

沿用 rc.5 的 `llm.stream`、`llm.listProviders()` / `llm.listModels(provider)`、`commands.register` 文本卡片及 `storageDomain` 自身存储域。接口依据固定 [DSH dsh-v0.2.1-rc.5](https://github.com/deepseek-ai/deepseek-harness/tree/dsh-v0.2.1-rc.5/packages/preset/agent-preset/skills/cordis-plugin-development)。全量扫描采用 [GitHub 只读搜索 API](https://docs.github.com/en/rest/search/search#search-issues-and-pull-requests)，受搜索索引、结果完整性和限流约束。

内部计时器每 30 秒检查一次，重启只补最近一轮；不借会话调度服务执行任意回调。发现变化才投递简报，无可用会话先保存，异常中断仍可能重复投递。没有 webhook 或独立后台服务。

缓存指纹包括条目更新时间、PR head、模型设置、业务内容、本地路径及解析后的提交、规则内容；最多 5000 条。规则、业务或本地 ref 提交变化后重新处理。旧结论结构自动清除派生缓存、报告与待发简报，保留设置和用户纠正。CI 或上游相关代码独立变化可能不改变条目时间，不能单独触发重判。用户对同一条目的纠正会持续优先采用，业务或本地代码变化后需留意这条旧纠正是否仍适合。

### 验证范围

自动测试覆盖真实临时 Git 仓库、只读白名单、边界、三档分组、全量参数/分页、规则文件、模型失败与缓存迁移；另用独立临时 rc.5 profile 验证命令、持久化和重载。`verify-pack` 核对预构建 lib 与发布文件白名单。真实 GitHub smoke 和未测项见 [STATUS.md](STATUS.md)；模拟模型只验证流程和格式，不代表真实 AI 判断质量。用户桌面安装、Electron 渲染、真实模型请求与长期调度未验证。

### 来源与许可

原创实现，使用 [MIT 许可](LICENSE)。参考了 [dsh-github-flow](https://github.com/ItQianChen/dsh-github-flow)（MIT）的凭据复用与证据组织思路，以及 [dsh-github-bot](https://github.com/PerryLink/dsh-github-bot)（Apache-2.0）的有界拉取、轮询与 PR/CI 证据思路，未直接移植代码。详见 [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES)。
