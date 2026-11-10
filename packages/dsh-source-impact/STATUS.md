# 开发状态

- 包名：dsh-source-impact
- 版本：0.1.0
- 日期：2026-11-10
- 中文名称：资料更新影响分析
- 最终目录：dsh-plugins/packages/dsh-source-impact
- 许可证：MIT，与已有插件一致。

## 已完成

- 明确登记本地 Markdown/CSV 来源、引用范围、结论、表格/报告章节/报告位置及重查方法。
- Markdown 按行范围或唯一原文；CSV 按唯一键及列；UTF-8 BOM/换行规范化、完整文件与引用分别 SHA-256。
- 区分来源版本变化、引用内容变化、人工复核，支持未知值及状态叠加；无结论错误断言。
- 去重影响汇总；由用户指定引用 id 生成含证据、定位及重算步骤的 JSON 任务，交给 DSH 执行。
- 清单生成前重查指纹，拒绝过期选择；不会自动改写报告或接受新基线。
- 项目内持久化，单写者锁/原子重命名，拒绝超限、非 UTF-8、损坏登记、路径越界和状态目录 junction。
- /impact 命令、只读 source_impact_check 工具、Cordis bundle/patch、类型声明、预构建 lib、中文 README、原创 SVG。
- 未改变 monorepo 根 README，避免和并行开发任务冲突；未修改已有两个插件。

## 验证

环境：Windows、Node 24.20.0、npm 11.19.0；宿主 API 开发依赖固定 DSH 0.2.1-rc.5。

- npm view dsh-source-impact name version --json：注册表返回 E404 / Not Found，未被占用（查询时点）。
- npm install --ignore-scripts --no-audit --no-fund：成功，28 个开发/宿主依赖。
- npm run typecheck：通过，无类型错误。
- npm test：48 项全部通过，0 失败、0 跳过；包含纯逻辑、真实临时文件、命令流程及 rc.5 真实 Cordis command/tool 注册表加载、调用和卸载。
- npm run verify-pack：发布白名单、bundle/导出入口/无安装期脚本检查通过，16 个文件。
- 安装、构建、测试和 pack 检查在允许写入的 npm 缓存 staging 目录完成；工作目录 Node 写入曾返回 EPERM。最终产物复制回 monorepo，node_modules 未带入。

## 已知未测 / 做不到

- 按任务禁止安装到用户 DSH；未验证真实桌面 UI 显示、GitHub 实际安装、真实模型执行重查。内存 Cordis 注册表已验证，systemPrompt 用替身。
- 本次不 commit/push、不 npm publish；远程 main 尚未因本任务包含此包，安装命令需等待后续提交推送。
- 首版仅本地 UTF-8 .md/.csv 及明确登记的引用，无自动语义理解、文件监听、跨项目/网络来源或其他文档格式。
- Markdown 固定行范围可能随插入行偏移；唯一原文丢失或重复时返回未知并要求人工复核。
- 产出 locator 是用户元数据，不解析或校验产出章节；复核清单需复制到普通对话交给 DSH，不自动排队或改写结论。
- 不提供多文件事务快照；执行重查前还需按清单校验哈希。未进行大规模性能压测或模拟突然断电。
