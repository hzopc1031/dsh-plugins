# STATUS — 指令冲突解释器

本次 0.2.0 优化、验证与推送状态见 [OPTIMIZE_REPORT.md](../../OPTIMIZE_REPORT.md)。下列首版执行记录为历史记录；不表示本次已做桌面验收。

- 包名：dsh-instruction-conflicts
- 版本：`0.2.0`
- 命令：/instruction-conflicts [history|json|history-json|help]
- 工具：无额外模型工具，使用官方人类命令注册。
- 最终位置：dsh-plugins/packages/dsh-instruction-conflicts
- 许可：MIT（与现有包一致）。

## 已实现

项目/全局指令与运行时、技能正文归属；独立区分文件存在、曾经注入、当前 surface 原文保留；正文 SHA-256 与来源 digest 分开；新 baseline、更新、撤回、snapshot 和压缩后的历史版本；有来源、seq、行号、原句的两列疑似冲突；历史对照不当作当前同时生效；人工修订建议但不改文件。

依照 dsh-v0.2.1-rc.5 官方文档及发布类型，挂载 Cordis bundle、commands、sessionQuery、system-prompt/assemble。模板只参考、不修改。包含 TypeScript 源码、预构建 lib/、fixture 测试、verify-pack 与中文 README。

## 验证记录

2026-11-10，Windows DESKTOP-NTRMANG，Node 24.20.0 / npm 11.19.0。

- npm.cmd view dsh-instruction-conflicts name version --json：E404，registry 返回 Not Found；包名未占用的公开查询结果（不是保留或发布）。
- npm.cmd run typecheck：通过。
- npm.cmd test：51 项，51 通过，0 失败、0 跳过。32 项核心单测 + 19 项 headless 适配器/命令/元数据集成测试。
- npm.cmd run verify-pack：通过；19 个精确白名单文件，含完整预构建 JS 与声明；无安装生命周期脚本、凭证、node_modules、测试源码或临时产物进入安装包。
- 构建目录：授权的 npm-cache/dsh-instruction-build；工作区中 Node 创建/写入报 EPERM，使用 PowerShell 文件复制同步源码与构建结果，不更改沙箱权限或全局配置。最终包目录直接执行 verify-pack；最终文件与已测镜像做 SHA-256 核对。

## 已知未测或做不到

- 未安装进真实桌面 DSH，未测 Electron UI、Git/CLI 安装、真实 provider 网络请求、SQLite 持久化重启恢复和远程/沙箱 fs。
- 报告以命令观察时日志为准，不包含未进入模型 surface 的 inbox，不保证下一请求已发出。
- 磁盘探测仅元数据、默认候选与 .git 标记；自定义发现配置、变更工作目录后的历史路径、元数据失败给未知，不宣称穷尽所有指令文件。不读取磁盘正文，也不比较磁盘最新正文版本。
- 重启后无 assembly 命名来源缓存时保留完整 system-prompt；候选与已记录全文不匹配时不声称知道其分段来源。
- 自然语言只能保守提示疑似冲突；加载顺序不代表优先级，不能解释模型为何违背指令。扫描达到 300 候选 / 20,000 对照 / 100 发现上限时明确标结果不完整。
- 未做 npm publish、plugin add、commit 或 push；远程 Git 安装必须等后续任务将此包串行提交推送到 main。

没有修改已有插件源码或 monorepo 根 README，没有修改 DSH 全局配置，没有访问 _private / _tools。

