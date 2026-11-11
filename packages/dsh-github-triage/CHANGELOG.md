# 更新记录

## 0.3.1 · 2026-11-11

- 中文用户可见名称统一为「GitHub 哨兵」，同步会话顶部按钮、弹窗、插件设置、命令描述、报告标题与文档；包名、命令名和功能逻辑保持不变。

## 0.3.0 · 2026-11-11

- 新增中文界面：会话顶部「GitHub 仓库研判」按钮，通过 rc.5 conversation.session.header.actions 插槽打开共享 Modal。遵循既有 UI 包的 dsh.client/platform:web/inject 与 lazy-CJS factory 协议，React/primitives 外部共享。
- 管理仓库、业务说明与文件、本地 Git 路径/ref、类型、定时和上限；共享 zod 校验，按字段 patch 合并到最新配置。/triage-repo add 对同名仓库改为合并显式字段，六个旧命令和语法继续可用。
- 模型状态及真实只读模型 ID 目录；手动普通/全量分析通过原串行队列异步执行，显示任务状态、同仓库防重复入队；三档分组、类型筛选、业务结论、本地证据和安全原链接。
- 详情中纠正三档结论并填写理由，规则可查看和导出，默认不覆盖。没有新增 GitHub 写操作或本地代码修改。
- 预构建 lib 与浏览器 bundle 纳入 42 文件发布白名单；临时 rc.5 profile 验证 client 入口。UI smoke 改用系统 TEMP、桌面自带 CLI 本地路径离线安装、独立无头 Edge/CDP、截图与失败清理；真实 UI 在沙箱中因 CLI 访问被拒未验证。
- 新增结构化 /triage-ui 数据命令，借助宿主真实 commands.execute remote 承接界面调用；结果沿用宿主会话命令日志。新增服务端和 jsdom 测试、client 入口与 UI smoke 验证脚本。

## 0.2.0 · 2026-11-11

- 新增可选 localRepoPath / localRef 与 add --local、local / --clear 命令。固定 argv、shell:false 的只读 Git 白名单，限制时间、取消与输出；对照本地提交快照、文件/函数片段、修复提交、提交包含关系和完整 patch-id，模型输出 localApplicability / localReason。
- issue / PR 统一 recommendation：adopt、manual-review、not-recommended；两者均有优先级，卡片和简报按三档及优先级排序，保留细分判断、reason 与 businessReason。
- 新增 --full / --since / --until / --max，按更新时间扫描开放与关闭条目，默认 100、硬上限 500；支持全局/仓库 fullMax，超限仅取最近并提示费用和限流。定时仍用增量窗口；不支持标签区间。
- /triage-fix 支持三档值；业务说明与纠正形成仓库级 Markdown 规则，新增 /triage-rules 查看/导出/导入及只读 rulesFile。导出只写显式指定路径，默认拒绝覆盖，--force 仍拒绝链接/特殊文件；模型注入有长度限制。
- 内部状态 formatVersion:3，清除旧派生缓存、报告、待发简报，迁移保留用户纠正；本地提交和规则内容参与指纹。
- 扩展真实临时 Git 测试与 rc.5 临时 profile 验证；smoke 支持本地对照、全量参数及三档模拟模型。重建 lib，保持 0.2.0，不发布 npm。


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

