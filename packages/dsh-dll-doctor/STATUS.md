# Status — 0.1.0

日期：2026-11-10。源码状态：待用户提交/合并；未发布 npm，未安装到 DSH，未执行 git add/commit/push。

## 已验证

- 使用 npm 官方 `@deepseek-ai/dsh-commands`、`dsh-subprocess`、`dsh-working-directory` 0.2.1-rc.5 发布类型，并对照仓库 rc.5 参考包。目标标签 dsh-v0.2.1-rc.5，commit b830ec9。
- `npm run typecheck`、`npm test`（84 项通过，0 失败）、`npm run verify-pack`（22 个发布文件精确白名单通过；本次 npm cache 指向 worktree 内忽略的 .tmp，默认用户 cache 在沙箱不可写）。测试包含动态 PE32/PE32+/ARM64、普通与延迟导入、PE32 旧 VA 延迟导入、逐字节截断与畸形输入、搜索次序、KnownDLLs 优先、API set、架构差异、深度/总数/读取上限、取消/超时/输出超限、注册表/Dependencies 正常空畸形输出、非 Windows，禁止把目标或其硬链接当助手运行，以及真实 Cordis 加载/命令注册/卸载的模拟服务测试。
- Windows 本机核心 smoke：只读 `C:\Windows\System32\notepad.exe`，架构 x64；56 条直接导入记录全部找到或为 API set，没有缺失或架构不匹配。KnownDLLs 注册表读取成功（非回退）。本次沙箱未阻止 System32 或注册表访问。
- 系统 TEMP 内动态构造最小 x64 EXE 引用 dsh-missing-test.dll，报告缺失；再构造 x64 EXE 引用应用目录下的 x86 dsh-x86-test.dll，报告架构不匹配。所有临时文件已删除。没有执行、加载、提交或复制任何被分析 PE 或第三方二进制。
- 可重跑：仓库根目录 `node packages/dsh-dll-doctor/scripts/smoke-real.mjs`；包目录 `node scripts/smoke-real.mjs`。此脚本不依赖 DSH，不安装插件，不联网，仅运行系统 reg.exe 只读查询。

## 未验证与限制

未在真实桌面 DSH 中测试，包括命令呈现、真实 UI 取消、插件配置与安装。未使用真实 Dependencies.exe 测试；该后端仅做 argv/JSON/异常测试。未测真实 x86 目标、32 位 Windows/Node、ARM64 真机或任意目标的启动结果。ARM64 单元测试只代表 PE 字段解释。

API set 按 api-ms-win-/ext-ms- 前缀简化，不验证具体 schema/host；KnownDLLs 回退列表不完整。假定未打包应用与 SafeDllSearchMode 启用，DLL 目标目录近似应用目录。不分析动态 LoadLibrary、SxS manifest/WinSxS、DLL redirection、已加载模块、包图、导出符号或 .NET AnyCPU，详见 README。报告是推断，不能证明程序可以启动。文件读取期间可能变化；无法解析的依赖标为无法确认。
