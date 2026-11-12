# Changelog

## 0.2.1 - 2026-11-12

- 合并内网代理 / CA 诊断分支与 main 的 DSH 0.2.2-rc.1 兼容修复（merge intranet proxy/CA diagnostics with main's 0.2.2-rc.1 compatibility）；本包沿用 main 版本及 engines / peer 范围。
- 保留分支的源码、入口与配置 BOM 清理，不改变既有回顾功能。

## 0.2.1 - 2026-11-11

- 修正 DSH 版本声明为 `>=0.2.1-rc.5 <0.3.0-0`，采用官方包含预发布版本的校验规则，并排除 0.3.0 预发布版本。
- 放宽 DSH peer 范围，显式覆盖 rc.5 / rc.1 的标准 npm semver 安装校验；开发依赖保持原版本。
- 同步锁文件自身版本、打包断言及当前版本标识；兼容性声明不等于逐版本功能验证。

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
