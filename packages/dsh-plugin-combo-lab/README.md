# dsh-plugin-combo-lab · 桌面插件组合回归台

版本 0.1.0，MIT。仅面向 **Windows 官方桌面 DSH**，目标版本 0.2.1-rc.5。

选择**恰好两个插件及精确版本**，生成桌面操作计划，人工录入证据，对比单独启用与共同启用，逐步缩小失败组合，保存升级前后独立快照。入口为输入框中的 /combo-lab，无需模型调用。

本版是**检查计划与人工证据记录器**。不会自动点击、注入按键、读取桌面 DOM、探测注册表、启停插件、改 profile 或重启 DSH。没有自建侧栏或会话菜单 UI；侧栏和会话菜单是检查对象。尚未在真实桌面运行本插件验证交互效果。

## 安装

代码目前只落在 monorepo 本地，未提交、未推送、未发布 npm。以下 GitHub 地址需后续串行提交并推送到 main 后才可用。

桌面 UI：**插件 → 添加插件**，填写：

~~~text
github:hzopc1031/dsh-plugins#main&path:/packages/dsh-plugin-combo-lab
~~~

PowerShell 使用桌面捆绑 CLI。先完全退出 DSH（包括托盘），不要依赖 PATH 上可能提示 desktop profile 被 Electron 管理的独立 dsh：

~~~powershell
& "$env:LOCALAPPDATA\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop add "github:hzopc1031/dsh-plugins#main&path:/packages/dsh-plugin-combo-lab"
~~~

安装后重开桌面。固定代码版本可将 main 换成提交哈希；计划中的目标插件版本另按精确 SemVer 记录。回归台不查询 registry 验证版本是否存在，也不代为安装。

## 检查矩阵

每个计划固定 5 轮、每轮 10 项，共 **50 步**：

| 轮次 ID | 目标启用集 | 目的 |
| --- | --- | --- |
| baseline | 无 | 空白对照，排除环境本身的问题 |
| a | A | 单插件对照 |
| b | B | 单插件对照 |
| ab | 先 A 后 B | 组合对照 |
| ba | 先 B 后 A | 反向启用顺序对照 |

A、B 按包名排序确定，show 展示精确版本。启用顺序是人工操作顺序，不能据此断言内部加载顺序。

| 交互面 | 检查项后缀 | 操作关注点 |
| --- | --- | --- |
| input 输入框 | tools、commands、shortcut、persistence | 工具/命令重复注册或覆盖、快捷键抢占、重启后配置 |
| sidebar 侧栏 | panel、shortcut、persistence | 面板入口/内容覆盖、快捷键抢占、重启后配置 |
| session-menu 会话菜单 | commands、shortcut、persistence | 命令重复/缺失/归属错误、快捷键、重启后配置 |

完整步骤 ID 示例：ab:sidebar.panel。每步有中文操作说明。没有相关功能时记 unsupported，不要为凑齐矩阵填 pass。空白对照检查“目标入口不存在、基础界面正常、无注册错误”；单插件轮次只要求该轮应有的入口。若没有可比动作，应记不适用，最小组合结论会保留为不确定。

每轮：保留官方必需插件与回归台，关闭其他第三方插件；恢复相同工作区和配置基线；核对精确版本及实际启用集；按轮次启用，完全退出含托盘后重开，再执行检查。回归台始终存在，最小组合仅相对于这一固定基线成立。

## 创建计划和记录证据

1. 在绑定项目目录的桌面会话输入以下一行：

~~~text
/combo-lab plan {"plugins":[{"name":"dsh-task-review","version":"0.1.1"},{"name":"dsh-heartbeat-monitor","version":"0.1.0"}],"environment":{"platform":"win32","client":"official-desktop","version":"0.2.1-rc.5","machine":"DESKTOP-NTRMANG"},"workspace":"combo-fixture-v1","configBaseline":"clean-v1"}
~~~

输出计划 UUID、动作和状态。workspace 与 configBaseline 是人工维护的可比条件标签，不是自动计算的哈希；可填不含凭据的配置备份编号。环境为计划预期值，需实际核实，不是自动探测。只能选择两个不同包名，支持 scoped 包和 prerelease 精确版本，拒绝 latest、版本范围、git spec。

2. 查看计划，生成待检查步骤的录入模板：

~~~text
/combo-lab show <计划UUID>
/combo-lab template <计划UUID> ab:input.commands
~~~

模板输出可编辑的完整 record 命令，默认 outcome 为 blocked，不默认通过。实际操作后填写 observer、evidence 和 outcome；人工核实 enabled、environment，不能照抄后假定条件已经自动验证。observedAt 在命令录入时由插件改为当前 UTC 时间。

3. 人工桌面证据示例（替换 UUID；启用集与顺序必须符合该轮）：

~~~text
/combo-lab record <计划UUID> {"stepId":"ab:input.commands","source":"desktop-manual","outcome":"pass","observer":"Liu","evidence":"完全退出并重开，在输入框分别执行 /heartbeat 和 /review；入口各一项，返回内容归属正确。","environment":{"platform":"win32","client":"official-desktop","version":"0.2.1-rc.5","machine":"DESKTOP-NTRMANG"},"enabled":[{"name":"dsh-heartbeat-monitor","version":"0.1.0"},{"name":"dsh-task-review","version":"0.1.1"}]}
~~~

| source | 含义 |
| --- | --- |
| desktop-manual | 人工在 Windows 官方桌面核实，必须记录一致的环境和目标启用集 |
| headless | 无原生桌面验证的流水线/工具结果 |
| static | 只有静态扫描或声明信息 |

outcome 为 pass、fail、blocked、unsupported。evidence 写具体操作、焦点、按键或入口、预期及实际结果，可写证据文件编号；不读取附件或截图。保留全部记录，单步**最后一条记录**决定当前状态；追加非桌面证据后该步也会回到“仅非桌面证据”，需要再录桌面复核。

4. persistence 步骤的 pass/fail 还必须附加 restart 字段：

~~~json
{"restart":{"before":"panel.visible=true；实际面板可见","after":"panel.visible=true；实际面板可见","fullyExited":true}}
~~~

确认完全退出含托盘后重开。pass 要求 before/after 相同；fail 要求不同，例如 after 为“配置键缺失；面板不可见”。记录非敏感配置键、实际值和界面效果。headless 重启成功不属于原生验证。

## 缩小与最小复现

show 对每个检查项、每种启用顺序独立重新分析：

- 没有组合桌面 pass/fail：保持待验证。
- 组合失败但缺少对照：按 baseline → a → b 提供下一步。
- 空白对照也失败：环境问题，不能归因目标插件。
- 空白通过、某单插件失败：缩小至该单插件，不能认定组合特有问题。
- 空白和两个单插件通过、组合失败：给出**该基线、该检查项、该顺序下最小双插件清单**，附精确版本及复现步骤。

首版仅双插件穷举，不做任意 N 插件缩小。不输出全局“桌面全部通过”；不适用、受阻、未测项独立显示。无法核验人工声明的真实性。

## 升级快照

先记录升级前计划并保存：

~~~text
/combo-lab snapshot <升级前计划UUID> 升级前
~~~

输出独立快照 UUID。升级目标插件后用新精确版本创建**新计划**，保持机器、DSH 版本、工作区及配置基线一致，重复操作：

~~~text
/combo-lab snapshot <升级后计划UUID> 升级后
/combo-lab compare <升级前快照UUID> <升级后快照UUID>
~~~

快照独立保存，后续记录不会修改旧快照。compare 同时保存 comparison-UUID.json，记录前后快照 ID、标签、版本及完整对照结果，并返回文件路径。请按真实时间顺序传入前后快照。对比输出前后版本与每步 change：

| change | 含义 |
| --- | --- |
| regression | 桌面人工 pass → fail |
| fixed | 桌面人工 fail → pass |
| unchanged | 双方都有桌面结论且相同 |
| inconclusive | 缺少任一侧桌面结论，或条件不同 |

更换桌面版本、机器、插件名称集合、工作区或配置基线时，整个对比标为不可直接比较并列出原因，不把其他变化归因于插件升级。

默认保存至**会话项目目录**的 .dsh/combo-lab/，文件为 study-UUID.json、snapshot-UUID.json、comparison-UUID.json。缺少 cwd 时拒绝相对路径写入，不回退到 DSH 全局目录。插件配置：

~~~json
{"reportDir":".dsh/combo-lab"}
~~~

reportDir 也可为绝对路径。只接受生成的 UUID，不支持任意路径导入。单文件上限 8 MiB；串行读改写、原子更新，不支持多个 DSH 进程同时写同一目录。请自行备份目录。证据与命令结果仍可能被宿主会话日志保存，不要录入凭据或敏感信息。

## 官方挂载与限制

通过 dsh.bundle.patch / cordis.patch.yml 挂载，使用官方 ctx.commands.register、CommandDefinitionId、ctx.effect disposer。没有发明未公开的原生桌面自动化 API。官方包仅作 host peer 和开发依赖，发布包带预构建 lib/，没有安装构建脚本。

依据：[官方命令子系统](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/commands.zh.md)、[命令包文档](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/interaction/commands/README.zh.md)、[桌面文档](https://github.com/deepseek-ai/deepseek-harness/blob/master/apps/desktop/README.zh.md)。类型和集成验证使用 registry 发布的 dsh-commands@0.2.1-rc.5；master 文档可能继续变化。

所用公开命令接口只负责发现、执行与文本结果，不能据此证实快捷键路由、侧栏覆盖、菜单渲染或 Electron 完全重启后的表现。这些动作**无法自动验证**；计划初始状态为“待桌面验证”，可录为“无法自动验证／当前不适用”或“受阻”。headless 启动和命令集成测试通过绝不标成桌面通过。

若冲突导致桌面不能启动，需先人工保存外部证据、恢复可用环境后补录受阻情况；回归台无法在崩溃进程中采集证据。没有自动采集所有动态注册、全局快捷键或原生面板状态的能力。

本次开发未安装进用户 DSH，未启停目标插件，未验证真实原生交互，不声称任何真实组合已通过桌面验收。不覆盖 Linux、macOS、Web/headless UI，不上传数据、不提供模型工具，不打包音视频或海报。

## 开发校验

在包目录执行：

~~~powershell
npm ci --ignore-scripts
npm run typecheck
npm test
npm run verify-pack
~~~

测试覆盖计划、三类交互、独立/组合对照、最小集合、持久化证据、升级快照、来源标记、真实 Cordis 生命周期、并发写入和存档恢复。集成测试只创建内存 Context 和临时文件，**不是原生桌面测试**。verify-pack 在 Windows 用 shell 调 npm，检查精确发布清单和缺少安装脚本。改源码后重建 lib/；最终交付不含 node_modules、tgz 或临时垃圾。

MIT，见 LICENSE。