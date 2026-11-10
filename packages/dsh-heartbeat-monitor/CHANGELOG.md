# Changelog

## 0.2.0 — 2026-11-10

心跳观察 tools/result 中经过校验的 bash foreground canonical value，非零退出、signal、超时、取消、sandbox 拒绝可计为失败，即使 isError=false。只缓存简短失败分类，不保存 canonical 输出正文；在匹配的 native/PTC 日志结果入账时计数一次。后台启动/提升并非进程失败，输出中的伪造退出码不参与判断。PTC 通过 subCallId 配对，run_code 外层与子调用分别计数。历史日志缺少 canonical value 时不从输出猜测进程状态。

- 新版本尚未 npm publish；预构建 lib、独立 lockfile 与回归测试同步。
- 验证范围为 rc.5 运行时与 headless/jsdom；Electron 人工验收仍待执行。

## 0.1.0 — 2026-11-10

- 以 npm 包名 `dsh-heartbeat-monitor` 发布（`dsh-heartbeat` 已被无关包占用），源码位于 hzopc1031/dsh-plugins 的 packages/dsh-heartbeat-monitor。

- 首个版本：定时进度卡、静默超时警告、重复工具/重复错误警告、可选系统通知、`/heartbeat` 手动查看。
- 核心规则为纯函数，假时钟单元测试；另有基于真实 rc.5 运行时包（Cordis、SessionStore、CommandRuntime）的集成测试。
