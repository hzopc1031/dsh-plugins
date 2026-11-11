# DSH 0.2.1-rc.5 API 证据与设计

核对日期：2026-11-09。本机安装锚点 `D:/AIInfra/dsh-app/node_modules/@deepseek-ai/`，以下路径相对于该目录；另阅读任务指定的 `../_tools/ref/dsh` 中插件开发 skill 及其 host-plugin、verification 参考，`../_tools/ref2/dsh` 的 Client 包清单。所有 API 以本机对应版本的 README、类型和 built JS 为准。

## 已核实

| 用途 | 源文件与事实 | 选择 |
| --- | --- | --- |
| bundle | `dsh-agent-preset/skills/cordis-plugin-development/references/host-plugin.md`、同级 iceberg 模板 | package + patch + index + locales + icon；不做安装期构建 |
| 工具事件 | `dsh-tools/README.md`、`lib/types/index.d.ts`（tools/pre-execute、tools/result、ToolExecution、ToolExecutionResult） | pre-execute 原样委托 next，仅记开始时间；result 观察冻结最终结果，返回 undefined；关联 token 是 symbol，不修改工具结果 |
| 空闲 | `dsh-agent/lib/types/runtime-types.d.ts`（AgentStatus、agent/status） | idle 明确无活动 driver；比 turn/end 更符合“停下等用户”的边界；异步 defer 后调用命令，避免 append 重入 |
| 手动 | `dsh-commands/README.md`、`lib/types/index.d.ts`、`dsh-command-compact/lib/index.js` | 原生 commands.register / commands.execute；CommandDefinitionId；无参数 /review；不提交模型消息 |
| 展示 | `dsh-client-ui-chat/lib/client.js` 的 GenericCommandCard（约 6445 行）、commandDefinition（约 9650 行） | command/run + command/done 已投影进聊天；多行结果默认折叠，展开 pre 文本；首行放短摘要，正文放完整 Markdown。此源码支持等价卡片；无需新 Client API。渲染视觉未验证 |
| presentationMeta | `dsh-tools/README.md` Host presentation descriptors、`lib/types/presentation.d.ts` | 元数据属于实际工具调用；宿主 Web 选择 Client renderer，不消费任意 Host presentResult。自动复盘无需伪造工具调用，采用原生命令卡片 |
| 会话边界 | `dsh-session/README.md`、`lib/types/index.d.ts` 的 appendPluginRecord/pluginRecordOf/snapshotEvents，`types.d.ts` PluginRecordMap | 两个插件自有 ignorable record：call 与 boundary；恢复时校验载荷；边界是排他事件偏移；子会话跳过 inheritedEventCount |
| 文件变更 | `dsh-tool-fs/lib/index.js` write/edit output before/after/path；`dsh-workspace-changes/lib/types/types.d.ts` | 只用明确的域结果或 workspace/changes 对应 summary/diff；diff.before/after 判存在性，缺失标不可用。服务通过 ctx.inject 子插件按需接入 |
| 配置与生命周期 | `cordis/lib/types/registry.d.ts`、`cordis/README.md`、`schemastery`，`dsh-workspace-changes/lib/index.js` Config | Cordis inject 是服务名数组或名称→配置映射，不能套用别的 Cordis 版本的 required/optional 数组；ctx.on/ctx.effect 注销并等待任务 |
| 用量 | `dsh-session/lib/types/types.d.ts` assistant/message.usage；`dsh-llm/lib/types/types.d.ts` TokenUsage | input 是 uncached input；缓存单列。只加权威最终样本，不以 tokenMeter 估算当账单。费用无金额字段，因此不可用 |
| profile 加载 | `dsh-app-boot/README.md`、`lib/types/index.d.ts`、`profile.d.ts`，`dsh/lib/dump-config-CWs_HdOc.js` | initProfile/loadProfileDirectory/boot 使用官方组合与 Loader；测试中的临时 junction 仅指向本 checkout，所有测试资源在临时 home 下并清理 |

## 测试约定与限度

按内置插件开发 verification 约定使用唯一临时目录、有界操作、等待 disposer 清理，不接触主 profile。Cordis README 的 `new Context → await ctx.plugin → await ctx.fiber.dispose` 是集成测试生命周期依据。`dsh-tools/testing` 在安装类型中标 internal，且 package exports 未导出；官方 agent-loop-testkit 未随本机包安装，因此不假造或导入它。测试使用正式 `defineTool` 注册只读 fixture，驱动真实 ToolRuntime 和 CommandRuntime；profile 冒烟使用正式 composer + Loader。未启用模型/账户、网络服务和遥测。

命令 `node --test` 的默认子进程隔离在本环境报 spawn EPERM，改用官方 Node test runner 的 `--test-isolation=none`，保持断言真实执行。npm 默认缓存目录不可写，统一把缓存指定到本工作区 `.tmp/npm-cache`。

没有依赖未验证的宿主方法。未验证的范围：Web 可视交互、模型驱动的完整一轮、PTC 嵌套实际模型调用、JSONL 持久化后的跨进程恢复（已测 Session seed 重放）、workspaceChanges 的真实 git/shell 捕获（已测其公开服务 seam）。不将这些标成通过。

## 第二阶段兼容与分发验证（0.1.1）

已在本机 0.2.1-rc.5 与隔离 npm 0.2.2-rc.1 完成 typecheck、12 项测试和官方 Loader profile 冒烟；两个版本均完成真实 CLI tgz add / dump / remove，及安装产物的官方 readPluginMeta 标题、描述、图标读取。详细命令与依赖清单见 handoff.md。

新版证据目录 `.tmp/dsh-0.2.2/node_modules/@deepseek-ai/`：dsh-tools/README.md 的 Select an executor、lib/types/executor.d.ts 的 ToolBatchInput，以及 dsh-tool-executor-native/lib/index.js。新版将工具执行移至 executor 插件，execute 接收 calls 批次；scripts/tool-fixture.mjs 按 setExecutor 能力选择官方 native executor 与批量接口，仅用于测试。生产插件的 tools/pre-execute/result 观察接口两版都实测通过，运行代码无需适配。

DSH app-boot 的 satisfies 使用 includePrerelease:true，因此 engines.dsh 的 >=0.2.1-rc.5 <0.3.0 可接受两个实测 prerelease。Cordis 4.0.5/4.1.0、Schemastery 3.18.5/3.19.0 已随宿主分别验证。分发 peer 全部标 optional 防止包管理器下载副本；必需服务依然由 inject 声明，workspaceChanges 通过 ctx.inject 可选接入且 type import 在编译后移除。

成品验收发现 locale JSON 的 BOM 会被 readPluginMeta 当作非法 JSON；已移除 BOM 并在 verify-pack 中直接 JSON.parse 验证。Web 目视仍待验收。
