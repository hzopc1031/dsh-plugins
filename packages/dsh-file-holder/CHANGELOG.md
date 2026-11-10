# Changelog

## 0.1.0 — 2026-11-10

首次实现“指定文件占用程序查询”：人类命令 /file-holder <项目内文件>，显示程序名、PID、应用类型、可用服务名、UTC 观察时间及手动重新检查提示。不创建模型消息，不注册模型工具。

针对官方 dsh-v0.2.1-rc.5（b830ec9），使用 commands.register（名称不带斜杠）、workingDirectory.get(session)、subprocess.spawn 固定 argv。随包提供 PowerShell + Add-Type Restart Manager 助手，finally 结束已建立的会话；普通用户运行，无解锁、结束占用进程、提权或自动重试。

真实路径限制在当前项目内普通文件，拒绝 UNC/设备/ADS/目录/不存在文件/链接逃逸。支持 AbortSignal、卸载取消、15 秒超时及 stdout 64 KiB / stderr 8 KiB 上限，截断报错。非 Windows 不启动子进程；空结果仅表示“未查到占用进程”。

提供预构建 lib、独立 package-lock.json、verify-pack、locale、图标与 MIT 许可。安装前完全退出桌面版 DSH，再在 PowerShell 使用 README 中的桌面 CLI git 安装命令；尚未发布 npm。90 项自动测试通过；本机独占句柄实验中助手脚本已查到占用进程 PID，详见 STATUS。未在真实桌面 DSH 中测试。
