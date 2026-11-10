# 开发状态

- 包名：`dsh-file-ref-copy`
- 版本：`0.1.0`
- 许可证：MIT
- 日期：2026-11-10
- 代码目录：`packages/dsh-file-ref-copy`
- 桌面入口：已加载且已完成回答的操作区「复制文件路径」；无斜杠命令。

## 已完成

- Cordis bundle 与 rc.5 `conversation.chat.assistant-actions` 独立 list 入口。
- 按所属 messageId，从已加载 Chat snapshot 的最终 assistant 原始文字块读取 Markdown；不请求历史、不读 DOM href、不包含推理/工具结果/中断文本。
- 成熟 CommonMark/GFM AST 解析库，支持引用式链接、代码标签、表格与格式嵌套，排除代码、图片目标、HTML 和裸路径。
- 遵循 rc.5 本地目标规则，中文、空格、单次百分号解码、相对路径、单行/行范围均处理。
- 列表与原文路径预览；复制绝对、相对、带行号路径。当前 Session cwd 未知或跨盘时禁用不可用形式；无行号时禁用相应按钮。
- Windows 路径大小写比较、跨盘、盘符根目录的 `..` 处理；输出 `/` 分隔符及 `#Lx-Ly`。
- 预构建 lib、index.js/index.d.ts、locale、原创 SVG、中文安装/验收文档、独立 lockfile、内联依赖许可与 pack 白名单。

## 测试记录

在本包目录执行，环境为 Windows、Node 24.20.0、npm 11.19.0：

| 命令 | 结果 |
| --- | --- |
| `npm view dsh-file-ref-copy version --registry=https://registry.npmjs.org` | 2026-11-10 返回 E404 / Not Found，查询时包名未占用；退出码 1 符合预期 |
| `npm install --ignore-scripts --no-audit --no-fund` | 开发依赖安装成功；DSH 类型依赖固定 rc.5 |
| `npm test` | 先 build，40/40 通过，0 失败、0 跳过 |
| `npm run typecheck` | strict 类型检查通过 |
| `npm run verify-pack` | 17 个发布文件，预构建 factory、导出/声明、bundle、locale 和无安装期脚本检查通过 |

包含 36 项核心案例及 4 项 factory/UI 交互案例：中文/空格/相对路径/行号/百分号、文件名中的 #?%、非法 URI/UNC/片段/控制字符、引用式链接与代码排除、去重、缺 cwd、跨盘/大小写、根目录 `..`、已完成消息选择。真实 Cordis 加载/卸载宿主入口，jsdom + React 执行预构建 factory 并点三种复制按钮。Modal、槽位与剪贴板为替身。Node 在 Windows shell 调 npm 会输出 DEP0190 提示，参数为固定常量。

## 未测及边界

- 未在真实桌面 DSH 安装或运行，没有修改用户 profile 或全局配置。
- 未验证真实 assistant-actions 位置/视觉、键盘和焦点、原生系统剪贴板权限、完整重启、GitHub 实际安装或其他 DSH 版本/操作系统。
- 只处理所属回答已加载且已完成的文字；不拉取历史，不接管普通 Ctrl+C、划词复制、整条复制或模型执行。
- 不检查文件存在、符号链接和盘符映射；不处理 file://、vscode://、UNC 等 rc.5 本地链接规则不接受的格式。
- 标准 CommonMark/GFM 解析，不实现官方额外数学与中文强调容错扩展；未进行大回答性能压测。
- STATUS.md、源码、测试和构建脚本不进入发布包；最终目录不留 node_modules、tgz 或临时文件，预构建 lib 与第三方许可证保留。
