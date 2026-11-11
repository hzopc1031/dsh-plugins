# dsh-instruction-conflicts — 指令冲突解释器

当前源码版本 **0.2.1**（尚未发布本次版本到 npm）。重复命令可复用相同日志对象及 assembly 证据下的 canonical fold 结果；surface 替换、投影、正文、其他日志或 assembly 变化会使缓存失效。文件 resolve/stat 每次重读，磁盘状态不缓存。默认摘要最多 20 个来源、10 项冲突、20 段正文，每段最多 3000 字符；json/history-json 获取完整结构，history 获取完整历史正文。完整证据与冲突判断不因显示裁剪而删除。engines.dsh 与 DSH peers 声明 `>=0.2.1-rc.5 <0.3.0`；开发依赖保留精确版本。

本次只完成 Windows 上的 typecheck、单元/rc.5 headless 集成、browser factory 的 jsdom 检查及 verify-pack；未安装到真实 DSH、未做 Electron 目视验收。最新批次记录见仓库 [OPTIMIZE_REPORT.md](../../OPTIMIZE_REPORT.md)。

版本 0.2.1，声明 DSH `>=0.2.1-rc.5 <0.3.0`，本次核对 0.2.2-rc.1。MIT。

把实际注入的规则正文、历史版本与当前上下文放在一起看：例如项目 AGENTS.md 的“禁止全局安装”与技能正文的“必须全局安装依赖”，以两列显示来源、角色、seq、行号和原句，标为**疑似冲突**。

本插件不统计 token 或成本，不只是来源回执，不修改用户指令文件，也不推断模型为何没遵守规则。

## 安装

Git 包地址：

```text
github:hzopc1031/dsh-plugins#main&path:/packages/dsh-instruction-conflicts
```

在 PowerShell 中使用桌面捆绑 CLI：

```powershell
& "$env:LOCALAPPDATA\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop add "github:hzopc1031/dsh-plugins#main&path:/packages/dsh-instruction-conflicts"
```

也可在桌面 **插件 → 添加插件** 中粘贴上述 Git 地址。不要依赖 PATH 上可能提示 profile 被 Electron 管理的那个 `dsh`。

本包已有 main 安装版本；本次修改的安装 ref 与推送状态见 OPTIMIZE_REPORT.md。未执行 npm publish 或安装到用户 DSH。

包内已带 `lib/`，安装期不构建、不执行生命周期脚本。宿主模块以 optional peer + devDependency 声明，不复制宿主实现。需要宿主提供 `commands`、`sessionQuery`；未挂载 Session Query 时插件等待该服务，不自行挂载数据库。`fs` 可选，缺失时文件存在状态显示“未知”。

## 使用

| 命令 | 输出 |
| --- | --- |
| `/instruction-conflicts` | 三种状态、当前正文、当前版本的疑似冲突 |
| `/instruction-conflicts history` | 加上历史正文和明确标记的历史疑似冲突对照 |
| `/instruction-conflicts json` | 完整结构化台账，正文、版本和三种状态始终保留；只扫描当前版本 |
| `/instruction-conflicts history-json` | 完整台账并扫描历史版本 |
| `/instruction-conflicts help` | 用法 |

只有一个人类命令，不额外注册模型工具。命令结果通过官方命令生命周期展示，不给模型追加诊断正文，不调用模型，也不跨会话查询。

## 三种状态是独立证据

| 状态 | 证据与含义 |
| --- | --- |
| 文件存在 | 通过当前 `ctx.fs.resolve/stat` 探测候选的元数据；“未知”与“否”不同；运行时规则“不适用” |
| 曾经注入 | 本会话的模型 surface 日志中存在该来源的规则正文（撤回通知本身不证明曾加载过原文）；不证明 provider 收到、模型阅读或遵守 |
| 当前上下文仍包含 | 通过与官方 Session Query 相同的 canonical `foldSurface` 与第一方 message projections 判断原正文节点是否仍保留 |

一个文件可以“存在，但未观察到注入”（例如预算省略、重复候选、尚未触发加载），也可以“不存在，但旧正文仍在上下文”。没有通过文件存在推算注入状态。

“当前”是命令观察时的日志 surface，不是窥视 provider 网络请求：尚未开始下一请求时，它表示可重建的上下文；未进入日志的 inbox 不在报告里。命令产生的 command 事件不构成模型请求证据。

只读探测默认项目候选 `AGENTS.md`、`CLAUDE.md`、`AGENTS.local.md`、`CLAUDE.local.md` 和两个全局根的 AGENTS.md。项目祖先最多 32 层，使用 `.git` 标记；不递归扫描，不读取磁盘正文。不会进入 `_private` / `_tools`。自定义根标记、候选名不保证完整发现；已注入的结构化来源仍会显示。项目根不确定、权限错误或路径无法可靠映射时给“未知”。会话包含 working-directory/change 时保守禁用历史项目路径的磁盘映射。

## 正文与版本如何解释

- 工作区消息使用 `source.kind = agent-instructions` 的 `changes`、`scope`、`path`、`action`、`digest`。rc.5 的 scope 使用“目录 + NUL + 文件名”，不会把同目录的 AGENTS.md 与 CLAUDE.md 合并。
- 正文取自已入日志的文本，保留官方转义、预算截断；SHA-256 标识**注入的片段**。来源 digest 是文件身份，不能冒充当前磁盘内容 hash。
- 新 baseline、replace、remove 以及 snapshot 的明确替换语义会标出“当前版本 / 已被替换 / 已撤回”。旧原文依然可能物理保留；这与规则是否已声明撤回是两个维度。
- 普通技能或其他来源的多条指令默认叠加；不按加载顺序宣称后者覆盖前者。
- 压缩/位置替换后，原节点显示为历史正文。摘要引用或 sourceEventSeqs 只代表来源关系，不证明原规则正文完整保留。
- runtime snapshot 的命名 sections 只有与正文精确对应才拆开归属；无法可靠拆分时保留整段。
- 监听官方 `system-prompt/assemble` waterfall，仅观察，不额外 assemble，也不改返回值。只有观察到的候选完整渲染与已入日志 system 正文逐字相等时，才按 section 名归属。complete 修复、其他监听器修改或重启导致无法匹配时，保留 `system-prompt` 整段，绝不把候选当已注入证据。缓存仅为每个 scope 最近 4 份，不持久化规则正文。
- 如正文伪造 `Instructions from:` 导致边界与 source.changes 不一致，标 `ambiguous`，保留整段，不继续按伪标题归属或检测。

报告 JSON 的 `rows[].versions[]` 保留 body、digest、declaredDigest、action、role、seq、time、current、lifecycle、bodyQuality。`conflicts[]` 以 `left` / `right` 保存两侧来源、原句、行号及版本，`window = current | historical` 区分当前对照与历史对照。行号相对于提取后的注入正文片段。

## 疑似冲突的边界

检测使用有限的中英文动作模板：全局安装依赖、修改指令文件、Git 提交/推送、npm 发布、联网、委派子代理。同一动作出现要求和禁止措辞时提示人工核对目录、条件和例外。代码围栏、Markdown 引用和若干双重否定会跳过。局部安装不会自动归入全局安装。

检测不到一般自然语言中的所有冲突；引用、否定、条件表达仍可误报。未检出不代表没有冲突。**所有结果均叫“疑似冲突”**，不会把展示顺序、消息角色或 section order 当作自动裁决，也不会声称知道模型行为的原因。

默认仅比较仍保留、且没有被官方来源声明替换/撤回的版本。`history` 会额外对照旧版本，但明确标注“历史对照，非当前同时生效结论”。只给人工修订建议，不改 AGENTS.md、SKILL.md 或其他来源。

为避免长历史阻塞，冲突扫描最多检查最近 300 个候选版本、20,000 次原句对照、100 项发现。达到上限时 `analysis.limited = true`，报告显示“结果不完整”；完整正文台账不截断。大型 session 的读取与 canonical fold 仍需处理全日志。

报告可含用户规则正文，只在命令结果展示；插件不联网、不另存文件。Markdown 展示转义 HTML 与外链/图片标记；JSON 保留原正文。

## 开发验证

源码、测试和打包校验脚本在仓库中；安装包只含运行文件和说明。Windows Node 24.20.0、npm 11.19.0 下验证：

```powershell
npm.cmd ci --ignore-scripts --no-audit --no-fund
npm.cmd run typecheck
npm.cmd test
npm.cmd run verify-pack
```

本次直接在各包目录构建与验证；受限环境如默认 npm cache 不可写，可临时设置 npm_config_cache 指向 worktree 内的 .tmp/npm-cache，不修改全局 npm 配置。

首版历史验证：51/51 单元与 headless 集成测试，包括来源归类、三种状态独立性、版本替换与撤回、baseline、snapshot、技能叠加、截断/混淆标题、正文疑似冲突、命名 section、跨 scope 隔离、complete 修复、真实 Cordis 注册和 effect 卸载、Session Query 单次 observation 与 readSurface 对照、取消与失败、元数据探测边界、长历史扫描上限。verify-pack 精确白名单检查 bundle、exports、预构建文件、语言包、peer、安装期脚本和说明。

未测：真实 Electron 桌面加载、CLI/Git 安装、桌面 Markdown 表格的视觉效果、真实 provider 请求、真实持久化数据库恢复及远程/沙箱 fs 后端。本次没有把插件装进用户 DSH；headless 通过不等于桌面验收。

## 官方依据（固定 rc.5 标签）

实现以 `dsh-v0.2.1-rc.5` 为准，没有用 master 推断桌面能力：

- [工作区与全局指令、预算、更新/撤回、带来源消息](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/context/agent-instructions/README.md)
- [来源 changes/scope/digest 与 baseline](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/context/agent-instructions/src/state.ts)
- [正文格式、NUL scope、转义与截断](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/context/agent-instructions/src/render.ts)
- [system-prompt/assemble、命名 section、complete 与运行时 snapshot](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/core/system-prompt/README.md)
- [Session Query 的 current/shadowed/log-only 与 observation](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/docs/subsystems/session-query.md)
- [查询服务、单次观察、当前上下文读取](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/session-query/session-query/README.md)
- [工作目录变更与不可变 session header 的区别](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/session/working-directory/src/index.ts)

## 许可

MIT，见 LICENSE。没有打包第三方音视频、海报、凭证或宿主模块。


## 本版本开发校验

在本包目录独立执行，使用本包 lockfile（根目录无 workspaces）：

```powershell
npm ci --ignore-scripts
npm run typecheck
npm test
npm run verify-pack
```

`npm test` 会重建需提交的 lib/。以上通过不等于 Electron 桌面通过；真实截图、剪贴板、焦点/布局及桌面安装仍需人工验收。

本次 0.2.2-rc.1 兼容结论与 API 依据见[兼容矩阵](../../docs/compat-matrix.md)。本次在 Linux 实际加载；Windows / Electron 功能未实机验证，历史 rc.5 测试记录不代表本次加载过该版本。
