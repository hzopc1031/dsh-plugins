# DLL 诊断 / dsh-dll-doctor

版本 0.1.0。仅面向 Windows 与 DSH **0.2.1-rc.5**（官方标签 `dsh-v0.2.1-rc.5`，commit `b830ec9`）。只做一件事：静态读取一个 EXE/DLL，帮助定位缺失依赖与架构不匹配。不执行或加载被分析文件，不调用 LoadLibrary，不联网，不修改系统或注册表，不创建模型消息，也不注册模型工具。

## 使用

```text
/dll-check "C:\Program Files\Example\app.exe"
/dll-check ./bin/example.dll --depth 2
```

路径含空格时加双引号或单引号；`--depth` 放在路径后面，默认 1（直接依赖，包括延迟导入），允许 1–3。相对路径通过 rc.5 `ctx.workingDirectory.get(invocation.agent.session)` 解析；当前目录搜索也使用这一目录，不使用 DSH 进程的启动目录。允许用户明确指定的本地绝对路径，只读访问。

结果直接作为人类命令文本返回：目标 x86/x64/ARM64 架构、每项依赖的找到路径与来源、缺失、架构不匹配、无法确认与 API set 提示；缺少 VC++ / 旧 DirectX / .NET 组件时给文字建议。建议不带下载或安装动作。延迟导入可能只在使用某项功能时需要，不能由此断言整个程序必然无法启动。命令生命周期及报告可由 DSH 保存在本地会话日志，不发送给模型；报告包含用户选择的文件与依赖路径。

拒绝空参数、目录、不存在的文件、非 EXE/DLL 目标、UNC、设备路径、保留设备名、备用数据流及驱动器相对路径。符号链接/目录联接解析到 UNC 或设备位置也拒绝。每个插件实例同时处理一个诊断；可由命令 AbortSignal 取消，插件卸载也会取消。非 Windows 直接显示「暂不支持（仅 Windows）」，不启动子进程。

## 搜索与限制

纯 TypeScript PE 解析器读取 DOS/PE、Machine、PE32/PE32+、普通及延迟导入表；支持旧 PE32 延迟导入 VA，拒绝越界、截断、未终止名称/描述符、不支持的 Machine 与不安全的导入名称。仅支持 ASCII、无空白的导入文件名；不支持 ARM64EC/ARM64X、NE 或混合架构解释。CLR 目录仅用于提示，AnyCPU / 托管程序集另行排查。

假定未打包应用、SafeDllSearchMode 启用。先识别 API set，然后按以下顺序推断：

1. KnownDLLs：固定 argv 调用系统 `reg.exe query HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\KnownDLLs`，只读；失败、空输出或无效输出时用内置常见名称列表，报告会注明回退，列表可能不完整。KnownDLLs 只查系统副本，不回退应用目录。
2. 目标 EXE/DLL 所在的应用目录（分析 DLL 时以该 DLL 目录近似宿主应用目录）。递归时固定使用最初目标的目录。
3. System32；64 位 Windows 的 x86 目标明确查 SysWOW64，包括 64 位 Node 情况。32 位 Node 分析原生 64 位目标时用 Sysnative 绕过重定向。
4. 16 位系统目录（Windows\System）。
5. Windows 目录。
6. 当前会话工作目录。
7. DSH 进程的 PATH，最多前 128 个非空项；跳过非本地、非绝对或设备路径项。它可能与待诊断程序实际启动时的 PATH 不同。

`api-ms-win-*` 与 `ext-ms-*` **按前缀简化为系统 API set schema 合约**，不报缺失；未读取 schema，不验证当前 Windows 是否提供该合约或具体 host DLL。`ext-ms-*` 只作提示。旧 Windows 上可能仍不具备某些合约。

不分析运行时动态 LoadLibrary、SxS manifest / WinSxS 重定向、DLL redirection、已加载模块、包依赖图、AddDllDirectory/SetDllDirectory 或导出符号是否存在。不能完整模拟 Windows loader，也不承诺程序可以成功启动。ARM64 系统的 x64 模拟、跨架构 KnownDLLs 特殊规则、宿主 EXE 未知时分析 DLL 的路径，以及 .NET AnyCPU 存在推断限制。

资源边界：每个文件最多 64 MiB、单文件最多 512 个导入记录、每次总读取最多 256 MiB、报告默认最多 256 条依赖记录（核心 API 可设 1–512）、递归最多 3 层，路径按大小写不敏感去重后展开。达到报告上限会标记不完整；达到读取上限或子依赖 PE 无法读取会标为「无法确认」，不伪装成缺失。找到错误架构的首个候选后会报告，不继续搜索同名替代副本。读取文件期间可能发生变化；结果是检查当时的静态快照。

## 可选 Dependencies 补充

默认 `dependenciesExe: ""`，完全不用外部 Dependencies。用户可在插件配置中填入**自己信任的 lucasg/Dependencies CLI `Dependencies.exe` 本地绝对路径**（不是 DependenciesGui.exe）。插件仅以固定 argv `Dependencies.exe -json -imports <绝对目标路径>` 读取导入名称列表，解析 `{ "Imports": [{ "Name": "..." }] }`，作为额外文字，不覆盖核心搜索结果。参数依据 [上游 CLI 源码](https://github.com/lucasg/Dependencies/blob/master/Dependencies/Program.cs)。这是用户主动配置并运行的第三方助手，其行为由该程序本身决定；首版未用真实 Dependencies 二进制验证。

不打包、不自动下载第三方二进制。所有插件子进程均经 rc.5 `ctx.subprocess`，无 shell 拼接，5 秒超时，stdout/stderr 各 256 KiB 上限，无 spill 文件；可取消，输出超限终止并丢弃，外部助手失败不会丢失核心诊断。若被分析文件就是助手本身（包括同路径、符号链接或硬链接），会跳过执行；注册表助手遇此情况使用 KnownDLLs 回退。仅输出经过验证的导入名称，不回显助手原始输出或 stderr。

## 安装

尚未发布 npm，当前改动合并到 main 后可使用以下 git 地址。先**完全退出桌面版 DSH（含托盘）**，再在 PowerShell 运行：

```powershell
& "$env:LOCALAPPDATA\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop add "github:hzopc1031/dsh-plugins#main&path:/packages/dsh-dll-doctor"
```

之后重新打开桌面 DSH。包内已提交预构建 `lib/`，无安装生命周期脚本。无需构建或安装任何外部诊断程序。此开发工作未安装到 DSH。

## 开发与验证

在包目录执行（Node >=22）：

```powershell
npm ci --ignore-scripts
npm run typecheck
npm test
npm run verify-pack
node scripts/smoke-real.mjs
```

若沙箱不允许写默认 npm cache，可仅为当前命令设置 `$env:npm_config_cache = Join-Path (Get-Location) '.tmp/npm-cache'`，不修改全局配置。

单元测试在运行时生成原创极小 PE，未提交任何系统/第三方 EXE/DLL。smoke 脚本只读分析 `C:\Windows\System32\notepad.exe`，并在系统 TEMP 下构造缺失与架构不匹配样本，结束时删除；不会执行这些文件。安装前可直接在本仓库根目录运行 `node packages/dsh-dll-doctor/scripts/smoke-real.mjs`。

已测：84 项自动测试通过；本机 notepad x64 的 56 条直接导入均找到或为 API set，注册表读取成功；构造缺失及 x64 引用 x86 DLL 验证通过，临时文件已清理。见 [STATUS](STATUS.md)。未在真实桌面 DSH 中测试；未测真实 Dependencies、32 位 Node/Windows、ARM64 真机及任意应用启动。

搜索顺序参考 [Microsoft 文档](https://learn.microsoft.com/en-us/windows/win32/dlls/dynamic-link-library-search-order)。许可证 MIT，第三方说明见 [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES.md)。
