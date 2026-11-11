# Changelog

## 0.2.2 - 2026-11-11

- 修正 DSH 版本声明为 `>=0.2.1-rc.5 <0.3.0-0`，采用官方包含预发布版本的校验规则，并排除 0.3.0 预发布版本。
- 放宽 DSH peer 范围，显式覆盖 rc.5 / rc.1 的标准 npm semver 安装校验；开发依赖保持原版本。
- 同步锁文件自身版本、打包断言及当前版本标识；兼容性声明不等于逐版本功能验证。

## 0.2.1 — 2026-11-11

- 修复在任务已运行后加载、重载或恢复依赖时漏掉 `agent/status: running`，导致全程不启动计时的问题；加载时接管 Registry 中正在运行的会话，从接管时刻计时，不回放旧日志。保留总开关和子代理过滤。
- 卡片发送失败记录会话、提醒类型与脱敏原因；命令未找到或被覆盖也会报告，不再当作成功发送。
- 增加真实 rc.5 Registry、scope 分发、SessionStore、CommandRuntime 的 26 分钟静默与重载回归，验证 5 张进度卡、2 次警告及 idle 后停止；补充配置过滤和发送失败测试。
- 保留系统通知默认关闭。rc.5 源码支持插件发起的命令结果实时显示；Electron 实际显示、另一台电脑的加载状态仍待验证。详细依据见仓库内 `STALL_ANALYSIS.md`。
- 预构建 `lib/` 与版本同步；未发布到 npm。

## 0.2.0 — 2026-11-10

心跳观察 tools/result 中经过校验的 bash foreground canonical value，非零退出、signal、超时、取消、sandbox 拒绝可计为失败，即使 isError=false。只缓存简短失败分类，不保存 canonical 输出正文；在匹配的 native/PTC 日志结果入账时计数一次。后台启动/提升并非进程失败，输出中的伪造退出码不参与判断。PTC 通过 subCallId 配对，run_code 外层与子调用分别计数。历史日志缺少 canonical value 时不从输出猜测进程状态。

- 新版本尚未 npm publish；预构建 lib、独立 lockfile 与回归测试同步。
- 验证范围为 rc.5 运行时与 headless/jsdom；Electron 人工验收仍待执行。

## 0.1.0 — 2026-11-10

- 以 npm 包名 `dsh-heartbeat-monitor` 发布（`dsh-heartbeat` 已被无关包占用），源码位于 hzopc1031/dsh-plugins 的 packages/dsh-heartbeat-monitor。

- 首个版本：定时进度卡、静默超时警告、重复工具/重复错误警告、可选系统通知、`/heartbeat` 手动查看。
- 核心规则为纯函数，假时钟单元测试；另有基于真实 rc.5 运行时包（Cordis、SessionStore、CommandRuntime）的集成测试。
