# Changelog

## 0.2.0 — 2026-11-10

复盘同时识别 rc.5 bash foreground canonical value 的非零 exitCode、signal、超时、取消与 sandbox 拒绝；不解析 stdout/stderr。后台启动和提升为后台的结果标为 pending，缺少 canonical value 的历史 bash 标为 unknown。PTC 子调用按 subCallId 关联；同一次调用的实时记录与日志回放不会重复计数，外层 run_code 和真实子调用是不同调用。报告目录与路径展示使用 workingDirectory.get(session)，服务缺失时才回退初始 header.cwd；绝对 reportDir 不变。

- 新版本尚未 npm publish；预构建 lib、独立 lockfile 与回归测试同步。
- 验证范围为 rc.5 运行时与 headless/jsdom；Electron 人工验收仍待执行。

## 0.1.1 — 2026-11-09

- 扩展 DSH 兼容声明，验证 0.2.1-rc.5 与 0.2.2-rc.1。
- 精简分发 peers，避免安装额外宿主包；覆盖可选 workspaceChanges 缺失时的降级。
- 分发预编译 lib，排除内部文档与测试，补全仓库信息占位。
- 重写团队安装、验证、配置、隐私、卸载和故障排查说明。

## 0.1.0 — 2026-11-09

- 首版：工具观察、自动/手动复盘、参数脱敏、Markdown 存档及可恢复边界。
- 双语元数据与图标，单元、Cordis 集成和独立 profile Loader 测试。
