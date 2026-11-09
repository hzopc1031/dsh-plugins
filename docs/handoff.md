# 交接：dsh-task-review 0.1.0

日期：2026-11-09。开发、类型检查、单元/集成测试和独立 profile 官方 Loader 冒烟完成。**本地提交未完成：沙箱禁止写入 `.git`**。没有远端、push、npm 发布或主 DSH 安装。

## 实现

- 标准 bundle；TypeScript 源码与预编译 lib；双语元数据、原创 MIT SVG。
- core：脱敏、正文省略、门槛、报告、安全唯一文件名与存档。
- state：会话后缀折叠、载荷校验、可恢复边界、跳过分叉继承前缀。
- plugin：工具观察、原生 /review、idle 自动触发、按会话串行化、失败不推进边界、注销及 flush 等待。
- 文件分类只用工具域结果/宿主 workspaceChanges；费用和缺失 token 不估算；下一步仅基于失败/未完成证据。
- 宿主 GenericCommandCard 显示短摘要，可展开 Markdown 源文本；不附加模型消息。

## 验证

Windows、Node v24.20.0、固定 DSH 0.2.1-rc.5；依赖有 lockfile。所有 @deepseek-ai/* 都列于 peerDependencies/devDependencies，测试和可选服务 peers 标 optional，无 install/postinstall。

| 检查 | 结果 |
| --- | --- |
| npm run typecheck | strict tsc --noEmit 通过，宿主声明 skipLibCheck |
| npm test | 11/11 通过，Node test runner 同进程隔离 |
| npm run test:profile | PASS：唯一临时 DSH_HOME / task-review-test profile，官方 initProfile + loadProfileDirectory + boot/Loader，bundle 加载、真实工具事件、/review、报告写入均有断言，finally dispose + 清理 |
| 安装版 CLI 独立 profile --dump-config + 本 bundle overlay | 通过，结果含 task-review 行；仅 .tmp/profile-probe |
| npm pack --ignore-scripts --cache .tmp/npm-cache --json | 本地包完整性检查；不发布 |
| SVG XML 解析 | 通过；351 字节，原创 |

测试覆盖：门槛 OR、auto off、唯一文件数、递归脱敏与脚本省略、报告字段、失败/疑似重试/未完成、路径与命名、真实 Cordis 加载、工具事件、手动/自动触发、并发防重、恢复边界、存档失败重试、schema、命令注销、宿主文件分类 seam、历史原生结果回退、损坏边界忽略。

npm 默认缓存不可写，改为 .tmp/npm-cache；默认 Node test 子进程 spawn EPERM，改用 --test-isolation=none。未读取 _private、edge-cookies 或账户凭据，未写其他工作区或主 profile。

## 未验证与限制

- Web 卡片/图标/双语插件行没有浏览器目视验证。折叠 pre 正文由安装版源码证实。
- 未运行真实模型、付费请求、完整 agent loop 或模型驱动的 PTC 嵌套程序。
- CLI add/remove 包管理器安装未测；profile 测试用临时 junction + 官方 composer/Loader。
- workspaceChanges 的真实 git/shell 捕获未测，测的是公开 summary/diff seam；JSONL 跨进程恢复未测，测的是 Session seed 恢复。
- 无法识别任意无标记自由文本秘密；脚本和文件正文不保存。本插件不改写宿主已有的原始日志。
- 仅统计最终 assistant/message 的权威用量，失败尝试及缺失样本标不可用；没有费用金额。无法确认文件类型时不猜；未完成 PTC 暂不可枚举。
- 文件与 Session 持久化不是跨资源事务；崩溃窗口可能留下孤立文件或恢复后重复。
- 已调用 API 均有本机类型/源码证据，见 api.md；不宣称上述未验证路径通过。

## Git 阻塞与 Liu 后续

本目录已 git init。git add docs/00-task.md .gitignore 和首次 git commit 均因不能创建 .git/index.lock 而失败。环境将 .git 设为只读，审批策略 never。没有绕过限制；当前文件仍未跟踪，没有 commit。

Liu 可在普通本地终端完成两步本地提交：

```powershell
git add .gitignore docs/00-task.md
git commit -m "docs: record task review requirements"
git add LICENSE README.md cordis.patch.yml docs/api.md docs/handoff.md icon.svg index.js lib locale package.json package-lock.json scripts src test tsconfig.json
git commit -m "feat: add session task reviews with isolated profile tests"
```

需 Liu 决定：正式使用哪个独立 profile、reportDir 是否改到 DSH_HOME。默认值遵照任务；发布、截图、远端不在本次授权范围。
