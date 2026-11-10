# Changelog

## 0.1.0 — 2026-11-10

- 以 npm 包名 `dsh-heartbeat-monitor` 发布（`dsh-heartbeat` 已被无关包占用），源码位于 hzopc1031/dsh-plugins 的 packages/dsh-heartbeat-monitor。

- 首个版本：定时进度卡、静默超时警告、重复工具/重复错误警告、可选系统通知、`/heartbeat` 手动查看。
- 核心规则为纯函数，假时钟单元测试；另有基于真实 rc.5 运行时包（Cordis、SessionStore、CommandRuntime）的集成测试。
