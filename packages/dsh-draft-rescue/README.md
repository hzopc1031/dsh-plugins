# 未发送草稿 · dsh-draft-rescue

当前源码版本 **0.2.0**（尚未发布本次版本到 npm）。草稿面板支持按会话 ID 或正文筛选，每页 20 条，点击“预览原文”才挂载该条正文。搜索和分页不修改 localStorage；复制/追加保留原文。追加使用最新输入状态的 draftRev 和胶囊坐标，由宿主 insertText 做 revision guard，不使用 setDraft 覆盖现有输入。会话切换关闭面板并清理预览，迟到的剪贴板结果不回填新面板。仍需枚举并读取当前源中的草稿，分页只减少 DOM/正文渲染开销。

本次只完成 Windows 上的 typecheck、单元/rc.5 headless 集成、browser factory 的 jsdom 检查及 verify-pack；未安装到真实 DSH、未做 Electron 目视验收。

版本 **0.2.0**，MIT。适用于官方 **DSH 0.2.1-rc.5**。未发布 npm / not published to npm。

切到新会话后，在会话头部点击 **「未发送草稿」**，即可查看本机保存的非空文字草稿，包括已被侧栏隐藏的旧空会话。面板按会话 ID 排序，并显示会话列表或当前会话投影中的可靠标题和工作区（读不到则标为「未知」，不使用会回退到 id/目录名的 displayTitle）。当前会话条目标为「当前会话草稿」，顶部写明追加目标。可用标题、工作区、会话 ID 或正文筛选。展开条目预览，用「复制原文」复制完整文字，或用「追加到当前输入框」追加文字。支持手动刷新。

首版只处理文字：结构草稿的 `text` 中若有引用的剪贴板文字，也按普通文字复制，不重建 mention pills、命令胶囊或附件。复制保留原文的首尾空白、换行和 Unicode。已有输入非空时，追加先加一个换行，再插入原文。追加通过官方 `inputActions.insertText(text, span)` 执行，范围折叠到文末，并使用 `draftRev` 防止覆盖之后的编辑；已有引用胶囊按 rc.5 的一字符坐标计算。输入框忙碌或处于命令模式时禁止追加，复制仍可使用。不会自动发送。

## 安装

先完全退出桌面 DSH（含托盘），用桌面版自带 CLI 执行：

```powershell
& "$env:LOCALAPPDATA\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop add "github:hzopc1031/dsh-plugins#main&path:/packages/dsh-draft-rescue"
```

也可通过 **插件 → 添加插件**，输入：

```text
github:hzopc1031/dsh-plugins#main&path:/packages/dsh-draft-rescue
```

安装后重新打开桌面 DSH。无需 PATH 上的独立 `dsh`；它可能报 desktop profile 由 Electron 管理。包内提供 Cordis bundle、`cordis.patch.yml`、预构建 `lib/` 和声明文件，没有安装期构建脚本。将 git 地址中的 `main` 换成提交哈希可固定代码版本。

## 存储约定与版本锁定

读取当前桌面浏览器源下的 `localStorage`，键前缀为 **`dsh.conversation.`**，后缀是原 Session ID。例如：

```json
{
  "draft": { "text": "尚未发送的文字", "references": [] },
  "view": null,
  "viewRequest": null
}
```

rc.5 也兼容旧式 `{"draft":"文字","view":null,"viewRequest":null}`。结构草稿还可含 `command: {token}`；引用项包含 `source`、`ref`、`offset`、`length`、`label`、`clipboardText`，可选 `appearance` 和 `invalid`。本插件校验文字、命令和引用跨度后只返回文字。空串、纯空白、损坏 JSON、不符合结构的记录以及没有 Session ID 的键都不展示；单条损坏记录不影响其他条目。存储访问被拒绝时显示错误。

**这些键与结构是 DSH 内部约定，不是稳定的插件持久化 API。** 包的 `engines.dsh` 精确声明 `0.2.1-rc.5`；每次扫描前还读取官方启动图 `window.__DSH_BOOT__.release.version`，必须严格等于 `0.2.1-rc.5`。缺失、其他版本或带额外自定义后缀都会显示「已拒绝读取草稿」，且在失败时不访问 localStorage。复制和追加也复查版本。不会通过猜测键名或数据结构兼容新版本；自定义构建即使沿用相同版本号，也不代表已验证兼容。

面板只读现有存储，不创建备份、不迁移或删除原草稿，不获取其他浏览器源、设备或桌面 profile 的数据。DSH 自身若已清理记录、尚未写入存储，或用户清空了应用数据，本插件无法找回。记录没有可依赖的更新时间，因此不声称按时间排序。

## 与 dsh-session-drafts 的区别

本插件提供独立找回入口，**不替换新会话导航、不复用旧 Session、不覆盖或改写会话列表投影**，保留 rc.5「创建全新 Session」及「非当前空会话隐藏」的行为。面板枚举存储时不依赖侧栏是否展示会话，也不会为了显示草稿把空会话重新加入侧栏。仅在用户点击追加时修改当前输入框。

## 手工验收方法

以下步骤是安装后的待执行桌面验收，不代表已经做过真实桌面测试：

1. 在一个新会话写入含中文、空格、空行的文字，不发送；再创建全新会话。
2. 点击头部「未发送草稿」，确认旧会话的草稿可见，即使侧栏不再显示该空会话；新会话空草稿不应出现。
3. 展开预览，点「复制原文」，粘贴到文本编辑器逐字比较首尾空白和换行。
4. 在当前输入框输入一段新文字，然后追加旧草稿，确认新文字保留、旧文字位于末尾且没有发送。当前输入框含引用时再重复一次。
5. 确认继续点击新会话仍创建全新 Session；版本不符或无法识别时，面板应拒绝读取而不是列出猜测结果。

## 开发与测试

在本包目录执行：

```powershell
npm ci --ignore-scripts
npm test
npm run typecheck
npm run verify-pack
```

已测：**25/25**，0 失败、0 跳过。`npm test` 先 build，再运行 `node:test`。覆盖非空/空草稿、隐藏空会话、旧字符串和 rc.5 结构、复制原文、末尾追加、胶囊坐标、忙碌状态、版本锁失败前零存储访问、剪贴板拒绝和过期 revision。另用 jsdom + React 运行实际预构建 browser factory，模拟新会话的找回、复制和追加按钮；真实 Cordis 加载/卸载宿主入口。类型检查和精确打包白名单通过，Windows 调 npm 使用 `shell`。

**未在真实 Windows 桌面 DSH 安装或运行验证。** jsdom 测试用槽位、Modal、剪贴板及输入动作替身，不能证明 Electron 剪贴板权限、真实 Lexical 输入、布局、焦点/键盘、重启持久化或 GitHub 安装流程已通过。未验证其他 DSH 版本、macOS、Linux、跨设备或大规模草稿性能。

## rc.5 依据

- [草稿存储源码](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-conversation/src/client/stores.ts)、[结构校验](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-conversation/src/client/draft.ts)
- [输入动作与 TokenSpan](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-conversation/src/client/contract/input.ts)、[胶囊坐标](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-conversation/src/client/input/editor/projection.ts)
- [空会话隐藏规则](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-workspace/src/client/tree.ts)、[槽位](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/docs/subsystems/slots.md)、[启动图 release](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/docs/subsystems/client-modules.md)
- [Discussion #10021](https://github.com/deepseek-ai/deepseek-harness/discussions/10021) 为问题背景；讨论里的后续提案不作为 rc.5 可用接口。

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

本次接口依据（固定 rc.5）：[packages/client/ui-conversation/src/client/contract/input.ts](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-conversation/src/client/contract/input.ts)。
