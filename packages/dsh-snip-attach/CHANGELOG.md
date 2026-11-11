# Changelog

## 0.2.1 (2026-11-11)

- 修复 DSH 0.2.2-rc.1 加载兼容声明；Linux 加载验证，Windows / Electron 功能未实测。


## 0.2.0 — 2026-11-10

剪贴板新旧判断改用 Windows GetClipboardSequenceNumber，并在读取图片前后核对序号，替代九点像素采样；同像素的新截图也可识别。序号无法证明写入者一定是截图工具，请在等待期间避免其他程序改写剪贴板。intake 最多等待 2 秒，卸载/切换会话取消，实时检查 removed/subagent/phase。rc.5 没有公开的 File → accepted attachment ID 回执，新增 ID 也可能来自其他附件，所以只提示“已提交截图，请核对待发送图片”，不声称已确认加入；缺少变化或拒绝时提示 Ctrl+V。继续复用当前 composer 唯一的隐藏 input/change，未调用内部 createDrafts/addFiles。截图取回后先显示预览，需用户点击“确认加入”才会注入待发送附件；“取消”或切换会话会丢弃预览且不注入。

- 新版本尚未 npm publish；预构建 lib、独立 lockfile 与回归测试同步。
- 验证范围为 rc.5 运行时与 headless/jsdom；Electron 人工验收仍待执行。

## 0.1.0

- Windows screenclip capture, one-use loopback retrieval, and composer file intake for DSH 0.2.1-rc.5.
