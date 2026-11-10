# STATUS

本次 0.2.0 优化、验证与推送状态见 [OPTIMIZE_REPORT.md](../../OPTIMIZE_REPORT.md)。下列首版执行记录为历史记录；不表示本次已做桌面验收。

- 包名：`dsh-permission-doctor`
- 版本：`0.2.0`
- 中文名称：权限拒绝诊断台
- 命令：`/permission-doctor list [beforeSeq]`、`/permission-doctor show <结果序号>`、`help`
- 模型工具：无。仅通过命令选择展示，避免自动把审批审计送给模型。
- 完成日期：2026-11-10；Windows DESKTOP-NTRMANG；Node 24.20.0、npm 11.19.0。

## 做了什么

独立 Cordis bundle，预构建 lib 与声明齐全。按固定官方标签 dsh-v0.2.1-rc.5（b830ec950faba0a46dda564be3e2d854afed94f1）核验工具流水线、tools/result、会话查询、权限事件和审批记录。

支持失败调用列表及精确结果序号选择，原生和 PTC 子调用历史关联，调用前只读权限快照，调用时历史档位/策略/目标路径/审批/结果报告，规则拒绝、沙箱拒绝、审批不可用、用户拒绝（应答器 rejected）、普通系统错误及原因未确定。区别 never 的自动拒绝、没有匹配审批审计和不能证明 UI 已展示，提供证据支持的人工处理建议。

不注册审批应答器，不调用权限 setter、工具 execute 或重试。不读项目文件、不扫描日志目录、不联网、不写插件数据。保留每会话最近 300 条失败运行时观察，退出/卸载后丢弃；宿主正常保存命令卡输出。常见凭据尽力遮蔽，报告长文本截断。

## 验证命令与结果

依赖及构建在允许写入的独立镜像目录执行：

`C:\Users\Mayn\AppData\Local\npm-cache\dsh-permission-doctor-dev`

原因：此环境 Node 在工作区 mkdir 返回 EPERM；PowerShell 可以落盘。未绕过沙箱或变更全局配置。仅源码、测试、lockfile 和 lib 等交付文件回拷到 monorepo，无 node_modules 或打包垃圾。

- `npm ci --ignore-scripts --no-audit --no-fund`：通过，固定 lockfile 依赖。
- `npm run typecheck`：通过，TypeScript strict / noUncheckedIndexedAccess。
- `npm test`：**56 / 56 通过，0 失败、0 跳过**。43 项核心分类/证据测试、4 项插件边界测试、9 项真实 rc.5 Cordis 注册表/工具流水线/审批服务测试（会话是合成夹具）。
- `npm run verify-pack`：通过，**15 项打包文件白名单**；检查 bundle、预构建入口、类型出口、无安装期脚本和宿主 peer 依赖。
- 实际 `npm pack --ignore-scripts --json --pack-destination <npm缓存测试目录>`、解包后加载入口/core：通过；tgz 只放缓存测试目录，不放 packages。
- 最终 monorepo 副本与验证镜像的交付文件哈希一致；从最终目录 dry-run 打包白名单通过。

已核验的具体情形：never 不派发应答器；无审批服务不留审计且保持未知；无应答器/抛错应答器返回 unavailable；ask/rejected 无法证明人为点击；规则直拒不执行工具；bash isError=false 的结构化沙箱拒绝；历史文本标记伪装只算线索；权限变更时间边界；重复 ID/缺失/冲突日志；PTC 不解析 ID；分页、取消、卸载、快照失败仍原样委托 next；内存上限与会话隔离。

## 已知未测或做不到

- 未安装到用户桌面 DSH；未做真实 Electron UI、真实审批弹窗或 desktop profile 安装验证。
- 未连接真实持久化 sessionQuery 后端；真实注册表测试使用合成会话日志、合成工具/应答器，不能当作桌面端到端通过。
- 未执行真实 Windows ACL、沙箱后端、权限升级或失败动作，也不承诺诊断所有第三方工具/后台任务的业务失败。
- 没有右键菜单/自定义面板，使用命令卡 list → show 选择。
- 历史日志缺失的权限、审批身份、目标路径或 canonical value 无法恢复；当前配置不会被拿来充当历史事实。
- “用户拒绝”分类仅表示 ask 下应答器返回 rejected；应答器可能是机器，不能证明用户操作。
- 重启或超过 300 条后丢失运行时 bash 结构化事实，只剩文本时原因未确定；仅 EACCES/Permission denied 不足以归因。
- 不解析 shell 命令里的目标、符号链接和实际文件边界。常见凭据遮蔽不保证覆盖所有秘密；分享报告前需人工检查。
- 未验证 rc.5 以外版本。

## 包名与交付

2026-11-10 执行：

`npm view dsh-permission-doctor version --registry=https://registry.npmjs.org`

返回 `E404 / 404 Not Found`，当时 npm registry 无该包。可用性不是名称保留。

最终代码：`dsh-plugins/packages/dsh-permission-doctor`。MIT，沿用现有包许可证。

本任务没有 git commit/push、npm publish/unpublish/deprecate、plugin add 或桌面 profile/DSH 全局配置变更。git 安装地址须待后续串行提交到 main 后可用。官方依据与完整安装命令见 README。
