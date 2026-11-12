---
name: dsh-plugin-ui
description: 为 Codex 与 DSH 创建、修改或审阅 DeepSeek Harness 插件界面、页面、表单、弹窗及 Client Slots 时使用；必须先读官方 UI 参考，核对目标版本并复用官方组件，按第三方插件范围执行。
---

# DSH 插件界面：先用官方参考

Liu 的要求：做 DSH 插件界面必须使用官方参考。本 skill 只负责阅读顺序、版本核对和适用范围；视觉与交互规则以官方原文为准。

## 开始界面工作前

1. 先读 [来源与适用范围](references/sources-and-scope.md)，确认第三方插件与官方宿主 workspace 的边界。统一权威目录是 `C:\Users\Mayn\.dsh\skills\`；仓库若保留 `.agents/skills/` 下的同名目录，仅作为文档副本，以统一目录为准。
2. 必须加载以下官方原文。表中路径均相对于统一目录；布局工作读 alignment、spacing，图标或图标按钮工作读 icons，其余技术细节按原文继续定位。

   | 官方 skill | 统一目录内路径 | 使用时机 |
   | --- | --- | --- |
   | dsh-client-ui-ux | `dsh-client-ui-ux/SKILL.md` | 所有插件界面设计、修改、审阅前；相关细节在其 `references/alignment.md`、`spacing.md`、`icons.md` |
   | dsh-responsive-ui | `dsh-responsive-ui/SKILL.md` | 所有插件界面工作前，按变更检查布局、文本和输入能力相关章节 |
   | cordis-styling-nitpicking | `cordis-styling-nitpicking/SKILL.md` | 涉及 Client/Slot 注册、订阅、计时器、异步工作或卸载释放时，先读相关生命周期规则；它不是 CSS 样式指南 |

3. 必须优先使用 `@deepseek-ai/dsh-client-ui-primitives` 已有组件。先核对目标 DSH 版本、包版本、公开导出及对应类型/实现，再选用组件和 props；不能从 master 文档推断旧版已有某个导出。已有等价控件必须直接复用，不自行仿制、复制实现或跨包覆盖来追赶新版。确无适用组件时，先说明核对依据与缺口，再在授权范围内按官方扩展方式处理。
4. 插件开发与 Client Slots 接入读社区 `dsh-plugin-development/SKILL.md`（完整路径：`C:\Users\Mayn\.dsh\skills\dsh-plugin-development\SKILL.md`），按其 authority、component-routing 和实际插件模式读取 references。该资料是社区参考；组件、Slot 名称、scope、props 与加载方式仍以目标版本官方定义为准。不能仅因第三方仓库也有 `packages/` 就套用官方 workspace 规则。
5. 验证要求遵循官方 UI workflow 与相关 reference，报告实际检查结果和缺口。未看到真实渲染结果时不能宣称视觉验收通过；加载资料本身不授权安装、发布、改全局配置或运行第三方脚本。

## 只按适用范围执行

官方宿主源码路径、workspace 构建/测试约定、内部审批名册及 PR 流程不自动成为第三方插件的要求。第三方插件遵循自己的仓库约定与用户授权；官方视觉、交互、响应式和适用的生命周期原则仍须使用。完整边界、原文链接解析和许可证见 [来源与适用范围](references/sources-and-scope.md)。不要在本入口另写一套尺寸、颜色或组件规范。
