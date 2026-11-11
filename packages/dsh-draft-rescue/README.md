# 未发送草稿 · dsh-draft-rescue

在会话头部找回本机未发送的文字草稿，预览、复制或追加到当前输入框。

- 不必逐个翻会话：集中列出本机文字草稿，也能找到侧栏已隐藏的空会话草稿。
- 少找错追加目标：显示可靠标题、工作区和当前会话，支持筛选及分页。
- 保留现有输入：按修订号检查后追加文字，无法安全追加时给出手动粘贴提示。

示意输出（非实机截图）：

```text
未发送草稿
会话 old-session · 标题：上周讨论；工作区：D:\work\alpha
[预览原文] [复制原文] [追加到当前输入框]
```

切到新会话后，在会话头部点击 **「未发送草稿」**，即可查看本机保存的非空文字草稿，包括已被侧栏隐藏的旧空会话。面板按会话 ID 排序，并显示会话列表或当前会话投影中的可靠标题和工作区（读不到则标为「未知」，不使用会回退到 id/目录名的 displayTitle）。当前会话条目标为「当前会话草稿」，顶部写明追加目标。可用标题、工作区、会话 ID 或正文筛选。展开条目预览，用「复制原文」复制完整文字，或用「追加到当前输入框」追加文字。支持手动刷新。

首版只处理文字：结构草稿的 `text` 中若有引用的剪贴板文字，也按普通文字复制，不重建 mention pills、命令胶囊或附件。复制保留原文的首尾空白、换行和 Unicode。已有输入非空时，追加先加一个换行，再插入原文。追加通过官方 `inputActions.insertText(text, span)` 执行，范围折叠到文末，并使用 `draftRev` 防止覆盖之后的编辑；已有引用胶囊按宿主的一字符坐标计算。rc.1 目标输入框已有原子引用块时，公共输入状态无法给出其折叠坐标，宿主会安全拒绝追加；请复制原文后手动粘贴。输入框忙碌或处于命令模式时禁止追加，复制仍可使用。不会自动发送。

## 三步快速上手

1. **完全退出桌面 DSH。** 关闭所有窗口，并从系统托盘退出 DSH，确认退出后再安装或更新。

2. **在终端安装插件。**

   ```powershell
   dsh plugin --profile desktop add "github:hzopc1031/dsh-plugins#main&path:/packages/dsh-draft-rescue"
   ```

   若 PATH 上的独立 CLI 报 desktop profile 由 Electron 管理，可用桌面版自带 CLI：

   ```powershell
   & "$env:LOCALAPPDATA\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop add "github:hzopc1031/dsh-plugins#main&path:/packages/dsh-draft-rescue"
   ```

3. **重新打开 DSH 并启用插件。** 在会话头部点击「未发送草稿」，展开一条记录并复制原文；在普通输入框中也可点「追加到当前输入框」。无需额外配置，不会自动发送。

包内包含预构建 lib、类型声明和 Cordis patch，没有安装期构建脚本。将 Git 地址中的 main 换成提交哈希可固定版本。

## 存储约定与结构校验

读取当前桌面浏览器源下的 `localStorage`，键前缀为 **`dsh.conversation.`**，后缀是原 Session ID。例如：

```json
{
  "draft": { "text": "尚未发送的文字", "references": [] },
  "view": null,
  "viewRequest": null
}
```

两版都兼容旧式 `{"draft":"文字","view":null,"viewRequest":null}`。结构草稿还可含 `command: {token}`；引用项包含 `source`、`ref`、`offset`、`length`、`label`、`clipboardText`，可选 `appearance` 和 `invalid`。rc.1 另支持 `quotes: [{offset,length,text}]` 原子引用块。本插件核对引用/命令/引用块的文字投影与不重叠跨度后只返回文字，不重建节点。空串、纯空白及没有 Session ID 的键不展示。匹配存储前缀的记录若有损坏 JSON、未知字段或格式不符，会拒绝整次扫描并显示清晰错误，未修改原记录；存储访问被拒绝时也显示错误。

**这些键与结构是 DSH 内部约定，不是稳定的插件持久化 API。** 每次扫描前检查实际输入接口；读取候选 JSON 后严格识别外层和草稿格式，无法识别时不将内容展示或用于追加。复制和追加也重新检查接口。不会通过猜测新格式迁移或修复原存储。

面板只读现有存储，不创建备份、不迁移或删除原草稿，不获取其他浏览器源、设备或桌面 profile 的数据。DSH 自身若已清理记录、尚未写入存储，或用户清空了应用数据，本插件无法找回。记录没有可依赖的更新时间，因此不声称按时间排序。

## 与 dsh-session-drafts 的区别

本插件提供独立找回入口，**不替换新会话导航、不复用旧 Session、不覆盖或改写会话列表投影**，保留宿主「创建全新 Session」及「非当前空会话隐藏」的行为。面板枚举存储时不依赖侧栏是否展示会话，也不会为了显示草稿把空会话重新加入侧栏。仅在用户点击追加时修改当前输入框。

## 手工验收方法

以下步骤是安装后的待执行桌面验收，不代表已经做过真实桌面测试：

1. 在一个新会话写入含中文、空格、空行的文字，不发送；再创建全新会话。
2. 点击头部「未发送草稿」，确认旧会话的草稿可见，即使侧栏不再显示该空会话；新会话空草稿不应出现。
3. 展开预览，点「复制原文」，粘贴到文本编辑器逐字比较首尾空白和换行。
4. 在当前输入框输入一段新文字，然后追加旧草稿，确认新文字保留、旧文字位于末尾且没有发送。当前输入框含引用时再重复一次。
5. 确认继续点击新会话仍创建全新 Session；接口或存储结构无法识别时，面板应拒绝读取而不是列出猜测结果；目标含原子引用块时应拒绝追加且保留原输入。

## 开发与测试

在本包目录执行：

```powershell
npm ci --ignore-scripts
npm test
npm run typecheck
npm run verify-pack
```

本版自动测试 **29/29**，覆盖 rc.5 / rc.1 / 未知标签下的有效接口，损坏或未知结构整批拒绝、引用块投影与重叠校验、原存储字节不变、剪贴板失败、追加坐标、修订防护和忙碌状态。实际预构建 browser factory 使用 jsdom + React，宿主入口用真实 Cordis 加载/卸载；未用 rc.1 依赖单独编译。

**未在真实 Windows 桌面 DSH 安装或运行验证。** jsdom 测试用槽位、Modal、剪贴板及输入动作替身，不能证明 Electron 剪贴板权限、真实 Lexical 输入、布局、焦点/键盘、重启持久化或 GitHub 安装流程已通过。未做 rc.1 真实桌面或其他 DSH 版本的实机验证，也未验证 macOS、Linux、跨设备或大规模草稿性能。

## 初版 rc.5 依据（rc.1 对照见文末报告）

- [草稿存储源码](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-conversation/src/client/stores.ts)、[结构校验](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-conversation/src/client/draft.ts)
- [输入动作与 TokenSpan](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-conversation/src/client/contract/input.ts)、[胶囊坐标](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-conversation/src/client/input/editor/projection.ts)
- [空会话隐藏规则](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-workspace/src/client/tree.ts)、[槽位](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/docs/subsystems/slots.md)、[启动图 release](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/docs/subsystems/client-modules.md)
- [Discussion #10021](https://github.com/deepseek-ai/deepseek-harness/discussions/10021) 为问题背景；讨论里的后续提案不作为 rc.5 可用接口。

MIT，见 LICENSE。

## 补充说明：0.2.2 兼容与验证

草稿面板支持按会话 ID 或正文筛选，每页 20 条，点击“预览原文”才挂载该条正文。搜索和分页不修改 localStorage；复制/追加保留原文。追加使用最新输入状态的 draftRev 和胶囊坐标，由宿主 insertText 做 revision guard，不使用 setDraft 覆盖现有输入。会话切换关闭面板并清理预览，迟到的剪贴板结果不回填新面板。仍需枚举并读取当前源中的草稿，分页只减少 DOM/正文渲染开销。

版本 **0.2.2**，MIT，尚未发布本版本到 npm。声明 DSH `>=0.2.1-rc.5 <0.3.0-0`；宿主以 `includePrerelease` 校验准入。已逐项核对官方 `dsh-v0.2.1-rc.5` 和 `dsh-v0.2.2-rc.1` 源码，客户端改为检测实际接口和数据形状，不再读取或精确比较启动版本。未知版本标签不会单独阻止操作，接口或结构不符则安全拒绝；这不表示未知版本已经验证。开发类型依赖保持 rc.5，未安装或改动依赖。

两包都已运行 build、typecheck、npm test 和 verify-pack；预构建 factory 回归覆盖 rc.5 / rc.1 / 未知标签及格式不符。源码和模拟测试不能替代真实 rc.1 Electron 安装、输入、剪贴板、上传或界面验收，本次未改动用户 DSH。

逐项文件、行号证据与测试边界见[rc.1 功能适配报告](../../docs/rc1-draft-snip-compatibility.md)，版本准入规则见[兼容性报告](../../docs/engines-compatibility.md)。
