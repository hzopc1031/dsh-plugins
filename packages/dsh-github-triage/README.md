# dsh-github-triage

GitHub 仓库 issue / PR **只读自动研判**，适用于 DeepSeek Harness **0.2.1-rc.5**。默认仓库清单为空。手动或在 DSH 运行期间定时检查，先用规则整理证据，再可选调用 DSH 自身的模型做最终判断；没有可用模型也能运行。

issue 输出 bug / 需求 / 提问 / 重复 / 无效、真问题状态、修复价值、影响/严重度/成本、优先级与理由。PR 输出值得合并 / 改完再合 / 不建议合、风险、测试、CI、关联 issue 和敏感文件证据。结果按风险与优先级排列，理由、证据和原链接附在会话命令卡片中。

## 安装

先**完全退出桌面版 DSH（含托盘）**，再在 PowerShell 运行：

```powershell
& "$env:LOCALAPPDATA\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop add "github:hzopc1031/dsh-plugins#main&path:/packages/dsh-github-triage"
```

安装后重启。此地址须等本包由维护者提交、推送并合入 main 后才可用；本次没有执行提交、推送或 npm 发布。包内包含预构建 lib/、index.js 和 bundle patch，无安装期编译脚本。

## 命令

注册给 rc.5 的命令名不带斜杠；用户在 DSH 输入时带斜杠：

```text
/triage-repo add owner/repo --both --daily 09:30
/triage-repo add owner/another --prs --every 6 --limit 10
/triage-repo add owner/issues-only --issues
/triage-repo remove owner/repo
/triage-repo list
/triage owner/repo --limit 5
/triage
/triage-report owner/repo
/triage-report
/triage-fix owner/repo#123 不值得修 已由其他模块解决
/triage-fix owner/repo#456 改完再合 先补回归测试
```

- add 可选 --issues / --prs / --both（默认 both），--daily HH:MM / --every N（二选一，N 为小时，最小 0.001），--limit N（1–100）。不指定调度时仅手动运行。再次 add 替换该仓库的设置。
- /triage 无仓库参数时处理全部已配置仓库；带仓库可临时运行，无须加入清单。--limit 同时限制本次获取候选与分析总数，issues/PR 合计，默认 20。仓库配置可覆盖全局值。
- /triage-report 显示最近一次窗口内的完整结果，包括缓存复用项。
- /triage-fix 先要求条目已被拉取。issue 可纠正类型（bug、需求、提问、重复、无效）或价值（值得修、待补充、不值得修）；PR 可纠正三种合并结论。可附理由。同一条目后续更新也直接采用纠正；同仓库同种条目的最近 8 条纠正作为模型参考。每个条目持久保留最新一次纠正。
- 命令增删数据写插件独立存储域，不改 DSH 全局配置。remove 也能屏蔽静态配置中的仓库；再次 add 恢复。报告和纠正仍保留。

## 配置

在插件配置中设置。首次安装相当于 repositories: []，不会自行选择仓库、调用 GitHub 或模型。

```yaml
repositories: []
limit: 20
modelEnabled: true
provider: ""
model: ""
```

需要静态仓库时可将 repositories 改为：

```yaml
repositories:
  - repo: owner/repo
    mode: both
    daily: "09:30"
  - repo: owner/another
    mode: prs
    everyHours: 6
    limit: 10
limit: 20
modelEnabled: true
provider: ""   # 填 DSH 中已经注册的 provider route ID
model: ""      # 填该 route 的模型 ID；不是 API key
```

daily 与 everyHours 二选一，均不设置则不定时。最多 50 个仓库。命令保存的配置优先于静态仓库设置，删除标记优先级最高。

## 模型、展示和调度

模型走官方 @deepseek-ai/dsh-llm 的 ctx.llm.stream({ provider, model, system, messages, tools: [], signal })。provider/model 显式选择已有 DSH route，凭据完全由宿主适配器处理；插件不会读取任何 DSH 密钥文件，也不接收 API key。空 route、服务缺失、调用失败或超时均回退规则；默认空 route 因而使用纯规则。此版本不会自动推断当前会话的模型选择。

每个新增/更新条目最多一次模型调用，45 秒超时，输出严格 JSON。接受完整 JSON 或 JSON 代码块，缺字段/多字段/枚举错误/畸形 JSON 都回退，并标“模型不可用”或“模型解析失败”。模型证据与规则证据合并，不能抹掉敏感文件标记或直接放行规则阻塞项。仓库正文和 diff 视为不可信数据；模型没有任何工具。纠正记录只代表用户意见，不作为已验证事实。

展示沿用 heartbeat-monitor / task-review：ctx.commands.register() 返回 CommandResult.text，经 command/run、command/done 进入会话命令卡片。理由、证据直接附在卡片文字中，用命令查看/纠正；没有单独的展开按钮、webview 或自定义面板。rc.5 实际有 browser factory + UI slots 扩展机制，本包选择共享命令展示路径，未实现专用前端。渲染效果以桌面宿主为准。

rc.5 有面向会话提醒的 schedule 服务（daily/every/cron 等），会将 prompt 交给会话处理，不是任意插件 callback scheduler。本包用 ctx.effect 拥有的原生 setInterval（每 30 秒检查一次）和启动 setTimeout 执行自己的只读流水线；卸载时取消请求、清除计时器并关闭存储域。纯函数 dueSlot(schedule, lastRun, now) 可注入时钟。

只在 **DSH 运行且插件已加载**时调度，本地时区按进程 Date 解释。成功后持久化上次运行时间；启动时把错过的多次合并补跑一次。首次启用调度也立即补跑最近一轮；随后等待下一次。不会因短时轮询重复触发。失败不推进成功时间，通常 5 分钟后重试；GitHub 限流按响应头延后。间隔按上次成功运行开始时间计算，长任务可造成漂移，30 秒检查精度不是实时保证。

定时任务在有新增/更新或首次发现仓库功能关闭时生成简报，经 ctx.commands.execute() 推到最近可用的根会话。没有可用会话时持久化待发简报，下次会话创建/轮询再投递；同仓库只保留最新待发简报。无新增/更新且功能关闭提示与上次相同时不推送。默认不发送操作系统通知。并发操作串行化，避免手动研判、定时和纠正互相覆盖。

数据通过官方 storageDomain.open() 写 github_triage 独立域，由宿主 storage-domain 的 backend/routes 决定位置（JSON 后端位于其配置 root 下的 github_triage.json，其他后端遵循宿主布局）。插件不猜测桌面安装路径，不读取会话密钥文件，不修改全局 cordis.yml。最多缓存 5000 条派生结论。

## 拉取、增量和规则边界

- 每轮先 GET /repos/{owner}/{repo} 读取 has_issues / has_pull_requests。仅显式 false 表示关闭，字段缺失视为开启；关闭时跳过对应列表（及已关闭 Issues 的关联 issue 拉取），在报告和简报中明确提示“该仓库已关闭 Issues/PR 功能”。首次发现关闭即使没有条目也生成一次简报，同样的关闭状态后续保持静默；元数据请求本身失败仍报告真实错误。
- 仅开放 issues/PR，按最近更新时间取有界窗口；issues 用 GitHub search/issues，PR 用 pulls，最多获取指定 N 条各类型候选，再按更新时间截为合计 N 条。大仓库首次也只分析最近 N 条。不是全仓库历史扫描。
- 缓存键是仓库+number，指纹为 number+updated_at，PR 再加 head SHA。只有变化才补拉详情、文件、CI 和模型判断。未变条目复用原结论；窗口外旧结果仍在有界缓存内，最近报告只显示本轮窗口。启用模型或改规则不会强制刷新未变条目。
- PR 文件列表最多 3 页、每页 100；CI statuses/check-runs 各最多 100；关联 issue 最多 3 个，只取同仓库引用。证据不全会明确提示并保守降级。拉取过程中 PR head/updated_at 改变则拒绝缓存混合快照。
- 关键词定位读取默认分支仓库树，最多 5000 个 blob 路径，报告粗略匹配或“未定位”。不下载/执行仓库代码。关联 issue 以 Fixes/Closes/Resolves 引用与文本相似度粗看对应性，不能证明修复有效。
- 重复检测用标题/正文字符 bigram 相似度，只比较本次窗口里的较早 issue。模板检查是通用分段启发式，不声称校验仓库专属表单。复现、版本、日志检查也可能误判。
- CI 单独变化可能不更新 PR 的 updated_at/head SHA，因此缓存可能保留旧 CI 证据；展示的是分析时观察值。此版本没有监听 webhook。
- 敏感路径包括依赖清单/lockfile、脚本、权限目录、workflows、二进制等。规则提供线索，不替代安全审计、实际代码审查和回归测试。“值得合并”始终是建议，不会触发合并。

## 严格只读与认证

GitHub 客户端在代码层拒绝所有非 GET 方法；GraphQL 仅允许单一显式 query，拒绝 mutation/subscription/多操作文档。请求固定 api.github.com，禁止重定向，不接受任意主机；插件没有评论、打标签、关闭、合并、提交 review 或 reaction 功能。

认证顺序：GH_TOKEN → GITHUB_TOKEN → 固定 argv 的 gh auth token → 匿名。gh 不存在、未登录或 5 秒超时则回退匿名，并提示限流。token 只驻留私有内存用于请求头；不保存、不输出、不记录日志，不送模型。命令输入不记入 command/run；公开文本和持久化还有凭据脱敏边界。原始网络、模型、OS 异常不回显。

请求可取消，单次 20 秒超时；403/429 根据 Retry-After / X-RateLimit-Reset 设置冷却，不循环重试。新增运行时依赖 undici 用 EnvHttpProxyAgent 支持 HTTP_PROXY / HTTPS_PROXY / NO_PROXY（也遵循其小写变量规则）；Node 22 内建 fetch 默认不会读取这些代理变量。undici 6 的该 Agent 有实验性警告；不修改全局 dispatcher。zod 4.4.3 与 rc.5 storage-domain 一致，用于存储和模型输出校验；其余 DSH 包是宿主 peer 与本地开发依赖。

## 验证与真实 smoke

```powershell
npm --prefix packages/dsh-github-triage ci --ignore-scripts
npm --prefix packages/dsh-github-triage run typecheck
npm --prefix packages/dsh-github-triage test
npm --prefix packages/dsh-github-triage run verify-pack
node packages/dsh-github-triage/scripts/smoke-real.mjs
node packages/dsh-github-triage/scripts/smoke-real.mjs --schedule-only
```

smoke 用法：`node packages/dsh-github-triage/scripts/smoke-real.mjs [owner/repo] [--limit 5]`。不经过 DSH，默认仓库 **cordiverse/cordis**（DSH 底层框架，Issues/PR 均开启）；--limit 为 issues/PR 合计候选上限，范围 1–100、默认 5，不要求仓库必须有固定数量的开放条目。可显式验证功能关闭：

```powershell
node packages/dsh-github-triage/scripts/smoke-real.mjs cordiverse/cordis --limit 5
node packages/dsh-github-triage/scripts/smoke-real.mjs deepseek-ai/deepseek-harness --limit 5
```

**DSH 官方仓库 deepseek-ai/deepseek-harness 已关闭 Issues 和 PR**（has_issues=false、has_pull_requests=false）。此前 issues 空列表、pulls HTTP 404 的原因已明确，实际数据验收改用 cordiverse/cordis；对官方仓库运行 smoke 会提示关闭并跳过拉取，正常退出。

脚本默认无模型，逐条打印结论与前两条证据；缓存写系统 TEMP 临时目录，再读取**同一真实快照**，断言 0 条重新分析、实际条数全部命中缓存、无重复简报，结束删除临时目录。还以注入时钟触发两轮 3.6 秒间隔后退出；--schedule-only 仅运行离线调度演示，--help 查看用法。可用 --model-adapter <本地 mjs> 显式提供 default(prompt, signal) 适配器；脚本本身没有外部模型凭据逻辑。

2026-11-11 在沙箱内真实验收通过：cordiverse/cordis --limit 5 返回 2 issues + 3 PR，第二轮 5 条缓存命中、0 重分析；DSH 官方仓库提示功能关闭、0 条目、退出 0。typecheck、115 项测试（含改名后的临时 rc.5 profile 加载/持久化重载）和 verify-pack 通过。详情见 [STATUS.md](STATUS.md)。未安装进用户 DSH，未测试 Electron 桌面视觉和真实模型请求。

## 参考与许可

本包 MIT，原创实现。参考 [dsh-github-flow](https://github.com/ItQianChen/dsh-github-flow)（MIT）的 gh 凭据复用、分层工具/审查规则思路，以及 [dsh-github-bot](https://github.com/PerryLink/dsh-github-bot)（Apache-2.0）的有界拉取、轮询、PR 文件/测试/CI 证据组织。没有直接移植两者代码片段；未引入其中任何 GitHub 写能力。声明见 [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES)。

官方接口核对固定于 [dsh-v0.2.1-rc.5 / b830ec9](https://github.com/deepseek-ai/deepseek-harness/tree/dsh-v0.2.1-rc.5)，更细的路径与签名在 STATUS.md。

