# dsh-task-review 开发任务（交给 Codex）

## 位置与约定
- 本目录 `D:\Ai Infra Tools\DeepSeek Harness\插件开发\dsh-task-review\` 是新的独立工作区，与同级的 `dsh-douyin-hot`、`dsh-iceberg` 并列。
- 开工前先读：同级的 `..\插件发布准备清单.md`、`..\dsh-iceberg\README.md`、`..\dsh-iceberg\AGENTS.md`、`..\dsh-iceberg\_template\`（bundle 骨架：package.json + cordis.patch.yml + index.js + locale/en.json、zh.json + icon.svg + README + LICENSE），沿用同样的结构与纪律。
- 以本机已装 DSH 0.2.1-rc.5 的实际 API 为准：读它内置的文档（插件开发、工具执行流水线、事件/钩子、配置、测试、presentationMeta 或工具结果卡片相关）和 `..\_tools\ref\dsh`、`..\_tools\ref2\dsh` 里的参考源码。不要凭记忆编 API，查不到的写进 docs 标「未验证」。
- 禁止：读取或使用 `..\_private\` 下任何文件；`..\_tools\edge-cookies` 不碰；修改其他同级工作区；修改 DSH 全局配置或默认 profile；安装到用户的主 DSH；建 GitHub 仓库、push、发布 npm。只在本目录内 `git init` 做本地提交。
- 不写 install/postinstall 脚本；`@deepseek-ai/*` 放 peerDependencies + devDependencies。

## 插件目标（一个插件只做一件事）
任务复盘报告：DSH 跑完一段较长的任务后，在对话里给出一张复盘卡片，并存一份 Markdown。插件只读，不改用户代码。

### 记录
- 观察每次工具调用（工具名、参数摘要、成功/失败、耗时、涉及的文件路径），按会话记录。不要记录密钥：参数里疑似 token/key/password 的字段要脱敏。
- 统计 token 用量/费用：如果 DSH 事件里能拿到就记录，拿不到就在报告里写「不可用」，不要估算编造。

### 触发（手动 + 自动都支持）
- 自动：一段工作结束（AI 停下等用户输入）时，若满足任一门槛就出复盘：工具调用 >= 10 次、改动文件 >= 3 个、耗时 >= 10 分钟。三个门槛和自动开关都是配置项（Config schema），默认开启。
- 手动：提供 `/review` 命令（或 DSH 当前版本里等价的斜杠命令/工具机制），随时对当前这一段生成复盘，不受门槛限制。
- 不重复：复盘过的部分记下边界，下次只覆盖新的一段。
- 具体挂哪个事件、命令怎么注册，以 0.2.1-rc.5 实际能力为准，写进 docs 说明选择理由。

### 报告内容
目标（取这段的首条用户消息摘要）与结果；改动清单（新建/修改/删除的文件）；失败与重试；用量与耗时；需要用户确认/下一步（基于失败、未完成的工具调用等客观信号，不编造）。

### 展示与存档
- 对话里展示：用 DSH 支持的工具结果卡片 / presentationMeta 或等价方式，先显示摘要，可展开完整报告。若当前版本做不到卡片，就退回为对话里的格式化 Markdown 消息，并在 docs 写清楚。
- 存档：默认写到当前项目的 `.dsh/reports/<日期>-<会话名或摘要>.md`；存放目录是配置项（可改到 DSH_HOME 下）。

## 验收
1. 类型完整（TypeScript 或 JSDoc + `tsc --checkJs`，跟随工作区现有风格选择），类型检查无错。
2. 单元测试：门槛判断、不重复边界、脱敏、报告生成、文件命名与写入路径。
3. 加载/集成测试：按官方测试约定证明插件能被 DSH 装载、能收到工具事件、能产出报告。测试只能用临时目录和独立 profile（如 `dsh --profile task-review-test`），完事清理，不动主配置。
4. README：作用、配置项、安装命令（独立 profile 方式）、如何验证、已知限制。
5. docs/handoff.md：做了什么、跑了哪些测试和结果、哪些没测、未验证的 API 假设。
6. 本地 git 提交（小步提交，信息清晰）。

## 最后输出
用中文简要汇报：文件结构、关键实现、测试命令与结果、没测到的部分、需要 Liu 决定的事项。