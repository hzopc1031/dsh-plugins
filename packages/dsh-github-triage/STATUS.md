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
