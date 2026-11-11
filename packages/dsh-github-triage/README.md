# dsh-github-triage 0.2.0

自动拉取指定 GitHub 仓库的 issues 和 PR，由 AI 结合你的业务说明，判断问题是否真实存在、值不值得修，PR 是否值得合入。

适用于 DeepSeek Harness **0.2.1-rc.5**。默认没有仓库，也没有模型路由；先完成下面三步。

## 3 步快速上手

### ① 安装

先**完全退出桌面版 DSH（含托盘）**，再在 PowerShell 运行：

```powershell
& "$env:LOCALAPPDATA\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop add "github:hzopc1031/dsh-plugins#main&path:/packages/dsh-github-triage"
```

重新打开 DSH。上面的 main 地址在维护者合入此版本后才会安装 0.2.0；合入前可用包含此次改动的 ref。包已带编译好的 lib，不需要安装时编译。本次源码改版没有执行提交、推送、npm 发布或用户安装。

### ② 配模型

先在 DSH 的模型/服务商设置中启用你要使用的模型。然后运行：

```text
/triage-models
```

把输出中的 **provider** 和 **model** 分别复制到「插件 → dsh-github-triage → 配置」的同名字段，启用 `modelEnabled`。两个字段默认都是空字符串。

rc.5 的真实接口使用两个独立字符串：`provider` 是已注册的服务商路由 **id**，`model` 是该路由下的模型 **id**，不是显示名称，也不是 API key。**不要把 `provider/model` 整串填进 model**，也不要从当前聊天选择猜测它们。

举例：若 `/triage-models` 输出 `provider: "my-route"  model: "my-model"`，就填写：

```yaml
modelEnabled: true
provider: "my-route"  # 示例；换成命令列出的真实 provider id
model: "my-model"    # 示例；换成对应的真实 model id
limit: 20
repositories: []
```

`/triage-models` 调用官方只读 `llm.listProviders()` / `llm.listModels(provider)`，不请求模型生成。目录由适配器提供，可能为空或读取失败；此时去 DSH 的模型设置查看配置的精确 ID。目录不是路由有效性的完整名单，插件不会因为未列出就阻止调用。

**未配置模型时，卡片顶部会明确提示「未配置模型，无法 AI 研判：请在插件配置中填写 model（DSH 已注册的 provider/model）」并补充两个字段分别填写。** 模型禁用、服务不可用、调用失败或 JSON 不合要求时也会显示对应原因。只附「仅规则预筛，未经 AI 研判」的证据列表，不给修复或合并结论，也不把这些条目写入已研判缓存；配好模型后会重新判断。简报遵循相同规则。

### ③ 加仓库和业务说明，运行或设定时

内联说明，含空格请加英文引号：

```text
/triage-repo add owner/repo --both --business "项目提供企业登录服务；核心是认证与会话隔离，优先处理登录失败和权限绕过"
/triage owner/repo --limit 6
```

从仓库默认分支读取说明文件，并在每天 09:30 检查：

```text
/triage-repo add owner/repo --both --business-file docs/business.md --daily 09:30 --limit 10
/triage-repo add owner/another --prs --every 6 --business "插件框架，重点关注生命周期与依赖隔离"
```

也可以只读本机文件（路径有空格请加引号）：

```text
/triage-repo business owner/repo --file "C:\my docs\business.md"
/triage-repo business owner/repo "新的业务方向：优先保障核心登录流程"
/triage-repo business owner/repo --clear
/triage-repo list
/triage-report owner/repo
```

路径区分很直接：**相对路径**（`docs/business.md`）使用 GitHub contents API 读取该仓库默认分支；**本机绝对路径**（`C:\docs\business.md`，Linux 可用 `/home/me/business.md`）读取本机普通文件。无需加前缀。拒绝目录、设备路径、UNC/网络共享、Windows 备用数据流；仓库路径拒绝 `..` 和反斜杠。文件只接受 UTF-8 文本，最多 **16KB**；超限或不可读会显示「读取失败」。本机路径中的 `~`、环境变量不会展开。

业务说明可以写项目做什么、核心功能、高风险模块、哪些问题优先。内联文字与文件都配置时会合并；`business` 命令的文本/`--file` 会替换该仓库的两项业务设置，`--clear` 同时清除。其他仓库设置保持原值。文件读取失败但有内联文本时仍使用内联内容，并显示失败状态。未提供可用说明时，模型的理由必须说明「未提供业务说明，按通用标准判断」。

也可在插件配置中设置仓库：

```yaml
modelEnabled: true
provider: "my-route"  # 从 /triage-models 复制
model: "my-model"    # 从 /triage-models 复制
limit: 20
repositories:
  - repo: owner/repo
    mode: both
    business: "企业登录服务；认证、会话隔离是核心业务"
    businessFile: docs/business.md
    daily: "09:30"
    limit: 10
  - repo: owner/another
    mode: prs
    businessFile: 'C:\my docs\business.md'
    everyHours: 6
```

`daily` 与 `everyHours` 二选一；都不填则仅手动运行。命令的 `--every` 单位为小时。`--issues` / `--prs` / `--both` 选择条目类型；`--limit` 是 issues 与 PR **合计**的候选上限，范围 1–100，默认 20。最多 50 个仓库。再次 `add` 会替换该仓库的全部设置；`business` 子命令只改业务说明。

命令增改清除只保存到插件自己的 `github_triage` 存储域，不改全局配置。命令设置优先于静态配置。`/triage-repo remove owner/repo` 移除/屏蔽仓库；再次 add 恢复。`/triage` 不带仓库则处理全部已配置仓库；带仓库可临时运行。

## 示例输出

以下是格式示例，不是真实仓库研判：

```text
GitHub 仓库研判 · owner/repo
业务说明：已使用（docs/business.md，1.2KB）

#123 登录后会话意外失效
高 · bug · 真实存在：likely · 值得修
结合业务：影响核心登录流程，应优先核实并修复。
理由：复现描述与会话清理代码线索对应，但尚未实际复现。
- 有复现步骤、有版本信息
- 相关片段：src/session.ts；说明文件要求优先保障登录
来源：model
原链接：https://github.com/owner/repo/issues/123

#124 调整插件卸载处理
改完再合 · 符合业务方向：yes · 风险：中
测试：缺少重复卸载场景的回归测试。
结合业务：符合生命周期隔离方向，但需补测再合。
- CI 失败：unit-test
原链接：https://github.com/owner/repo/pull/124
```

`/triage`、`/triage-report` 和新内容简报都会显示业务说明是否使用、来源及大小，或未配置/读取失败。卡片显示结合业务的理由、证据和链接。

## 其他特性

- **只分析新增和有变化的内容，省时间和费用。** 已有 AI 结论才可缓存；模型路由、业务文本或文件内容变化后重新处理。没有 AI 结论的条目会重试，同一失败预筛不重复推送简报。
- **只读取。** 不会在 GitHub 上评论、改标签、关闭条目或合并 PR，所有 GitHub 请求都是 GET，固定 API 主机并禁止重定向。
- **每次最多处理多少条可设置。** 全局 limit、仓库 limit 和手动 `--limit` 依次覆盖。
- **可以纠正结论，以后会参考。** 先得到 AI 研判，再运行 `/triage-fix owner/repo#123 不值得修 已由其他模块解决`。issue 可改类型（bug/需求/提问/重复/无效）或价值（值得修/待补充/不值得修）；PR 可改值得合并/改完再合/不建议合。同项使用用户纠正，后续同仓库同类条目参考最近 8 条纠正。纠正会明确标注来源，不当作已验证事实。
- **定时跑完有新内容才发简报。** DSH 和插件运行时才调度，每 30 秒检查一次；重启合并补跑最近一轮。首次发现仓库关闭 Issues/PR 也会提示，重复提示保持安静。没可用会话就存在自身域里，之后再投递。
- **GitHub 登录复用本机 gh 或环境变量，不保存 token。** 顺序为 GH_TOKEN → GITHUB_TOKEN → `gh auth token` → 匿名；匿名额度较低。token 只在私有内存中用于请求头，不送模型、不写报告或日志。输入命令不记入 command/run；插件不会读取 DSH 密钥文件，也不接收模型 API key。

## 限制

AI 提供建议，不能证明问题已复现或修复有效。仓库内容、业务说明和用户纠正均当作不可信上下文；模型没有工具。规则只整理缺模板/复现/版本/日志、重复候选、粗略路径、PR 规模、敏感文件、CI、测试与关联 issue 的证据，最终判断由模型给出。规则可能误判，模型可能遗漏问题。

每条最多取 **3 个相关文件**，片段每文件最多 **3KB**。issue 用关键词树匹配和报错栈路径找候选文件；PR 保留少量 patch，并取改动文件在默认分支的内容（新文件可能不存在）。只接受不超过 64KB 的普通文本文件，超限/不可读会留下证据缺口提示。仓库树最多 5000 条，PR 文件列表最多 300 个、CI 检查各最多 100 个、关联 issue 最多 3 个。不是完整 diff/代码审查。

业务说明送入模型最多 **8KB**，超过会标注截断；整个模型请求最多 **48KB UTF-8**（含 schema、正文、patch、片段、纠正参考），达到上限会删减并提示。每条最多一次模型生成，45 秒超时，输出最多 1800 tokens。JSON 接受普通文本或代码块；必填字段缺失（包括 businessReason）、错误枚举、多余字段或无效 JSON 都不形成结论。issue 必填 type、exists、worthFixing、priority、businessReason、reason、evidence；PR 必填 verdict、fitsDirection、risk、testing、businessReason、reason、evidence，均含 kind。

仅处理最近更新的开放条目窗口。缓存指纹包含更新时间、PR head SHA、模型路由和业务内容哈希；**CI 独立变化或相关代码变化**可能不更新条目时间，因而不会单独触发重判。缓存上限 5000 条。0.1.0 升级保留仓库设置与用户纠正，清除旧规则结论、报告和待发简报，下一轮重建。

本机文件配置应只指向你愿意发送给当前模型服务商的业务文本。已知 GitHub token 有脱敏边界，但不会识别所有任意机密。未配置模型时不会发送文本给模型。

单次 GitHub 请求 20 秒超时；限流按响应头冷却，不循环重试。支持 HTTP_PROXY/HTTPS_PROXY/NO_PROXY；undici 的代理 Agent 可能提示实验性警告。没有 webhook、全历史扫描或后台常驻服务。桌面渲染、真实 provider、长时间调度及 Node 22 实机兼容仍需验收；当前测试环境为 Windows / Node 24。临时 profile 验证不等同于用户桌面安装。

## 参考来源与许可

本包 MIT，原创实现。参考 [dsh-github-flow](https://github.com/ItQianChen/dsh-github-flow)（MIT）的凭据复用和证据组织，以及 [dsh-github-bot](https://github.com/PerryLink/dsh-github-bot)（Apache-2.0）的有界拉取、轮询、PR/CI 证据思路；未直接移植代码，未引入写操作。见 [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES)。

官方接口固定核对 [dsh-v0.2.1-rc.5 / b830ec9](https://github.com/deepseek-ai/deepseek-harness/tree/b830ec950faba0a46dda564be3e2d854afed94f1)，模型路由与目录接口见 [llm/src/index.ts](https://github.com/deepseek-ai/deepseek-harness/blob/b830ec950faba0a46dda564be3e2d854afed94f1/packages/llm/llm/src/index.ts)、[types.ts](https://github.com/deepseek-ai/deepseek-harness/blob/b830ec950faba0a46dda564be3e2d854afed94f1/packages/llm/llm/src/types.ts)。

## 开发说明

```powershell
npm --prefix packages/dsh-github-triage ci --ignore-scripts
npm --prefix packages/dsh-github-triage run typecheck
npm --prefix packages/dsh-github-triage test
npm --prefix packages/dsh-github-triage run verify-pack
node packages/dsh-github-triage/scripts/smoke-real.mjs cordiverse/cordis --limit 6 --mock-model --business "插件框架，核心是生命周期和依赖隔离"
```

smoke 默认仓库 cordiverse/cordis、合计上限 5；可用 `--business "文本"` / `--business-file <路径>`。**默认无模型**只输出「未配置模型，仅规则预筛」，不输出结论、不缓存为已研判。`--mock-model` 使用确定性**模拟模型**演示完整模型流程与格式，所有模拟理由和输出均标注“模拟模型”，不调用真实 AI，也不证明真实研判准确。`--model-adapter <本地 mjs>` 沿用 default(prompt, signal) 适配器接口，不能与 mock 同用；凭据由适配器负责，脚本不读取模型密钥。

脚本只对 GitHub GET，状态暂存系统 TEMP 并在结束删除；同一真实快照第二轮检查持久化缓存，只有成功研判项命中。另有 `--schedule-only` 离线时钟演示和 `--help`。接口关闭时明确提示并跳过，不把关闭误报为网络失败。

`npm test` 会重建 lib，包含规则证据、模型/业务上下文、只读与脱敏，以及使用官方 Loader、storage-domain、commands、llm 的独立临时 profile 加载/重载测试；网络和模型由测试替身提供，不安装到用户 DSH。`verify-pack` 使用 npm pack dry-run 精确白名单检查。如默认 npm cache 不可写，可仅为当前命令设置 `npm_config_cache` 到本 worktree 的 `.tmp/npm-cache`。

实际验证结果和未测风险见 [STATUS.md](STATUS.md)。

English: Read-only GitHub issue/PR triage led by the configured DSH model, using your business context. Rules supply evidence only. Unconfigured or failed models produce clearly labeled pre-screening evidence without judgments or assessed-cache entries. Targets DSH 0.2.1-rc.5 only.
