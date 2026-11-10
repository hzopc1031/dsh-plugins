# dsh-source-impact · 资料更新影响分析

当前源码版本 **0.2.0**（尚未发布本次版本到 npm）。每次 scan 内按来源复用文件 SHA-256、CSV/行解析与相同定位结果；缓存不跨 scan，plan 仍重新读取全部来源并核对 scanId。scanId 的输入与完整 JSON 明细语义保持一致。/impact check 默认最多显示 20 条状态摘要；/impact check json 查看完整引用、结论、产出和摘录。模型工具 source_impact_check 默认返回最多 20 条简要状态（含 total/affectedCount/truncated），details:true 才返回完整结构。操作使用 workingDirectory.get(session)，服务缺失时回退 header.cwd；成功输出会写明当前执行目录或回退目录。/cd 后读取新目录的独立 registry，不移动原登记。可用 `/impact accept <scanId> [id...]` 在重新核验后原子接受新基线（省略 id 时只接受已变化且可重新定位的引用）；失败不改写原登记，并保留上一版基线。会话标题栏“资料引用登记”提供登记和接受表单。模型工具仍只读。

本次只完成 Windows 上的 typecheck、单元/rc.5 headless 集成、browser factory 的 jsdom 检查及 verify-pack；未安装到真实 DSH、未做 Electron 目视验收。

版本：0.2.0。适配 DSH 桌面版 0.2.1-rc.5（Node 22+），MIT。

把“来源文件变了”追到“哪些表格、结论、报告章节需要重查”。只处理用户或调用方明确登记的关系：

**本地来源文件 → 引用范围 → 结论 → 产出位置**

例如报价 CSV 中 A 产品的单价变化后，列出引用该价格的采购比较表、建议章节及报告。插件提供事实比较和重查任务，不判定结论错误，也不改写报告。

## 安装

本包已有 main 安装版本；本次新版本须等对应提交推送后，使用包含该提交的 Git ref 安装。未发布 npm。

Git 地址：

```text
github:hzopc1031/dsh-plugins#main&path:/packages/dsh-source-impact
```

先完全退出桌面 DSH（含托盘），使用桌面捆绑 CLI，在 PowerShell 执行：

```powershell
& "$env:LOCALAPPDATA\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop add "github:hzopc1031/dsh-plugins#main&path:/packages/dsh-source-impact"
```

不要依赖 PATH 上的独立 `dsh`；它可能提示 desktop profile 由 Electron 管理。也可在 UI：**插件 → 添加插件**，填入上面的完整 Git 地址。安装后重新打开 DSH。

卸载同样使用桌面 CLI：

```powershell
& "$env:LOCALAPPDATA\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop remove dsh-source-impact
```

## 使用流程

先在 DSH 中选择本地项目。所有路径均相对**当前会话项目目录**，只允许项目内的 `.md`、`.csv`。首版按需检查，不常驻监听目录。

1. 准备来源文件和产出文件。
2. 用户或调用方通过 `/impact register` 或会话头部「资料引用登记」表单登记每条明确引用，捕获基线。
3. 来源更新后运行 `/impact check`，查看受影响表格、结论和章节。
4. 用户选择引用 id，运行 `/impact plan <scanId> <id1,id2>`。
5. 将返回的 JSON 复制到普通对话，要求 DSH 执行所选重查任务。
6. 人工复核后，用 `/impact accept <scanId> [id...]` 或表单接受新基线；不要依赖模型工具改写基线。

**斜杠命令的结果不会自动作为模型消息提交。** 插件生成可执行步骤，用户把清单交给 DSH；本插件不会自行启动代理任务。清单要求重读来源、校验当前哈希、执行登记的重算方法、核对产出位置、记录复核依据，再提出修改建议。

### 采购报价示例

项目内的 `quotes.csv`（UTF-8）：

```csv
item,vendor,price
A,甲供应商,100
B,乙供应商,200
```

假定你已经制作了 `comparison.csv` 和 `report.md`，其中采购比较表和建议引用 A 的报价。输入以下完整命令登记：

```text
/impact register {"id":"price-a","source":"quotes.csv","selector":{"kind":"csv-key","keyColumn":"item","keyValue":"A","columns":["vendor","price"]},"conclusion":{"id":"buy-a","text":"建议购买 A"},"outputs":[{"path":"comparison.csv","kind":"table","locator":"item=A","label":"采购比较表"},{"path":"report.md","kind":"section","locator":"## 采购建议","label":"采购建议章节"},{"path":"report.md","kind":"report","locator":"全文","label":"采购报告"}],"recheck":"按最新 price 乘以采购数量 10，重算采购比较表总价，核对建议的依据并输出差异。"}
```

将 A 的单价改为 105 后：

```text
/impact check
```

结果会列出 `price-a` 的三个状态，以及对应结论、采购比较表、报告章节和报告。复制结果中的完整 64 位 `scanId`，再选择：

```text
/impact plan <实际scanId> price-a
```

如有多条引用，只选择需要重查的 id，例如 `price-a,price-b`。一条引用对应多个产出位置时会把这条引用登记的所有位置放进任务；需要分开选择的章节应登记为不同引用 id。支持同一结论关联多个来源引用，同一结论 id 的文本须一致。

若只改 B 的单价，A 的引用会显示“来源版本已变化”，`citationContentChanged: false`，不会因此自动要求人工复核；用户仍可选择它进行重查。

### Markdown 引用

`selector` 支持以下两种方式，其他登记字段与 CSV 示例相同：

```json
{"kind":"markdown-lines","start":3,"end":5}
```

行号从 1 开始，首尾包含，按规范化换行后的物理行计算。末尾换行不额外算空行。前面插入行导致范围偏移时，可能比较到别的文本，因此会保守要求人工复核。插件不会猜测段落迁移。

```json
{"kind":"markdown-quote","text":"报告引用的完整原文"}
```

原文须在来源中唯一出现；移动位置但原文不变时仅标记文件版本变化。找不到、重复出现时为“需要人工复核”，引用变化值为 `null`，不伪造新旧内容比较。需要精确比较改写后的同一位置时可使用行范围定位。

### 登记字段

| 字段 | 说明 |
| --- | --- |
| `id` | 唯一引用 id，仅字母、数字、下划线、连字符 |
| `source` | 项目内来源文件的相对路径，扩展名与 selector 类型匹配 |
| `selector` | Markdown 行范围、唯一原文或 CSV 唯一键与列 |
| `conclusion.id/text` | 被引用支持的结论 id 和用户明确登记的文字 |
| `outputs[]` | 产出文件 path、kind（table/section/report）、位置 locator、名称 label |
| `recheck` | 可执行的重查方法，如数量、公式、比较口径及需要核对的依据 |

CSV 使用逗号分隔，第一条记录是表头。支持带引号的逗号、双引号转义和多行单元格；拒绝空/重复表头、不等列数、非法引号。键列的选定值必须唯一，所选列必须存在。列名和键值精确匹配、不去空格、不做数值转换；`100` 与 `100.0` 会视为引用内容不同。调换行或表头列顺序不会改变按键选定的单元格引用哈希。

产出位置只是用户登记的地址，不检查该章节是否仍存在，也不读写产出物。请让 DSH 在执行重查时核对它。

## 三类状态

状态可叠加，`false` 表示比较后未变，`null` 表示无法判定。

| 事实 | 来源版本已变化 | 引用内容已变化 | 需要人工复核 |
| --- | --- | --- | --- |
| 文件和引用均相同 | 否 | 否 | 否 |
| 文件其他位置变化，引用相同 | 是 | 否 | 否 |
| 可以定位引用且内容不同 | 是 | 是 | 是 |
| 文件已变，但引用丢失/不唯一/解析失败 | 是 | 未知 | 是 |
| 来源不可读、丢失、超限或不符合路径规则 | 未知 | 未知 | 是 |

版本采用规范化完整文件文本的 SHA-256：去除开头 UTF-8 BOM，将 CRLF/CR 统一为 LF，不修剪其他空白。Markdown 引用哈希取选定文本；CSV 引用哈希取按登记列顺序生成的 `[[列名,单元格文本],...]` JSON。文件格式变化可能只影响版本哈希。

影响列表按登记关系传播到结论和产出位置，并提供去重汇总。未登记的引用不会被发现；不做语义推断、自动文档理解或结论真伪判断。

## 命令与调用接口

```text
/impact
/impact help
/impact register <单条登记JSON>
/impact list
/impact check
/impact plan <scanId> <id1,id2>
/impact accept <scanId> [id1,id2]
/impact remove <id>
```

`check` 与 `plan` 都不更新基线。生成清单前会重新读取来源和登记文件，指纹与选择时不同就拒绝并要求重新检查。文件仍可能在清单生成后再次变化，任务步骤因此要求 DSH 执行前再次验证哈希；多文件检查为逐个读取，不提供文件系统事务快照。

人工完成复核后，使用 `/impact accept <scanId> [id...]` 原子接受新基线并保留上一版；命令会重新核验 scanId，失败时原登记不变。也可以 `remove <id>` 再重新 `register`。重复登记 id 会报错，不会静默覆盖。

模型可调用 **`source_impact_check`**，无参数时返回 `scanId`、总数和最多 20 条状态摘要；传入 `details: true` 才返回完整 `impacts`、`affected`、基线与当前引用摘录及 SHA-256。工具只读，不开放模型侧自动选择、登记或改写报告能力。

调用方可导入 `dsh-source-impact/core`（纯函数）和 `dsh-source-impact/store`（受限本地 I/O）：

```typescript
import { createPlan, type Registration } from 'dsh-source-impact/core'
import { ImpactStore } from 'dsh-source-impact/store'

// cwd 是调用方已选择的本地项目绝对路径；entry 是调用方明确提供的引用登记。
async function prepare(cwd: string, entry: Registration) {
  const store = new ImpactStore(cwd)
  await store.add(entry)
  return store.scan()
}
// 在展示 scan 并取得用户选择后：
// createPlan(freshScan, selectedReferenceIds, previouslyDisplayedScan.scanId)
```

## 存储与边界

- 仅在执行登记/移除时写入项目 `.dsh/source-impact/registry.json`，建议将该目录加入项目自己的忽略规则。初次只读检查不会创建目录。
- 登记文件保存引用关系、基线版本/引用哈希及引用摘录；CSV 只保存所选单元格，Markdown 只保存选定段落。它们可能包含业务数据，不建议提交或共享。
- 输出到 DSH 的检查/清单可能进入会话日志；模型工具的结果会进入模型上下文，并可能按 DSH 配置发送给模型提供商。插件自身没有网络请求。
- 来源限 UTF-8、每文件 5 MiB、每引用 64 Ki 字符、最多 1000 条引用、登记文件最多 16 MiB。输出地址也限本地 Markdown/CSV；不支持 XLSX、PDF、Word、URL、网络共享或跨项目路径。
- 路径拒绝父目录跳转、绝对路径、Windows 数据流及设备名、`_private`、`_tools`、`.git`、`.dsh`、`.env*`；解析来源真实路径后检查项目边界。登记目录拒绝符号链接/junction。
- 写入采用单写者锁及同目录临时文件重命名。损坏的登记文件会报错，不自动清空。进程异常退出留下 `registry.lock` 时，确认没有写入进程后可手动移除该锁再重试。
- 不监控全盘、不修改 DSH 全局配置；不安装其他文档解析插件；不包含版权受限媒体。
- 本任务没有安装到用户 DSH、没有改桌面 profile、没有 commit/push 或 npm 发布。

## 开发与验证

```powershell
npm ci --ignore-scripts --no-audit --no-fund
npm run typecheck
npm test
npm run verify-pack
```

`npm test` 先生成完整 `lib/*.js` 与 `lib/*.d.ts`，再运行单元、文件系统和 rc.5 真实 Cordis 注册表集成测试。真实注册表测试只在内存和测试临时目录执行；systemPrompt 使用测试替身，不接触任何 profile 或模型服务。

`verify-pack` 使用 `npm pack --dry-run --json --ignore-scripts` 精确检查发布文件白名单、导出入口和 bundle patch，并拒绝安装期脚本。Windows 上调用 npm 时启用 `shell`，避免 spawn ENOENT。发布文件不含源码、测试、脚本、STATUS、锁文件、node_modules 或临时数据；仓库保留源码、测试、lockfile、STATUS 及预构建 lib，Git 安装无需构建。

本批次使用 Node 24.20.0 / npm 11.19.0 / Windows，直接在各独立包目录构建与测试，临时 npm 缓存放在 worktree 的 .tmp 内。未做真实桌面 UI 安装及真实模型重查执行验证。

挂载参考：[官方工具教程](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/tool.zh.md)、[官方命令包](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/interaction/commands)。实现使用 `inject`、`ctx.tools.register(defineTool(...))`（含 output.schema/render）、`ctx.commands.register` 和 `ctx.effect`；接口以本机 rc.5 包的声明及真实注册表测试为准。

## 本版本开发校验

在本包目录独立执行，使用本包 lockfile（根目录无 workspaces）：

```powershell
npm ci --ignore-scripts
npm run typecheck
npm test
npm run verify-pack
```

`npm test` 会重建需提交的 lib/。以上通过不等于 Electron 桌面通过；真实截图、剪贴板、焦点/布局及桌面安装仍需人工验收。

本次接口依据（固定 rc.5）：[packages/session/working-directory/src/index.ts](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/session/working-directory/src/index.ts)。
