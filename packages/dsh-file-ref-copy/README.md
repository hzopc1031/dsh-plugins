# 文件引用路径复制 · dsh-file-ref-copy

当前源码版本 **0.1.1**（尚未发布本次版本到 npm）。相对链接改用 rc.5 useProjection("workingDirectory") 的宿主计算结果，不使用会话列表的初始 cwd；投影缺失/null 时保留路径未知的降级，不猜测当前目录。目录、会话或回答变化会清空已展开的路径，避免继续复制旧解析结果。相对链接只能按当前有效目录解释，不能反推旧回答生成时的目录；历史回答请核对原始绝对链接。

本次只完成 Windows 上的 typecheck、单元/rc.5 headless 集成、browser factory 的 jsdom 检查及 verify-pack；未安装到真实 DSH、未做 Electron 目视验收。最新批次记录见仓库 [OPTIMIZE_REPORT.md](../../OPTIMIZE_REPORT.md)。

版本 **0.1.1**，MIT。面向官方 **DSH 0.2.1-rc.5**。未发布 npm / not published to npm。

在**已加载、已完成的回答操作区**点击 **「复制文件路径」**，面板会从该回答的原始 Markdown 提取本地文件链接，列出实际路径，并提供「复制绝对路径」「复制相对路径」「复制带行号路径」。标签可以只写“报告”；复制取链接目标，不从渲染后可能已丢失 href 的 DOM 反推。

仅处理这个按钮所属的已完成回答；不请求未加载历史、不包含流式或被中断回答、不读取推理、工具结果或附件内容。没有斜杠命令，不会调用模型或读写文件。

## 安装

先完全退出桌面 DSH（含托盘），用桌面版自带 CLI：

```powershell
& "$env:LOCALAPPDATA\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop add "github:hzopc1031/dsh-plugins#main&path:/packages/dsh-file-ref-copy"
```

也可通过 **插件 → 添加插件**，输入：

```text
github:hzopc1031/dsh-plugins#main&path:/packages/dsh-file-ref-copy
```

安装后重新打开桌面 DSH。不要依赖 PATH 上可能报 desktop profile 由 Electron 管理的独立 `dsh`。包包含 Cordis bundle、`cordis.patch.yml`、预构建 `lib/` 和类型声明；安装时无需构建。将 git 地址中的 `main` 换成提交哈希可固定版本。

## 路径与解析规则

使用成熟的 **mdast-util-from-markdown + micromark GFM** 解析 Markdown AST，支持行内链接、引用式链接、表格及带格式/代码的标签；这些也是官方 rc.5 Markdown 实现使用的解析库。代码块、行内代码、裸路径、图片地址和原始 HTML 不视为文件链接。相同目标及行号范围去重；不同范围各自保留。

文件链接规则对应 rc.5 `parseFileLink`：目标可以是工作区相对路径、POSIX 绝对路径或 Windows 盘符路径；百分号转义**只解码一次**；中文和空格保留。含空格的 Markdown 目标应使用 `<...>` 或 `%20`。`?`、`#` 若是文件名字符，必须写成 `%3F`、`%23`；未转义查询参数不接受。支持 `#L24`、`#L24-L30`，行号必须是正安全整数，末行不能小于首行。带行号复制保留整个行号片段，不转换成冒号格式。

例如工作区为 `C:\项目 空格` 时：

```markdown
[报告](docs/%E4%B8%AD%E6%96%87%20Notes.md#L24-L30)
[源文件](<C:/项目 空格/src/入口.ts#L2>)
```

第一条分别复制为：

```text
C:/项目 空格/docs/中文 Notes.md
docs/中文 Notes.md
C:/项目 空格/docs/中文 Notes.md#L24-L30
```

复制路径统一使用 `/` 分隔符，Windows 可识别；保留文件名大小写、中文、空格和文字百分号。相对路径针对**该回答所属 Session 的 cwd**计算，可包含 `..`；Windows 同盘比较忽略目录大小写。不同盘符不能生成相对路径，按钮禁用。工作区未知时，相对目标仍可复制相对形式，绝对目标仍可复制绝对形式，缺失的另一种形式不会猜测；无行号时禁用带行号按钮。带行号优先使用绝对路径，无法解析绝对路径时使用相对路径。

遵循 rc.5，不接受 `file://`、`vscode://`、HTTP(S)、其他 URI scheme、网络/UNC 地址、纯 fragment、控制字符、损坏百分号转义或非法行号。复制是纯文本操作，不检查目标文件存在与否；符号链接、真实盘符映射和相对路径的实际文件系统解析不在范围内。

## 手工验收方法

以下为安装后的待执行桌面步骤：

1. 在有 cwd 的本地工作区，让 DSH 的完整回答包含上面的示例链接，等回答完成。
2. 点击该回答操作区「复制文件路径」，确认标签“报告”对应的目标仍包含中文、空格及正确目录。
3. 分别复制三种形式，粘贴到文本编辑器核对绝对路径、工作区相对路径和 `#L24-L30`。
4. 用相对 `../资料/a%20b.md#L7`、中文绝对路径和引用式 Markdown 链接重复；确认转义只解码一次，标签里没有路径也能复制正确目标。
5. 不加载更早历史，确认入口只使用所属的已加载回答；生成中和被中断回答不应出现此入口。当前回答无链接时显示空状态。

## 开发与测试

在本包目录执行：

```powershell
npm ci --ignore-scripts
npm test
npm run typecheck
npm run verify-pack
```

已测 **40/40**，0 失败、0 跳过。`npm test` 先 build，再运行 `node:test`。覆盖中文/空格、相对路径、绝对路径、百分号转义、单行/范围、文件名中的 `#?%`、无 cwd、Windows 跨盘与大小写、根目录 `..`、AST 引用式链接、代码排除、去重、未加载/流式/中断数据排除。用 jsdom + React 加载实际预构建 factory，验证按钮复制出的三种文字及失败提示；真实 Cordis 加载/卸载宿主入口。类型检查与精确打包白名单通过；Windows 调 npm 使用 `shell`。

**未在真实 Windows 桌面 DSH 安装或运行验证。** jsdom 使用槽位、Modal 和剪贴板替身；未验证真实 assistant-actions 的视觉布局、系统剪贴板权限、焦点/键盘、Electron 完全重启、GitHub 实际安装流程，或其他 DSH 版本及操作系统。未做大回答性能压测。解析器只处理标准 CommonMark/GFM，不实现官方额外的数学/中文强调容错扩展。

浏览器 bundle 内联解析器及其依赖；第三方许可证随包放在 `THIRD_PARTY_NOTICES.md`。宿主 React、Cordis、UI primitives 保持外部共享，遵循 rc.5 lazy-CJS factory 协议，无安装期脚本。

## rc.5 依据

- [本地文件链接规则](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-primitives/src/markdown/file-link.ts)、[官方边界测试](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-primitives/tests/markdown-file-links.client.spec.tsx)
- [原始已完成回答结构](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-conversation/src/client/contract/records.ts)、[已加载 Chat snapshot](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-chat/src/client/contract/snapshot.ts)、[assistant-actions 槽位](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-chat/src/client/contract/slots.ts)
- [官方解析库](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-primitives/src/markdown/parse.ts)、[UI primitives](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-primitives/README.md)、[工作区路径](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/util/workspace-path/src/index.ts)
- [Discussion #9129](https://github.com/deepseek-ai/deepseek-harness/discussions/9129) 为问题背景；本插件提供显式路径面板，不接管普通划词复制、Ctrl+C 或整条回答复制。

MIT，见 LICENSE。

## 本版本开发校验

在本包目录独立执行，使用本包 lockfile（根目录无 workspaces）：

```powershell
npm ci --ignore-scripts
npm run typecheck
npm test
npm run verify-pack
```

`npm test` 会重建需提交的 lib/。以上通过不等于 Electron 桌面通过；真实截图、剪贴板、焦点/布局及桌面安装仍需人工验收。

本次接口依据（固定 rc.5）：[packages/client/ui-session/src/client/index.ts](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-session/src/client/index.ts)、[packages/session/working-directory/src/index.ts](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/session/working-directory/src/index.ts)。
