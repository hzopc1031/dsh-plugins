# 更新记录

## 0.2.0 · 2026-11-11

- AI 主导最终研判，规则仅提供证据。无模型、调用失败、输出校验失败时只显示预筛证据和明确提示，不缓存为已研判。
- 新增业务说明 business / businessFile：仓库默认分支或本机普通文件；带引号命令增改清除，保存在自身存储域。
- issue / PR 必填 businessReason，新增 exists / worthFixing / fitsDirection / testing；片段最多 3 文件、每文件 3KB，模型上下文最多 48KB。
- 模型路由、业务说明内容参与缓存指纹；新增 /triage-models，使用 rc.5 官方只读目录接口列出真实 ID。
- 0.1.0 状态升级保留仓库设置与用户纠正，清除旧派生缓存、报告、待发简报。
- 重写中文上手文档，smoke 支持业务说明与明确标注的 --mock-model；更新测试、临时 profile 加载验证与预构建 lib。

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

