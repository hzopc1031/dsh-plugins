# Changelog

## 0.1.0 — 2026-11-10

- 新增 Windows 人类命令 `/dll-check <EXE或DLL路径> [--depth 1–3]`，精确面向 DSH 0.2.1-rc.5（b830ec9）；不注册模型工具或创建模型消息。
- 自带有界 TypeScript PE32/PE32+ 普通及延迟导入解析，报告 x86/x64/ARM64、缺失、来源和架构不匹配。
- SafeDllSearchMode 顺序推断、只读 KnownDLLs 注册表查询与显式回退、SysWOW64/Sysnative 处理；API set 按前缀简化为系统解析，ext-ms 仅提示。
- 默认仅直接依赖；可选最多 3 层递归、总量与读取上限、AbortSignal、子进程超时及输出限制。
- 可选用户配置的 Dependencies.exe CLI 导入名称补充，不附带或下载二进制；只给文字修复建议。
- 不分析动态 LoadLibrary、SxS manifest、导出符号或运行时启动。包含原创动态夹具测试、预构建产物、打包检查及可重跑 smoke 脚本。
- 本机 notepad、构造缺失及架构冲突核心 smoke 已验证；未在真实桌面 DSH 中测试，未发布 npm 或安装插件。
