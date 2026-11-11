# dsh-github-triage

自动拉取指定 GitHub 仓库的问题与待办（issues）和待合并的代码改动（PR），由 AI 结合你的业务说明，判断问题是否真实存在、值不值得修，PR 是否值得合入。

- **不用一条条翻 issue：** 相比逐条打开 GitHub 列表，在一份结果中集中看问题、PR、判断理由和证据。
- **结合你的业务判断轻重缓急：** 把项目用途、核心功能和优先事项告诉 AI，让它解释为什么值得修、为什么建议合入或暂缓。
- **放心查看，不会动你的仓库：** 只读取信息，不评论、改标签、关闭问题或合并 PR。
- **少做重复分析，省时间和费用：** 已有 AI 结论且内容未变的条目直接复用；条目、业务说明或模型设置变化后再判断。

## 示例输出

下面沿用结果卡片的格式，展示一条问题和一个 PR。仓库 `example-team/plugin-kit`、编号及内容均为虚构示意。

输入业务说明并运行：

```text
/triage-repo add example-team/plugin-kit --business "插件框架，核心是生命周期和依赖隔离；优先保障文件变化后插件能正确重载"
/triage example-team/plugin-kit --limit 6
```

示意输出（节选）：

```text
GitHub 仓库研判 · example-team/plugin-kit
业务说明：已使用（内联文本，0.1KB）

#42 文件监听漏掉连续写入，插件未重新加载
高 · bug · 真实存在：likely · 值得修
结合业务：文件变化后正确重载是核心流程；漏掉写入会让插件继续运行旧代码，建议优先核实。
复现描述与监听代码片段中的事件合并逻辑相符，但尚未实际复现。
- 有复现步骤和版本信息，缺少运行日志
- 关键词粗略定位：src/watcher.ts、tests/watch.spec.ts
来源：model

#43 修正目录变化被当成文件修改
改完再合 · 符合业务方向：yes · 风险：中
测试：有测试改动，但还需补充目录替换后连续写入的回归场景。
结合业务：减少误报有助于避免无效重载，符合业务方向；仍需确认不会漏掉真正的文件变化。
改动涉及监听事件分类，建议补齐边界测试并结束草稿状态后再审。
- 改了 2 个文件，新增 401 / 删除 5 行
- 有测试改动：1 个文件
- 草稿 PR
来源：model
```

<sub>示例，结论以实际 AI 研判为准。</sub>

卡片中的 `likely` 表示“较可能存在，仍需核实”，`yes` 表示“符合业务方向”，`来源：model` 表示 AI 给出的结论。实际结果还会附上原链接，以及本轮处理数、缓存复用数；业务说明会显示使用状态、来源和大小，读取失败也会提示。

## 3 步快速上手

### ① 安装

先**完全退出桌面版 DSH**：关闭所有窗口，并从系统托盘退出，确认已完全关闭后，再在 PowerShell 运行：

```powershell
& "$env:LOCALAPPDATA\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop add "github:hzopc1031/dsh-plugins#main&path:/packages/dsh-github-triage"
```

命令安装到桌面版使用的 DSH 环境（`desktop` profile）。包内已带编译文件，安装时无需构建；所需宿主版本见文末。

### ② 配模型

重新打开 DSH，在插件设置中找到 **GitHub 仓库研判（dsh-github-triage）**，确认已启用。在 DSH 的模型/服务商设置中配置并启用要用的模型，再在会话输入：

```text
/triage-models
```

把输出中的 `provider`、`model` 分别复制到插件配置的同名字段，并启用 `modelEnabled`。例如，若命令列出 `provider: "my-route"  model: "my-model"`，对应配置为：

```yaml
modelEnabled: true
provider: "my-route"
model: "my-model"
```

这里的值只是填写示例，必须换成你在 DSH 中已注册的值。两个字段分别是服务商和模型的准确 ID，不能用显示名称，也不能把 `provider/model` 整串填进 `model`；这里不填 API key。若目录为空或读取失败，到 DSH 模型设置查看准确 ID。

### ③ 加仓库和业务说明，运行或定时

把下面的 `owner/repo` 换成你的仓库。公开仓库可匿名读取，但额度较低；私有仓库需让 DSH 复用有相应读取权限的本机 GitHub CLI（`gh`）登录，或启动环境中的 `GH_TOKEN` / `GITHUB_TOKEN`。插件没有令牌填写项。

直接写业务说明，先运行一次：

```text
/triage-repo add owner/repo --both --business "插件框架，核心是生命周期和依赖隔离；优先处理卸载异常和隔离失效"
/triage owner/repo --limit 6
```

运行后会在会话里看到问题和 PR 的结果卡片，包含结合业务的理由、证据及原链接。未配好模型或调用失败时，会明确提示原因，只展示“仅规则预筛，未经 AI 研判”，不给修复或合入结论；配好后重新运行即可。

也可以读取业务说明文件，并每天按**本机时间 09:30**检查：

```text
/triage-repo add owner/repo --both --business-file docs/business.md --daily 09:30 --limit 10
```

或者只看 PR，每隔 **6 小时**检查：

```text
/triage-repo add owner/repo --prs --every 6 --business "插件框架，重点关注生命周期与依赖隔离"
```

以上是替代用法：再次 `add` 会替换该仓库的全部设置，包括业务说明和定时设置。`--daily` 与 `--every` 二选一，都不填就只手动运行；`--every` 单位为小时。定时检查需要 DSH 和插件保持运行，有新内容才发送简报。

`--business-file` 的相对路径读取 GitHub 仓库默认分支的文件；本机绝对路径读取本机普通文件，例如 `--business-file "C:\my docs\business.md"`。文件须为 UTF-8 文本，最多 16KB；有空格的文本或路径用英文引号包住。业务说明会交给你配置的模型服务商，请只选择愿意发送的内容。

## 日常使用

### 看已配置仓库和最近结果

```text
/triage-repo list
/triage
/triage-report owner/repo
```

`/triage` 不带仓库会处理全部已配置仓库；带 `owner/repo` 可以临时运行，但要使用业务说明，应先添加该仓库。`/triage-report` 只查看最近结果，不重新分析；省略仓库则查看全部报告。

添加仓库时，`--issues`、`--prs`、`--both` 分别选择问题、PR 或两者，默认两者。`--limit` 是两者**合计的候选上限**，为 1–100，默认 20。手动运行的上限优先于仓库上限，仓库上限优先于全局 `limit`；最多配置 50 个仓库。

### 只更新业务说明

```text
/triage-repo business owner/repo "新的业务方向：优先保障核心登录流程"
/triage-repo business owner/repo --file "C:\my docs\business.md"
/triage-repo business owner/repo --clear
```

这三条分别设置文字、设置文件和清除说明，均保留该仓库其他设置。设置文字或文件时，会替换原有的两项业务设置。用 `add` 或配置同时提供 `business` 和 `businessFile` 时，两者会合并；文件读取失败但有文字时，仍使用文字并提示失败。没有可用说明时，模型理由会注明“未提供业务说明，按通用标准判断”。

### 纠正 AI 结论

先取得该条目的 AI 结论，再输入：

```text
/triage-fix owner/repo#123 不值得修 已由其他模块解决
```

问题可改类型（`bug`、`需求`、`提问`、`重复`、`无效`）或修复价值（`值得修`、`待补充`、`不值得修`）；PR 可改为 `值得合并`、`改完再合`、`不建议合`。同一条目优先采用你的纠正，后续同仓库同类条目会参考最近 8 条纠正。卡片会标明来源，纠正不会被当作已验证事实。

### 停止跟踪仓库

```text
/triage-repo remove owner/repo
```

这会移除命令添加的仓库，也会屏蔽静态配置中的同名仓库；再次 `add` 可恢复。命令设置保存在插件自己的存储中，优先于静态配置，不修改全局配置。

### 用配置统一管理仓库

也可以在插件配置中填写 `repositories`，与模型配置一起管理：

```yaml
modelEnabled: true
provider: "my-route"  # 换成 /triage-models 列出的 provider
model: "my-model"    # 换成对应的 model
limit: 20
repositories:
  - repo: owner/repo
    mode: both
    business: "企业登录服务，认证与会话隔离是核心业务"
    businessFile: docs/business.md
    daily: "09:30"
    limit: 10
  - repo: owner/another
    mode: prs
    businessFile: 'C:\my docs\business.md'
    everyHours: 6
```

配置中的 `daily` 与 `everyHours` 二选一，都不设置则仅手动运行；`mode` 可填 `issues`、`prs`、`both`。其余范围与命令相同。

## 补充说明

### 版本与兼容

当前插件版本为 **0.2.0**，针对 **DeepSeek Harness 0.2.1-rc.5**，包声明要求 Node.js 22 或以上。已记录的测试环境为 Windows / Node.js 24，不据此承诺其他宿主版本或平台已验证。

### 限制与数据流向

- AI 给出建议，不能证明问题已复现、测试有效或修复正确。规则只整理复现、版本、日志、疑似重复、相关路径、PR 规模、自动检查（CI）、测试和关联问题等证据，最终判断由模型给出。
- 只取最近更新的开放条目窗口，不扫描全部历史。每条最多尝试读取 3 个相关文本文件，每个片段最多 3KB；源文件超过 64KB 会跳过。PR 只保留部分改动片段，相关文件正文来自默认分支，新文件可能读不到，因此不能代替完整代码审查。
- 业务说明送入模型最多 8KB，整个请求最多 48KB，超出会删减并提示。每条最多一次模型生成，45 秒超时，输出上限 1800 tokens。模型未配置、禁用、不可用、调用失败或返回格式不符时，只展示预筛证据，不写入已研判缓存，后续会重试。
- 仓库内容、业务说明和纠正参考会送给所选模型服务商；模型没有工具，输入均作为不可信数据处理。插件会对已知 GitHub 令牌脱敏，但无法识别任意机密文本。
- 本机业务文件拒绝目录、设备路径、UNC/网络共享和 Windows 备用数据流；路径中的 `~`、环境变量不会展开。仓库文件路径拒绝 `..` 和反斜杠。
- GitHub 凭据依次取自 `GH_TOKEN`、`GITHUB_TOKEN`、本机 `gh auth token`，都没有则匿名访问。凭据仅在内存中用于请求头，不写入报告、不送模型，也不读取 DSH 密钥文件。请求固定访问 GitHub API，仅允许 GET，禁止重定向。
- 单次 GitHub 请求 20 秒超时，限流后按响应头等待；支持 `HTTP_PROXY` / `HTTPS_PROXY` / `NO_PROXY`。插件没有 webhook 或独立后台常驻服务。

### 调度、缓存与 rc.5 接口

定时由插件内部计时器每 30 秒检查一次，不使用 rc.5 的会话调度服务执行任意回调。重启时只补最近一轮；间隔任务在首次检查时执行一轮，每日任务若最近时点已过也会补跑。发现新增或变化才投递简报，首次识别仓库关闭 Issues/PR 时也会提示。没有可用会话时先存到插件自身存储，之后再投递；异常中断下仍可能重复投递。

缓存用一组变化标记（指纹）判断是否需要重判：条目更新时间、PR 最新提交标识（head SHA）、模型设置、业务文字及文件内容。只复用已有结论的条目，最多保存 5000 条。CI 状态或相关代码独立变化可能不改变条目时间，因此不会单独触发重判；重复的失败预筛也不会反复推送简报。从 0.1.0 升级会保留仓库设置与用户纠正，清除旧规则结论、报告和待发简报，在下一轮重建。

本包按 [DSH rc.5 官方插件约定](https://github.com/deepseek-ai/deepseek-harness/tree/dsh-v0.2.1-rc.5/packages/preset/agent-preset/skills/cordis-plugin-development)实现。模型调用使用 `llm.stream`，目录查询使用 `llm.listProviders()` / `llm.listModels(provider)`；命令通过 `commands.register` 返回文本结果卡片，状态通过 `storageDomain` 保存。

### 测试与验证范围

现有自动测试覆盖命令、模型与业务说明、缓存、只读和脱敏，并用独立临时 rc.5 环境检查加载、命令执行和重载。测试中的网络和模型使用替身；提供的真实 GitHub 运行样本展示了问题与 PR 拉取，以及相同快照重载后的缓存复用，但未验证真实 AI 的判断质量。

这些结果不代表用户桌面安装、Electron 渲染、真实模型请求、Node.js 22 实机或长期调度已验证。`npm run verify-pack` 检查预编译文件和打包白名单，包含本 README；详细开发验证记录见 [STATUS.md](STATUS.md)。

### 来源与许可

本包为原创实现，使用 [MIT 许可](LICENSE)。参考了 [dsh-github-flow](https://github.com/ItQianChen/dsh-github-flow)（MIT）的凭据复用和证据组织思路，以及 [dsh-github-bot](https://github.com/PerryLink/dsh-github-bot)（Apache-2.0）的有界拉取、轮询和 PR/CI 证据思路，未直接移植代码。详见 [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES)。
