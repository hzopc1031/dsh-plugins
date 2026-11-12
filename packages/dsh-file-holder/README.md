# dsh-file-holder

**0.1.2**：指定文件占用程序查询。面向 Windows 本机 DSH 桌面版，开发基线为 **0.2.1-rc.5**，只提供人类命令：

```text
/file-holder src/index.ts
/file-holder "docs/有空格的文件.txt"
```

路径相对于当前会话的执行目录（`workingDirectory.get(agent.session)`，包括 `/cd` 的变化），也接受项目内的完整盘符绝对路径。空格路径可用一对双引号包围；参数整体作为一个文件路径，不进行 shell 解析或变量展开。只允许存在的普通文件，按真实路径检查项目边界；拒绝目录、项目外路径、逃逸的符号链接/junction、UNC、设备名、设备路径及备用数据流。

结果通过 DSH 命令结果显示程序名、PID、应用类型数值、服务名（如有）和 UTC 观察时间。结果附有“重新检查：再次执行 /file-holder …”提示，复制该命令可手动重查。没有会话头按钮。命令不创建模型消息，不注册任何模型工具；宿主会记录 command/run、command/done 日志，其中结果含所查路径和进程信息。

## 安装

尚未发布到 npm。Git 安装前，先**完全退出桌面版 DSH（含托盘）**，再在 PowerShell 运行：

```powershell
& "$env:LOCALAPPDATA\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop add "github:hzopc1031/dsh-plugins#main&path:/packages/dsh-file-holder"
```

安装后重新打开桌面版 DSH。该地址指向远端 main。可将 main 换成包含本包的已推送提交以固定版本。包内已提供预构建 `lib/`，git 安装不需要构建，无安装生命周期脚本。

## 查询方式与限制

插件以普通用户权限通过 `ctx.subprocess.spawn` 调用包内 PowerShell 助手，使用固定 argv：

```text
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File <插件内脚本> -Path <已校验的绝对路径>
```

助手用 Add-Type 声明 Windows Restart Manager 的 RmStartSession、RmRegisterResources、RmGetList、RmEndSession；成功建立会话后在 finally 结束会话。RmGetList 仅做一次长度探测和一次数组读取，列表变化导致缓冲区不足时直接报错，由用户手动重新检查。

查询超时为 15 秒；stdout 上限 64 KiB，stderr 上限 8 KiB，均由宿主有界收集且不落盘溢出。任何输出截断均报错，不展示不完整结果。支持请求 AbortSignal 和插件卸载取消；只清理插件启动的助手，不控制观察到的进程。非 Windows 返回“暂不支持（仅 Windows）”，不会启动子进程。

空结果仅表示**“未查到占用进程”**。Restart Manager 可能因权限、受保护进程、系统状态或瞬时变化漏报；结果不能保证文件可写、可删除或没有占用。PID 也可能被系统复用。没有终止程序、关闭句柄、解锁、提权或自动重试功能。Add-Type、PowerShell 或 Restart Manager 被系统策略限制时会报错，不尝试绕过。

路径校验与系统观察之间无法获得原子快照；文件、链接、进程可能在此期间变化。本包查询文件使用者，不读取目标文件内容。仅适用于宿主文件系统与 subprocess 同在本机 Windows 的桌面部署，不面向远程执行提供者。

## 接口依据

原有开发类型保留 rc.5；本次另对照官方 `dsh-v0.2.2-rc.1` 源码核对下列 API，并在 Linux 实际加载 rc.1：

- [人类命令注册](https://github.com/deepseek-ai/deepseek-harness/blob/b830ec950faba0a46dda564be3e2d854afed94f1/packages/interaction/commands/src/index.ts)：注册名 `file-holder` 不带斜杠，使用 invocation.signal 和 agent.session。
- [当前执行目录](https://github.com/deepseek-ai/deepseek-harness/blob/b830ec950faba0a46dda564be3e2d854afed94f1/packages/session/working-directory/src/index.ts)：`workingDirectory.get(session)`。
- [子进程接口](https://github.com/deepseek-ai/deepseek-harness/blob/b830ec950faba0a46dda564be3e2d854afed94f1/packages/subprocess/subprocess/src/types.ts)：argv、signal、graceMs、收集上限与 readFrom(0).lossy。
- [Microsoft RmGetList 文档](https://learn.microsoft.com/en-us/windows/win32/api/restartmanager/nf-restartmanager-rmgetlist)：长度探测和进程信息读取。

## 开发与验证

```powershell
npm ci --ignore-scripts
npm run typecheck
npm test
npm run verify-pack
```

每包独立 lockfile，预构建产物随源码提交。自动检查与真机结论详见 [STATUS](STATUS.md)：90 项测试通过；本机独占句柄实验中助手脚本已查到占用进程 PID。未在真实桌面 DSH 中测试，也未安装到 DSH。MIT 许可。


### 0.1.2 兼容性声明

本版声明 DSH `>=0.2.1-rc.5 <0.3.0-0`。官方版本检查使用 `semver.satisfies` 并开启 `includePrerelease`：接纳 0.2.1-rc.5、0.2.2-rc.1 及后续 0.2.x 预发布/正式版，排除 0.3.0（含预发布）。DSH peer 显式覆盖两个已知 RC，Cordis / Schemastery peer 覆盖两个官方 tag 的版本；开发依赖不变。此次没有安装到用户 DSH；准入通过不等于逐版本功能或界面验证通过。

校验逻辑、源码对照与本次检查结果见[兼容性报告](../../docs/engines-compatibility.md)。

本次 0.2.2-rc.1 兼容结论与 API 依据见[兼容矩阵](../../docs/compat-matrix.md)。本次在 Linux 实际加载；Windows / Electron 功能未实机验证，历史 rc.5 测试记录不代表本次加载过该版本。
