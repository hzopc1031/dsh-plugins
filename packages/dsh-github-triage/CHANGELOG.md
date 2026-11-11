# 更新记录

## 0.1.0 · 2026-11-11

- 新增多仓库只读 issues/PR 研判、规则证据、可选 DSH llm.stream 最终判断。
- 增量指纹缓存、用户纠正参考、每日/间隔调度、启动补跑和无变化静默。
- 会话命令卡片、最近报告、定时简报，官方 storage-domain 独立持久化。
- GET-only 与 GraphQL query 防线、凭据复用/脱敏、超时取消/代理/限流。
- 预构建 lib、独立锁文件、node --test、精确 verify-pack 与真实 smoke 脚本。
- 已做 rc.5 临时 profile 加载、命令、持久化重载验证；未做真实桌面和真实模型验收。
- 全面使用 dsh-github-triage / github-triage 名称，存储域为 github_triage，安装子目录及包元数据同步。
- 拉取前读取仓库功能开关；Issues/PR 关闭时跳过对应接口并明确提示，新增提示可进入简报，重复提示静默。
- smoke 支持 [owner/repo] / --limit，默认 cordiverse/cordis；DSH 官方仓库功能关闭时正常退出。
- 沙箱真实 smoke 通过：cordiverse/cordis 2 issues + 3 PR，第二轮命中 5 条缓存；DSH 官方仓库仅提示关闭。115 项测试通过。

