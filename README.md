# dsh-task-review

DSH 0.2.1-rc.5 的只读任务复盘 bundle。按会话观察工具调用，在工作停止时自动复盘，也可输入 `/review` 手动生成当前未复盘的一段。只写报告与宿主会话记录，不修改项目代码，不调用模型、不发送网络请求。

报告包含首条人类消息摘要、执行状态、已确认文件变更、失败与疑似重试、真实用量、耗时及基于失败/未完成调用的下一步。缺失数据写「不可用」。

## 安装与验证

要求 Node >= 22，DSH **0.2.1-rc.5**。已提交编译产物，无安装期构建、install/postinstall 脚本。

```powershell
# 在此 checkout 中；始终指定独立 profile，不安装到主 DSH
npm ci --ignore-scripts --cache .tmp/npm-cache
npm run typecheck
npm test
npm run test:profile

# 由用户在普通本地终端运行；此项包管理器安装流程未在本沙箱实测
# 使用独立 profile，安装目录链接
 dsh plugin --profile task-review-demo add "D:\Ai Infra Tools\DeepSeek Harness\插件开发\dsh-task-review"
 dsh --profile task-review-demo --dump-config
 dsh --profile task-review-demo
```

如果现有 profile 是 headless 模式，需改用带命令 UI 的 web profile。首次创建自定义 Web profile 可运行 `dsh --profile task-review-demo --from-default-profile web --dump-config`，然后安装。`--from-default-profile` 会替换该独立 profile，请只在首次创建时使用。

在该独立 profile 的 Web 对话执行一些普通工具调用，再输入 `/review`：应出现 `review` 命令结果折叠行，展开可看完整 Markdown 源文本，项目 `.dsh/reports/` 中应有同一份报告。第二次立即 `/review` 应提示没有新内容。默认累计 10 次工具调用、3 个有证据的改动文件或 10 分钟，任一满足，在 agent 进入 idle 时自动显示同样的报告。

宿主默认命令卡片会折叠多行结果；此版本展开正文是 `<pre>`，不渲染富 Markdown。没有自定义前端，也不伪造模型消息。UI 尚未做浏览器目视验证，源码证据见 [API 说明](docs/api.md)。纯 headless 可存档，但无聊天卡片。

## 配置

修改**独立 profile** 的 `task-review` 插件配置（DSH Config schema）：

| 字段 | 默认 | 含义 |
| --- | --- | --- |
| `auto` | `true` | idle 时自动判断；关闭后手动命令仍可用 |
| `toolThreshold` | `10` | 正整数，工具调用次数门槛 |
| `fileThreshold` | `3` | 正整数，唯一改动路径数门槛 |
| `durationMinutes` | `10` | 正数，段首有效事件至复盘的墙钟分钟数 |
| `reportDir` | `.dsh/reports` | 相对会话项目根目录，或绝对目录 |

```yaml
- override:
    id: task-review
    config:
      auto: true
      toolThreshold: 10
      fileThreshold: 3
      durationMinutes: 10
      reportDir: .dsh/reports
```

要放在 DSH_HOME 下，配置绝对路径，例如 `D:/AIInfra/DSHarness/reports`。不隐式展开 `~` 或 `$DSH_HOME`。会话没有项目目录且配置为相对路径时，拒绝存档并保留复盘边界。文件名使用 UTC 时间、清理后的目标摘要和随机后缀，独占创建防止覆盖。

## 边界与限制

- `tools/result` 记录本插件加载之后的所有最终调用，包括 PTC 子调用及其外层 transport，各执行分别计数。pre-execute 开始计时；未经过该钩子的拒绝/未知工具耗时不可用。
- 参数字段中包含 token/key/password/secret 等名称时递归脱敏；脚本、命令、文件正文直接省略。自由文本只做常见凭据模式处理，无法识别所有无标记密钥。不会保存工具输出正文，也不复制原始代码。
- 文件工具有 `before/after/path` 证据时分类新建/修改；可选 `workspaceChanges` 服务提供 shell 等引起的文件变更，文本比较有 before/after 存在性时分类新建/修改/删除。二进制、超限或比较缺失只标「变更（类型不可用）」。宿主无该服务时，不猜测 shell 写入。一个路径在本段多次变更只列最近类型；不是净 diff。
- 原生 `tool/call` 暂无最终观察结果时列未完成；该调用在下一段才结束时，会报告新的完成证据。未观察的 PTC 在途调用暂不可枚举。
- Token 汇总仅来自 `assistant/message.usage` 的最终权威样本，并标明覆盖消息数；失败/重试尝试的用量不计入该小计且标不可用。费用不可用；不使用 tokenMeter 的启发式估算。疑似重试只是同名、同脱敏摘要且前有失败，不表示已解决。
- 复盘边界作为 ignorable plugin record 写入 Session，恢复时重放；分叉不复盘继承前缀。并发手动/自动按会话串行化。低于门槛保留累计，自动关闭不丢记录。
- 边界在存档成功后推进；写入失败可重试。进程在文件写完而会话持久化前崩溃时，可能留下孤立报告，恢复后可能再次复盘。宿主未启用会话持久化时，边界也不跨进程保存。
- 本插件不会证明任务完成、执行测试或解析用户代码；报告的结果仅描述宿主执行状态。耗时包含等待，与纯 CPU 时间不同。
- 仅 Windows + Node 24.20.0 实测；Linux/macOS、真实付费模型、完整 Web UI、CLI 包管理器安装未测。

卸载：在测试 profile 的插件管理界面移除本 bundle，或 `dsh plugin --profile task-review-demo remove dsh-task-review`。已有报告保留，由用户自行清理。

## 目录

```text
index.js + cordis.patch.yml   bundle 入口
src/{core,state,plugin}.ts    脱敏/报告/存档、边界、宿主接线
lib/*.js + *.d.ts            已构建运行代码与类型
locale/{en,zh}.json + icon.svg + LICENSE
 test/*.test.mjs             单元及真实 Cordis 集成测试
scripts/profile-smoke.mjs    独立 profile + 官方 Loader 冒烟
 docs/{00-task,api,handoff}.md
```

图标为本项目原创 SVG，MIT。开发时 `npm run build` 更新 `lib/`；tarball 可用 `npm pack --ignore-scripts --cache .tmp/npm-cache` 生成。本工作区不发布 npm、不创建远端、不 push。
