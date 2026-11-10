# 开发状态

本次 0.2.0 优化、验证与推送状态见 [OPTIMIZE_REPORT.md](../../OPTIMIZE_REPORT.md)。下列首版执行记录为历史记录；不表示本次已做桌面验收。

- 包名：`dsh-draft-rescue`
- 版本：`0.2.0`
- 许可证：MIT
- 日期：2026-11-10
- 代码目录：`packages/dsh-draft-rescue`
- 桌面入口：会话头部「未发送草稿」；无斜杠命令。

## 已完成

- 独立 Cordis bundle 与 browser factory，通过 rc.5 会话头部 list slot 追加入口。
- 精确检查启动图 release.version 为 `0.2.1-rc.5`；未知或其他版本在接触 localStorage 前拒绝读取并显示提示。
- 枚举 `dsh.conversation.<sessionId>` 下非空文字草稿，包括侧栏隐藏的旧空会话；空白/损坏记录不显示。
- 支持旧字符串与 rc.5 结构草稿；预览、复制原文、通过 revision-guarded insertText 在当前输入末尾追加。
- 当前引用胶囊按 detect 坐标计算，忙碌/命令模式禁止追加。不会自动发送。
- 不替换导航、不复用旧会话、不改会话列表、不迁移/删除存储、不恢复 mention pills 或附件。
- 预构建 lib、index.js/index.d.ts、locale、原创 SVG、中文安装/验收文档、独立 lockfile、第三方许可说明与精确 pack 白名单。

## 测试记录

在本包目录执行，环境为 Windows、Node 24.20.0、npm 11.19.0：

| 命令 | 结果 |
| --- | --- |
| `npm view dsh-draft-rescue version --registry=https://registry.npmjs.org` | 2026-11-10 返回 E404 / Not Found，查询时包名未占用；退出码 1 符合预期 |
| `npm install --ignore-scripts --no-audit --no-fund` | 开发依赖安装成功；DSH 类型依赖固定 rc.5 |
| `npm test` | 先 build，25/25 通过，0 失败、0 跳过 |
| `npm run typecheck` | strict 类型检查通过 |
| `npm run verify-pack` | 17 个发布文件，预构建 factory、导出/声明、bundle、locale 和无安装期脚本检查通过 |

测试包含核心纯逻辑、真实 Cordis 宿主加载/卸载、jsdom + React 执行预构建 browser factory。模拟旧空会话切走后的草稿找回、复制文字与 insertText 参数、原文空白、空草稿隐藏、坏记录、版本锁零读取、胶囊坐标、剪贴板拒绝及 revision 失败。Modal、槽位、剪贴板和输入动作使用替身。Node 的 Windows shell 调 npm 会输出 DEP0190 提示，命令与参数均为固定常量。

## 未测及边界

- 未安装进或运行于真实桌面 DSH，没有更改用户 profile 或全局配置。
- 未验证原生视觉、焦点/键盘、Electron 系统剪贴板、真实 Lexical 输入与完整退出后的持久化、GitHub 安装流程。
- 只能恢复当前浏览器源中已经由宿主保存且尚未删除的文字；没有自动备份或跨设备读取。
- 不恢复引用胶囊、命令语义或附件；结构草稿只输出 text 的文字投影。
- 版本号相同的自定义构建无法由版本字符串辨认，未声称兼容；没有猜测其他版本的存储格式。
- 没有草稿时间戳，按 Session ID 排序；未进行大规模草稿性能压测。
- STATUS.md 与测试/脚本保留源码，不进入发布包。最终目录不保留 node_modules、tgz 或临时产物；lib 为需要交付的预构建文件。
