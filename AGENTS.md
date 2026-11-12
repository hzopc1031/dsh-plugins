# 仓库协作约定

写插件介绍或 README 时，必须遵循 C:\Users\Mayn\.dsh\skills\dsh-plugin-readme（权威版本）。本仓库 [.agents/skills/dsh-plugin-readme/SKILL.md](.agents/skills/dsh-plugin-readme/SKILL.md) 是仓库内文档副本。

做 DSH 插件界面、页面、表单、弹窗或 Client Slots 时，必须先读 `C:\Users\Mayn\.dsh\skills\dsh-plugin-ui\SKILL.md`（Codex 与 DSH 共用的权威入口），按其范围加载官方 `dsh-client-ui-ux`、`dsh-responsive-ui`，涉及生命周期时加载 `cordis-styling-nitpicking`。必须使用官方参考，核对目标 DSH 版本后复用 `@deepseek-ai/dsh-client-ui-primitives` 已有组件，不自造等价控件；插件开发与 Client Slots 接入参考社区 `dsh-plugin-development`，具体接口以目标版本官方定义为准。

界面知识以统一目录为准，直接读取其中的入口与四个参考目录。官方 skill 原文保留；来源、许可证、宿主相对链接和第三方插件适用边界见 `C:\Users\Mayn\.dsh\skills\dsh-plugin-ui\references\sources-and-scope.md`。官方 workspace 构建与内部审批流程不自动适用于本仓库。后续若添加 `.agents/skills/` 文档副本，须与统一目录逐文件保持一致。
