# STATUS

版本：0.1.0。日期：2026-11-10。实现与自动检查完成，本机助手脚本已查到占用进程 PID；尚未发布 npm，未安装到 DSH。


## 用途与安装

只查询 Windows 本机当前项目内指定普通文件的占用程序。入口 /file-holder <项目内文件>；显示观察时间与手动重新检查提示。不创建模型消息，不注册模型工具，不修改目标文件，不解锁或结束占用进程。

先完全退出桌面版 DSH（含托盘），再在 PowerShell 运行：

```powershell
& "$env:LOCALAPPDATA\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop add "github:hzopc1031/dsh-plugins#main&path:/packages/dsh-file-holder"
```

需要本包先合入远端 main；本次未执行安装。包内 lib 已预构建，无安装脚本。仅声明支持 DSH 0.2.1-rc.5。

## 已测

- 对照官方 dsh-v0.2.1-rc.5 / b830ec950faba0a46dda564be3e2d854afed94f1 的 commands、working-directory、subprocess 源码，并使用 rc.5 发布类型完成 TypeScript 检查。
- typecheck 通过；npm test：90 项通过，0 失败，0 跳过。
- 单元覆盖正常/空/错误/畸形 JSON、字段校验与 UTF-8；空参数、目录、不存在文件、盘符/兄弟目录边界、UNC、设备名/命名空间、ADS、符号链接与 junction 逃逸。
- Windows 实际文件系统普通文件、中文与空格路径、目录、不存在文件、junction 逃逸检查通过。
- 模拟 rc.5 subprocess 的固定 argv、有界收集、取消、预取消、超时、输出超限、启动失败、退出失败及非 Windows 拒绝通过。
- 真实 Cordis + rc.5 CommandRuntime 的注册、执行、/cd 后目录获取、日志事件、卸载注销及助手取消通过；模型能力陷阱未触发。子进程提供者在这些集成测试中为模拟对象。
- verify-pack 通过，精确白名单包含助手、预构建 JS/声明、文档、图标和 locale，无依赖目录、临时文件或安装生命周期脚本。

## 本机独占句柄实验

后台普通 PowerShell 以 FileShare.None 打开 TEMP 下的临时文件并保持句柄，在普通用户会话中直接运行随包 file-holder.ps1：返回 ok=true，进程列表含该 PowerShell 的 PID（名称 Windows PowerShell，应用类型 5）；结束该进程后再次运行返回空列表。测试进程与临时文件已清理。

注：在 Codex 受限沙箱内运行时 RmStartSession 返回错误 29，助手按设计输出结构化错误 JSON；沙箱外普通环境正常。若宿主子进程环境同样受限，可能出现同类错误，需在真实桌面 DSH 中确认。

## 未测与限制

未在真实桌面 DSH 中测试命令展示、会话取消、插件卸载或安装；未测试真实宿主 subprocess 提供者与助手的端到端联动。未测试其他 DSH 版本、其他 Windows 版本、受保护/高权限进程、服务、远程执行提供者及非 Windows 真机（非 Windows 仅模拟验证拒绝分支）。

查询为瞬时观察，可能漏报，PID 可能复用；空结果仅为“未查到占用进程”，不能保证文件可写或未被占用。路径校验到观察期间存在文件/链接变化的竞态。普通用户权限，系统策略可阻止 PowerShell/Add-Type/Restart Manager。超时/取消仅清理插件自己的助手，无结束占用程序、关闭句柄、解锁、提权或自动重试功能。
