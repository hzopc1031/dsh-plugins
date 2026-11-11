# DSH rc.1 插件版本准入修复

后续功能适配：`fix/rc1-gates` 基于 `cdd34c8`，草稿找回和截图附件均升为 **0.2.2**，已将精确 rc.5 门禁替换为能力与结构校验。两包 build/typecheck/test/verify-pack 均通过（草稿 29、截图 50 项）；未做真实 rc.1 桌面验收。逐项文件与行号见 [功能适配报告](rc1-draft-snip-compatibility.md)。下文其余 15 包结果属于此前版本准入批次。

前一批次只改 `fix/engines-range` worktree，基于 `47a4c8d94cfab9a7e108673582ec00f23618fded`。未安装或修改用户 DSH、未安装依赖、未发布、未 commit/push。日期：2026-11-11。

## 根因与官方证据

`dsh-github-triage@0.3.1` 将 `engines.dsh` 写成精确版本 `0.2.1-rc.5`，所以升级宿主后被拒绝。**不是 DSH 使用默认 semver 排除了所有预发布版本。**

只读对照的官方标签为：

| tag | commit |
| --- | --- |
| `dsh-v0.2.1-rc.5` | `b830ec950faba0a46dda564be3e2d854afed94f1` |
| `dsh-v0.2.2-rc.1` | `66491b05e3f05ad35bcdd4f6cd7ed26041d9e3db` |

两个 tag 的 `packages/boot/app-boot/src/plugin-compatibility.ts` 内容完全相同，Git blob SHA 均为 `2e4ca5736a775aceadb0a2a10140af61f94ed2ac`。

- [rc.1 校验源码，第 5、51–53 行](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/packages/boot/app-boot/src/plugin-compatibility.ts#L51)：导入 npm `semver`，调用 `semver.satisfies(runtimeVersion, range, { includePrerelease: true })`，同时拒绝空范围。
- [rc.5 同一文件](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/boot/app-boot/src/plugin-compatibility.ts#L51) 使用同样函数与选项。
- [第 55–71 行](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/packages/boot/app-boot/src/plugin-compatibility.ts#L55)：存在自身 `engines.dsh` 时，它单独决定结果；只有缺失时才回退到 `@deepseek-ai/dsh` / `@deepseek-ai/dsh-*` peer。`workspace:^` / `workspace:~` / `workspace:*` 仅在 peer 回退中视为当前宿主版本。
- [app-boot package.json](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/packages/boot/app-boot/package.json) 声明 `semver ^7.8.5`；[rc.1 lockfile](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/pnpm-lock.yaml) 解析为 `7.8.5`。
- [官方迁移说明，第 21–24 行](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/docs/upgrade-guide/v0.2.1-alpha.3/plugin-engines-dsh/guide.zh.md#L21)：让 engines 范围覆盖实际支持版本，替换 engines 中的 `workspace:`。文档没有推荐一个适用于所有第三方插件的固定范围。
- [内置 commands 清单](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/packages/interaction/commands/package.json) 不声明 `engines.dsh`，DSH peer 使用 `workspace:*`、Cordis 使用 `workspace:~`；这是官方 monorepo 的写法，不能照抄为第三方 engines。

标准 semver 默认排除不属于比较器同一 major.minor.patch 的预发布版本。因此 `semver.satisfies('0.2.2-rc.1', '>=0.2.1-rc.5 <0.3.0')` 默认是 false；**官方开启 includePrerelease 后为 true**。原仓库中已经使用这一范围的包，不会仅因此在 rc.1 被标异常。Apache Radar 原有 `>=0.2.2-rc.1 <0.3.0` 也能通过 rc.1，与它之前记载的加载验证相符；本次没有复做那次运行时验证。

## 新范围及 peer 处理

16 个包使用 `>=0.2.1-rc.5 <0.3.0-0`，下界保留 rc.5；Apache Radar 例外使用 `>=0.2.2-rc.1 <0.3.0-0`。官方选项允许未来 `0.2.3-alpha.0`、`0.2.9-rc.1` 等参与比较。上界必须写成 `<0.3.0-0`：若仍用 `<0.3.0`，开启 includePrerelease 后会意外接纳 `0.3.0-rc.1`。

Apache Radar 依赖 rc.1 新增的 `MarkdownText.omitHtml` 禁止原始 HTML，rc.5 没有这项能力。原范围 `>=0.2.2-rc.1 <0.3.0` 在官方 includePrerelease 校验下已能通过 rc.1，并非此次故障包；此次保留 rc.1 下界，只收紧上界。已撤销 SafeMarkdown 改动，将 src/client.tsx 与 lib/client.js 恢复为 origin/main 内容，删除相应的纯文本回退测试，保留原有 Markdown 渲染。

其余包的 DSH peer 使用 `>=0.2.1-rc.5 <0.3.0-0 || >=0.2.2-rc.1 <0.3.0-0`。第二个分支对官方准入是冗余的，但对 npm/pnpm 默认 semver 是必要的，使两组已知 RC 都通过 peer 约束。Apache Radar 整体要求 rc.1 及以上，所有 DSH peer（包括 ui-primitives）使用 `>=0.2.2-rc.1 <0.3.0-0`，不接纳 rc.5。未来不同补丁号的 RC 仍可能需要新增 peer 分支；这不影响 DSH 的 includePrerelease 准入。没有使用通配 peer 来掩盖该区别。

精确 peer 在已经声明 engines 时不会再次触发 DSH 版本准入检查，但仍可能令包管理器在已有不兼容 peer 时拒绝或警告，即使这些 peer 标为 optional。旧式精确 DSH peer 已放宽。另将旧式 `~4.0.5` Cordis peer 改为 `>=4.0.5 <4.2.0`，`~3.18.5` Schemastery peer 改为 `>=3.18.5 <3.20.0`，覆盖两个官方 tag 的实际版本：

- [Cordis rc.5](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/vendor/cordis/package.json)：4.0.5；[rc.1](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/vendor/cordis/package.json)：4.1.0。
- [Schemastery rc.5](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/vendor/schemastery/package.json)：3.18.5；[rc.1](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/vendor/schemastery/package.json)：3.19.0。

所有 devDependencies、已解析依赖、integrity 和依赖自身版本保持原样；没有运行 npm install。同步了包版本、lock 根版本、lock 根 engines/peers、已有打包断言、当前版本文档及三处 User-Agent（triage / advisory-impact / apache-radar，包括预构建输出）。历史 CHANGELOG 版本和历史验证记录保留。

## 逐包版本与验证矩阵

P = 官方版本准入通过，R = 拒绝；**不代表功能/界面测试通过**。前一批次 typecheck 和 npm test 因 17 个包均缺少 node_modules 全部跳过，没有安装依赖；本次两包已使用用户准备的 junction 依赖完成检查。所有包实际执行了 `npm run verify-pack`。

| 包 | 原版 → 新版 | rc.5 | rc.1 | 0.2.2 | 0.2.9 | 0.3.0-rc.1 | verify-pack |
| --- | --- | --- | --- | --- | --- | --- | --- |
| dsh-advisory-impact | 0.1.0 → 0.1.1 | P | P | P | P | R | PASS |
| dsh-apache-radar | 0.1.0 → 0.1.1 | R | P | P | P | R | PASS |
| dsh-content-evidence | 0.1.0 → 0.1.1 | P | P | P | P | R | PASS |
| dsh-dll-doctor | 0.1.0 → 0.1.1 | P | P | P | P | R | PASS |
| dsh-draft-rescue | 0.2.1 → 0.2.2 | P | P | P | P | R | PASS |
| dsh-file-holder | 0.1.0 → 0.1.1 | P | P | P | P | R | PASS |
| dsh-file-ref-copy | 0.1.1 → 0.1.2 | P | P | P | P | R | PASS |
| dsh-github-triage | 0.3.1 → 0.3.2 | P | P | P | P | R | PASS |
| dsh-heartbeat-monitor | 0.2.1 → 0.2.2 | P | P | P | P | R | PASS |
| dsh-html-deck-export | 0.1.0 → 0.1.1 | P | P | P | P | R | PASS |
| dsh-instruction-conflicts | 0.2.0 → 0.2.1 | P | P | P | P | R | PASS |
| dsh-invoice-gate | 0.1.0 → 0.1.1 | P | P | P | P | R | 未完成：缺 exceljs |
| dsh-permission-doctor | 0.2.0 → 0.2.1 | P | P | P | P | R | 未完成：缺 @deepseek-ai/schemastery |
| dsh-plugin-combo-lab | 0.2.0 → 0.2.1 | P | P | P | P | R | PASS |
| dsh-snip-attach | 0.2.1 → 0.2.2 | P | P | P | P | R | PASS |
| dsh-source-impact | 0.2.0 → 0.2.1 | P | P | P | P | R | PASS |
| dsh-task-review | 0.2.0 → 0.2.1 | P | P | P | P | R | PASS |

Apache Radar 首次 verify-pack 被 Windows checkout 的 CRLF 绊住；将 index.js 精确内容断言统一换行后通过，仍检查完整内容。没有削弱上述两包依赖检查来制造通过结果。

Apache Radar 审核调整后重新运行 `node scripts/verify-engines.cjs` 和包内 `npm run verify-pack`，均通过（打包白名单 53 个文件）；后者临时将 npm 缓存指定到当前 worktree，避免原缓存指向其他 worktree 的权限错误。不再保留已撤销的 SafeMarkdown 回退及其测试结论。版本保持 0.1.1，User-Agent 保持 0.1.1，verify-pack 保留 CRLF 归一化修正。

验证脚本：[scripts/verify-engines.cjs](../scripts/verify-engines.cjs)。执行：`node scripts/verify-engines.cjs`；也可显式传入只读的 `resources/app.asar` 路径。脚本只打开文件读取，不写入宿主、不导入或激活插件，按 ASAR 索引加载原 semver 模块到内存，并调用原构建产物中的 evaluator。

本机 `resources/app.asar` 实际打包的是 **app-boot 0.2.1-rc.5、semver 7.8.5**，不能称为本机 rc.1 运行时。官方 rc.1 源码的 evaluator 与 rc.5 完全相同，rc.1 lock 又解析为同版 semver，因此这使用了任务允许的“官方同版本 semver 函数与相同选项”路径。证据位置：`%LOCALAPPDATA%/Programs/DeepSeek Harness/resources/app.asar` 内 `dsh/node_modules/@deepseek-ai/dsh-app-boot/lib/index.js:251–323`，其中第 277 行为 satisfies 调用；`dsh/node_modules/semver/package.json:3` 为 7.8.5。

脚本还检查未来 `0.2.3-alpha.0` / `0.2.9-rc.1` / `0.2.999-rc.1`、拒绝旧 rc.4 和 0.3 正式版、根 lock 元数据一致、默认 npm semver 下两个已知 RC 的 DSH peers（Apache Radar 从 0.2.2-rc.1 起，拒绝 rc.5）及 rc.1 的 Cordis/Schemastery peers。

## 按实际使用接口的源码复核与风险

以下链接均固定 rc.1；通过切换 URL tag 与 rc.5 对照。没有从 master 推断。源码审阅不能替代缺失依赖下的双版本类型编译或运行时验证。

| 接口 / 相关包 | 对照发现与边界 |
| --- | --- |
| commands.register / execute / CommandDefinitionId；所有提供命令的包 | [commands/index.ts:285、361](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/packages/interaction/commands/src/index.ts#L285) 与 types.ts 两 tag 内容相同；未发现调用签名变化。 |
| remote.commands.execute；triage、snip、source-impact、combo-lab 等 | commands 的远程方法没有变化；[api-remotes/client/index.ts](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/packages/api/remotes/src/client/index.ts) 新增 tool-results remote，现有 commandsRemote 继续提供。网络、权限和返回值实际行为未烟测。 |
| storageDomain.open、表 get/put/update/delete、close；triage | [domain.ts:80、284](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/packages/storage/storage-domain/src/domain.ts#L80) 新增 deleteMany，spec.ts 内容相同；旧方法仍在。但 unknown-state 现在隔离域，之后的读取和写入都可能抛错。不能把这种状态自动解释为“空数据”；此失败路径未运行验证。 |
| llm.stream / listProviders / listModels；triage | [llm/index.ts:483、718](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/packages/llm/llm/src/index.ts#L483) 调用形式仍在，模型目录新增可选 badge；[GenerateOptions.purpose](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/packages/llm/llm/src/types.ts#L551) 改为声明合并用途类型。triage 不设置 purpose，未直接命中该破坏性类型变化；未发模型请求。 |
| agents.list / get、agent/created/status/disposed；triage、heartbeat、advisory、apache、task-review 等 | [agent/index.ts:96、611](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/packages/core/agent/src/index.ts#L96) registry 方法保留；Session 先发布和完成 session/created，再运行 setup，Agent 稍后发布，失败时 Session 已提交事件可保留。涉及时序、自动复盘、生命周期清理的集成仍有风险。 |
| slots.inject/register、conversation.session.header.actions、Modal；triage、draft、source、combo、file-ref-copy | ui-slots 的 index/renderer/store、[Modal.tsx](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/packages/client/ui-primitives/src/Modal.tsx) 两 tag 内容相同。[header.actions:247](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/packages/client/ui-conversation/src/client/contract/slots.ts#L247) 仍是 session list；新增注释要求弹层 portal，因为标题区会裁剪溢出。插件使用的 Modal 已采用 portal；实际布局/焦点/遮挡未验证。 |
| InputState / 草稿存储；draft-rescue | stores.ts 内容相同，但 draft.ts 新增 quote 数据，input.ts:308 新增 sending 状态。插件的 prepareAppend 只允许 plain，会继续拒绝忙碌状态；内部格式仍非稳定 API。0.2.2 已移除 src/core.ts 及 client 的精确版本门禁，严格识别外层结构及 quotes；未知或损坏格式整次拒绝，原存储不写。目标已有 quote 时由宿主拒绝追加，可复制后手动粘贴。见后续功能报告。 |
| composer 隐藏 file input / 桌面 origin；snip-attach | 这是内部 DOM 选择器而非正式 addFiles API。rc.1 的普通 Session 图片改为选中后立即上传（slots.ts:31、54），成功/失败语义不能仅看附件 ID。0.2.2 已将 src/intake.ts 的精确版本门禁替换为实际接口、会话与附件形状检测，确认注入复查 picker；新增 ID 仅作 intake 线索。真实桌面截图、剪贴板、上传仍待验收。 |
| MarkdownText.omitHtml；apache-radar | [MarkdownText.tsx:187–195](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/packages/client/ui-primitives/src/markdown/MarkdownText.tsx#L187) 新增属性，rc.5 缺失；保留 rc.1 下界及原有带 omitHtml 的 Markdown 渲染，拒绝 rc.5。此次未重新验证真实浏览器显示。 |
| 工具注册、tools/pre-execute / tools/result；permission、heartbeat、task-review、advisory、apache、source、invoice、html-deck | tools 源码从大型 index 拆为 contracts/events/executor 等。[events.ts:18、49](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/packages/core/tools/src/events.ts#L18) 仍使用 exec/next 与 exec/result，Scoped 接收者由 ToolRuntime 改为 ToolsService。插件使用的事件参数仍存在；未对新执行器、取消与结果提交的全部时序作保证。 |
| Session Query / systemPrompt / session 记录；instruction-conflicts、permission、heartbeat、task-review | session-query/index.ts 两 tag 内容相同，readSurface/readSession 入口仍在；[session/index.ts:495、511](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/packages/core/session/src/index.ts#L495) 保留 appendPluginRecord/pluginRecordOf。system-prompt 的 assemble 仍在但 tools 组装职责有调整，旧日志折叠/complete/来源推断未做完整新格式回归，结论不确定。 |
| approval.overrideOf / sandboxPolicy.resolve / permissionPresets.current；permission-doctor | [user-approval/index.ts:279](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/packages/interaction/user-approval/src/index.ts#L279) 与 permission-presets 改用 ProjectionHandle，预设初始化从 session/created 改到 agent/created。插件用的查询入口保留，服务初始化未完成时可能抛错并走已有日志回退；失败分类准确性仍需运行验证。 |
| subprocess / workingDirectory；dll-doctor、file-holder 及其他工作目录消费者 | 对照了 subprocess/index.ts、types.ts 与 working-directory/index.ts，现有调用入口仍在。平台进程调用、系统权限、有效 cwd 与取消路径未实测；不宣称跨平台兼容已验证。 |
| workspaceChanges；task-review | 对照 [workspace-changes/index.ts 与 types.ts](https://github.com/deepseek-ai/deepseek-harness/tree/dsh-v0.2.2-rc.1/packages/deliverables/workspace-changes/src)，使用的工作区变化查询未发现确定的删除；无新版本完整集成测试。 |
| 内容面板 / API gateway / 文件链接；content-evidence、advisory、html-deck、invoice、file-ref-copy | 已定位各包实际入口，并检查上面的公共命令、工具、slot/Modal 依赖；每包自定义 remotes、文件链接解析、宿主注入边界和外部依赖未逐一做 rc.1 运行时重验。没有足够证据将元数据修复扩大为这些功能全部兼容的结论。 |

本次变更目标是插件管理器版本准入。**后续 0.2.2 已完成草稿和截图的独立门禁适配与构建/完整测试（使用用户准备的只读 junction 依赖）；真实 rc.1 桌面仍待验收。** Apache Radar 因依赖 rc.1 新增安全属性保留 rc.1 下界，保留真实浏览器验证边界。

## README skill 自检

遵循本地 `C:/Users/Mayn/.dsh/skills/dsh-plugin-readme/SKILL.md`，只改版本及兼容说明。已有 README 的完整文案重排不属于此次任务。

- [ ] 首屏收益先于实现：有些原文先写版本，本次保留，未全面重写。
- [ ] 3–4 条收益亮点：各原文结构不同，未全面重排。
- [ ] 同类/原做法差异：保留原文，本次未重新实测比较。
- [ ] 示例或真实截图：保留原文，未将历史截图当作本次验证。
- [ ] 图片/链接/锚点：本次新增链接与本地目标已核对，原文全部外链未逐个访问。
- [ ] 三步快速上手：原文并非全部满足，未因兼容修复扩大改写。
- [x] Git 安装地址未改用未经核实的地址。
- [ ] 首次入口、配置、最小操作：保留原文，未复做全部功能验收。
- [x] 新增术语解释清楚，命令和配置键保持准确。
- [ ] 版本与限制全部集中在最后：新增说明在文末，部分原文前置版本保留。
- [ ] 开头无验证记录：部分既有 README 有版本/校验文字，本次未重写。
- [x] 新增兼容结论区分准入、源码复核和实机验证。
- [x] 名称与真实包名一致，未引入凭据或私人资料。
- [x] 只改本次授权 worktree，未执行安装或发布；按用户要求将两个客户端文件恢复为 origin/main 内容，未 commit/push。
