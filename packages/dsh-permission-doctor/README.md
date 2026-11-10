# 权限拒绝诊断台

当前源码版本 **0.2.0**（尚未发布本次版本到 npm）。调用时权限快照仅折叠新增日志；审批请求与 live 观察按精确 ID 建索引。重复 list/show 可复用同一不可变日志与同一观察下的解析结果；新的工具/权限/审批事件、日志替换或缩短、live 观察变化均使缓存失效，跨会话隔离，缓存仅在内存。保留 20 条列表分页与手动 show 明细，错误文字仍只作线索，缺失证据仍给未知；不会改权限或补造历史事实。snapshotEvents 与 Session Query 仍可能读取完整日志，未宣称整个查询为 O(1)。

本次只完成 Windows 上的 typecheck、单元/rc.5 headless 集成、browser factory 的 jsdom 检查及 verify-pack；未安装到真实 DSH、未做 Electron 目视验收。最新批次记录见仓库 [OPTIMIZE_REPORT.md](../../OPTIMIZE_REPORT.md)。

`dsh-permission-doctor@0.1.0`，适配桌面 DSH `0.2.1-rc.5`。选中一次失败或疑似失败的工具调用，查看“为什么不让做，为什么没有弹审批”的证据。只诊断，不修改权限、不发起审批、不自动重跑。

## 使用

在**失败调用所在会话**输入：

```text
/permission-doctor list
/permission-doctor show 42
```

`list` 显示最近 20 条失败/疑似失败调用：结果序号、完整调用 ID（长 ID 会截断显示）、工具名和分类。复制你选中的**结果序号**给 `show`；序号来自列表，不是工具调用 ID。较早记录按列表提示使用 `list <beforeSeq>`。无参数或 `help` 显示帮助。

报告显示调用时的权限档位、沙箱模式、审批策略、工作区、显式目标路径参数、一次性升级请求、本次实际 bash 沙箱模式（如有结构化观察）、审批审计记录、工具文本结果、错误代码及有证据支持的处理建议。每个权限字段标明来自历史事件还是调用前的服务快照，缺失显示“未记录”。

入口是官方命令卡，选择通过 `list → show` 完成；本版没有工具卡右键菜单或自定义侧栏。没有注册模型工具，避免把日志内的审批细节自动送入模型上下文。

## 分类与证据

| 分类 | 可靠依据及边界 |
| --- | --- |
| 规则拒绝 | `AUTO_REVIEW_DENIED`；或匹配审批在 `never` 下返回 `rejected`。后者不是用户点击。没有结构化原因的普通 guard 拒绝可能只能标记未确定。 |
| 沙箱拒绝 | `FS_SANDBOX_DENIED`；或当前进程观测到官方 bash canonical DTO 的 `sandbox.denied=true` 且非 runnerFailed。 |
| 审批不可用 | 本次调用的 `approval/asked` 与 `approval/decided` 精确关联，结果为 `unavailable`。不能继续区分缺少应答器、应答器抛错或返回非法值。 |
| 用户拒绝（审批返回 rejected） | 当时策略为 `ask` 且审批返回 `rejected`。这是审批拒绝分类，应答器也可能是机器；不能证明有人点过拒绝或看到弹窗。 |
| 普通系统错误 | 已知注册、输出、超时错误代码；或 bash 结构化结果报告执行失败且没有报告沙箱拒绝。操作系统、远端和子程序仍可能有自己的权限。 |
| 原因未确定 | 证据缺失、冲突、未知代码、日志乱序/断裂、审批取消或缺少决定/当时策略，或仅有错误文本。 |

工具名和接近的时间不是审批关联依据：按会话内原样调用 ID、调用区间和审批请求 ID 配对；结果序号区分重复使用的调用 ID。支持 `tool/call → tool/result` 和 `tool/ptc-dispatch-start → tool/ptc-dispatch`。不把子调用的拒绝未经证明地归给外层 `run_code`。

## 为什么没弹审批

- `tools/pre-execute` 可以直接 deny；monotonic guard 也可以拒绝。它们不保证转换成 ask。
- 正常沙箱拒绝不会自动触发审批。工具可能需要明确请求一个更宽的 `sandbox_permissions`；同档执行无需升级审批。诊断台只解释现有参数，不代用户发出升级请求。
- `never` 在审批服务内部、应答器派发前自动拒绝，仍可产生 asked/decided 审计对。
- `ask` 只是交给部署组合的应答器。服务不自带弹窗；缺少、失败或非法返回的应答器使审批不可用。
- 缺少审批服务、缺少路由 agent、早期校验、取消、工具未请求升级、未带 callId 或日志不全，都可能导致没有匹配的 asked。仅凭缺失记录不能断言“根本没进入审批”。
- `approval/asked` 是审计记录，不是弹窗展示凭证；日志也不提供人机应答器身份。

**本插件不会承诺任何拒绝都自动弹审批。** 建议始终基于报告列出的证据，后续处置由用户或维护者决定。

## 安装

本包已有 main 安装版本，未发布 npm。本批次新版本须使用包含本次提交的 ref；提交与推送状态见 OPTIMIZE_REPORT.md。

Git 地址：

```text
github:hzopc1031/dsh-plugins#main&path:/packages/dsh-permission-doctor
```

先完全退出桌面 DSH（含托盘），使用**桌面捆绑 CLI**，不要依赖 PATH 上可能报 profile 由 Electron 管理的独立 `dsh`：

```powershell
& "$env:LOCALAPPDATA\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop add "github:hzopc1031/dsh-plugins#main&path:/packages/dsh-permission-doctor"
```

或打开桌面 UI：**插件 → 添加插件**，填入同一 git 地址。安装后完全退出并重启桌面 DSH。本次开发没有执行安装或修改任何桌面 profile。

本包是 Cordis bundle，入口 `index.js → lib/plugin.js`；`cordis.patch.yml` 插入 `permission-doctor` 实例。已附预构建 `lib/*.js` 和类型声明，无安装期脚本。需要宿主 `commands` 与 `tools`；会话查询和权限服务按可用性只读使用，不主动挂载新的权限服务。

## 数据与边界

- 当前会话读取优先采用已有的 `ctx.sessionQuery.readSession(session.id)`，否则采用 `session.snapshotEvents()`。查询失败明确报错，不用不完整回退伪装成功。不扫描日志目录、不读取目标文件、不运行 shell、不联网。
- `tools/pre-execute` 监听器只读服务快照并原样调用 `next()`；`tools/result` 仅观察最终结果。插件不注册 guard、不接管 approval/request、不调用任何权限 setter 或工具 execute。
- 每会话最多保留 300 条失败的内存观察，以弱引用关联会话；不写自己的日志或报告。退出/卸载后消失。命令卡输出由宿主按其正常命令历史保存，手动 show 会把经遮蔽的结果文本放入当前会话卡片。
- 历史 canonical value 不在会话日志中。重启后 bash 的退出码/沙箱文本标记只列为疑似失败，不能单独可靠归因；普通工具成功返回的业务错误不保证可识别。
- 权限缺失不按 preset 名字猜 bundle，也不从当前设置补写历史。沙箱 standing mode 与某次获批的实际模式分别展示。
- 路径仅提取顶层 `path/filePath/file_path/target_path/directory/paths` 参数。保留原样；不解析符号链接、不验证存在，不从 shell 命令推测目标。复杂命令、后台任务和第三方工具可能没有可靠目标或完成状态。
- 只展示文本块，不展示音视频、图片或完整参数正文。常见 Bearer、token/password/API key、PAT 和私钥格式尽力遮蔽，长内容截断；这不是完整的敏感数据检测。分享报告前请人工检查。

## 本地验证

在独立开发副本或本包目录执行：

```powershell
npm ci --ignore-scripts
npm run typecheck
npm test
npm run verify-pack
```

`npm test` 先构建，再运行纯函数及真实 rc.5 Cordis 注册表/工具流水线/审批服务测试。工具和会话使用合成夹具；不安装插件到 DSH，不访问真实项目目标，不执行失败动作。

Windows 若 Node 无法在工作区写依赖或 lib，可把本包复制到允许写入的 npm 缓存下独立开发目录，执行相同命令后仅将 lib 和 lockfile 回拷；不要复制 node_modules 回 packages。verify-pack 已对 win32 的 npm 子进程启用 shell。

已测：六类分类与保守回退、权限时间边界、原生/PTC 事件关联、重复/缺失/冲突事件、bash isError=false 拒绝、文本伪装、凭据遮蔽、命令选择/分页、实际 rc.5 工具和审批服务、卸载及包内容白名单。具体数量见 STATUS.md。

未测：真实桌面 UI、真实审批弹窗、真实 Windows ACL/沙箱后端、Electron profile 安装、持久化查询后端与跨版本行为。本版无自定义 GUI、修复、重试或历史缺失信息补全能力。

## 官方依据（固定标签）

所有能力判断固定在 `dsh-v0.2.1-rc.5`，核验的标签提交为 `b830ec950faba0a46dda564be3e2d854afed94f1`：

- [工具注册与流水线](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/core/tools/README.md)，[结构化结果、最终观察及审批消费源码](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/core/tools/src/index.ts)。
- [审批约定](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/interaction/user-approval/README.md)，[asked/decided 字段](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/interaction/user-approval/src/types.ts)，[never 与 fail-closed 实现](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/interaction/user-approval/src/index.ts)。
- [会话查询](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/session-query/session-query/README.md)，[会话原始事件结构](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/core/session/src/types.ts)。
- [沙箱与升级](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/shell/tool-bash/README.md)，[bash canonical 结果](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/shell/tool-bash/src/index.ts)，[文件工具 FS_SANDBOX_DENIED](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/fs/tool-fs/src/sandbox.ts)。
- [Auto 规则拒绝代码](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/experimental/auto-review/src/index.ts)，[权限档位事件](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/interaction/permission-presets/src/index.ts)。

MIT，见 LICENSE。

## 本版本开发校验

在本包目录独立执行，使用本包 lockfile（根目录无 workspaces）：

```powershell
npm ci --ignore-scripts
npm run typecheck
npm test
npm run verify-pack
```

`npm test` 会重建需提交的 lib/。以上通过不等于 Electron 桌面通过；真实截图、剪贴板、焦点/布局及桌面安装仍需人工验收。
