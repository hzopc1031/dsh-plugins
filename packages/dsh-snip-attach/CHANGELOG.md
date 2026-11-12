# Changelog

## 0.2.3 - 2026-11-12

- 合并内网代理 / CA 诊断改动与 main 的 DSH 0.2.2-rc.1 兼容修复（merge intranet proxy/CA diagnostics with main's 0.2.2-rc.1 compatibility）；保留本包两侧已有功能与验证边界。
- 保留桌面 origin、会话 / 附件 / 命令能力检查、截图预览确认及失败回退，不恢复精确版本门禁。

## 0.2.2 - 2026-11-11

- 对照官方 rc.5 / rc.1 源码，移除客户端精确版本门禁，改为实际接口和数据结构检测；未知形状安全拒绝。
- 保留桌面 origin 和会话隔离，检查 remote 命令与附件状态，确认注入时重新核对 composer picker。说明 rc.1 图片确认后立即上传，附件 ID 不代表上传成功。
- 50 项自动测试通过；真实 rc.1 截图、上传及 Electron 验收待执行。
- 同步版本、lock 自身版本、打包断言、README 和预构建 lib；未安装依赖或发布。

## 0.2.1 - 2026-11-11

- 修正 DSH 版本声明为 `>=0.2.1-rc.5 <0.3.0-0`，采用官方包含预发布版本的校验规则，并排除 0.3.0 预发布版本。
- 放宽 DSH peer 范围，显式覆盖 rc.5 / rc.1 的标准 npm semver 安装校验；开发依赖保持原版本。
- 同步锁文件自身版本、打包断言及当前版本标识；兼容性声明不等于逐版本功能验证。

## 0.2.1 (2026-11-11)

- 修复 DSH 0.2.2-rc.1 加载兼容声明；Linux 加载验证，Windows / Electron 功能未实测。


## 0.2.0 — 2026-11-10

剪贴板新旧判断改用 Windows GetClipboardSequenceNumber，并在读取图片前后核对序号，替代九点像素采样；同像素的新截图也可识别。序号无法证明写入者一定是截图工具，请在等待期间避免其他程序改写剪贴板。intake 最多等待 2 秒，卸载/切换会话取消，实时检查 removed/subagent/phase。rc.5 没有公开的 File → accepted attachment ID 回执，新增 ID 也可能来自其他附件，所以只提示“已提交截图，请核对待发送图片”，不声称已确认加入；缺少变化或拒绝时提示 Ctrl+V。继续复用当前 composer 唯一的隐藏 input/change，未调用内部 createDrafts/addFiles。截图取回后先显示预览，需用户点击“确认加入”才会注入待发送附件；“取消”或切换会话会丢弃预览且不注入。

- 新版本尚未 npm publish；预构建 lib、独立 lockfile 与回归测试同步。
- 验证范围为 rc.5 运行时与 headless/jsdom；Electron 人工验收仍待执行。

## 0.1.0

- Windows screenclip capture, one-use loopback retrieval, and composer file intake for DSH 0.2.1-rc.5.
