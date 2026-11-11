# dsh-invoice-gate

把本地票据和台账放在一起，找出金额勾稽、重复票号和未匹配记录，再导出一份能追溯原始文件的核对证据包。适合单人逐次核对 CNY 票据；不替你识别扫描件，不做税局验真，也不替你判断能否报销。

**0.1.1 尚未发布到 npm。**

模型不得编造或改写金额、税额、合计或票号；没有改金额工具。整次核对可以只用命令完成，零模型调用。插件只读原件、记录 SHA-256，不写回来源文件，不自动上传、不发起网络请求，也不采集财务遥测。SHA-256 只能帮助发现文件变化，不能证明票据真实。

## 安装与兼容

需要 Node.js `>=22`、DSH `>=0.2.1-rc.5 <0.3.0-0`。API 对照源码 `fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159`；本 Linux 盒子的实际加载检查使用 DSH `0.2.2-rc.1`。下限宿主库通过自动化测试，不代表已验证所有宿主版本。

从 Git 安装（先停止使用该 profile 的 DSH，再安装并重启）：

```sh
dsh plugin --profile web add "github:hzopc1031/dsh-plugins#main&path:/packages/dsh-invoice-gate"
```

桌面用户可将 `web` 换成其桌面 CLI 使用的 `desktop` profile。插件已提交编译后的 `lib/`，没有安装生命周期脚本。Cordis id 是 `invoice-gate`。本地开发也可在仓库根目录执行：

```sh
dsh plugin --profile invoice-gate-demo add ./packages/dsh-invoice-gate
```

## 一次核对怎么做

1. 在 DSH 里选择项目目录，把待核对文件放入其中。创建 UTF-8 清单 JSON，列出文件及表格的明确列映射，示例见 [工具与清单说明](docs/tools.md)。示例文件名不表示插件自带这些文件。
2. 用 `/invoice-gate start SAMPLE-run.json` 读取清单；可选的人工确认 JSON 也在此时固定。运行期间，此 agent 的其他工具会受限；`stop` 后恢复。
3. 依次导入、检查、导出，然后在本机打开报告查看差异及来源：

```text
/invoice-gate ingest
/invoice-gate check
/invoice-gate export SAMPLE-pack
/invoice-gate status
/invoice-gate stop
```

`/invoice-gate help` 显示帮助。命令界面就是 MVP 的薄界面，没有额外网页面板或插件 Remote API。模型工具只有 `invoice_gate_ingest`、`invoice_gate_check`、`invoice_gate_export`，默认返回数量、run id、状态和文件路径，不把原文、金额表或完整报告送入模型上下文。PTC `run_code` 在运行期间被阻止；模型工具需用 native executor，命令不需要模型或凭据。

每次 `start`、`ingest`、`check`、`export`、`status`、`stop` 都会原子更新项目内的 `invoice-gate-<run UUID>-status.md`，命令回执与文件内容一致。文件包含中文计数、异常原因与处理建议、草稿状态及报告路径，不含金额表或原文。工具仅额外返回 `statusFile` 路径。停止后文件保留；运行本身不能续跑。详见 [状态文件说明](docs/tools.md#中文状态文件与命令回执)。

本次 Linux DSH 0.2.2-rc.1 新建纯命令会话仍停留在起始页，没有显示结果卡片。GBK 台账、金额差异、OFD 拒绝三个合成样例的命令事件、状态文件和证据包均已核对。请在本机打开状态文件与报告；不需要添加模型回合。

## 输入与拒绝范围

- 接受本地 UTF-8（可带 BOM）、GBK / GB18030 CSV、XLSX、[文档定义的 JSON / 用户自备 OCR 字段 JSON](docs/inputs.md)、带标签的 PDF 文本层、文档定义的 `Invoice schemaVersion="1"` XML。CSV 编码按严格解码记录在文件清单；JSON 清单仍用 UTF-8。XML 只支持已记录且有合成样例的结构，不承诺兼容任意电子发票 XML。
- CSV/XLSX 必须明确映射列名；没有微信、支付宝专用模板。`amount` 是未税金额，`total` 是价税合计，不能互换猜测。
- 拒绝项会显示文件及实际页／行／单元格位置（适用时）、中文原因和下一步建议，并保留机器可读原因码。例如 OFD 会建议另行提供受支持格式，公式无缓存会建议核对原件后提供存储值；不会自动修复。拒绝 OFD；图片和无文本层扫描 PDF 需用户提供 OCR JSON。内置 OCR、云识别、邮箱采集、平台登录与抓取均未实现。
- 不执行宏、外链、公式或脚本；只读存储的单元格值。公式无缓存值则记为 `unchecked`，不重算、不猜数。数值类型的票号拒绝视为可靠标识；20 位票号始终按文本处理。
- 每个文件、页、表格行、跳过项和失败都有清单记录。缺失、截断、不可读或拒绝的输入不会静默消失。

## 规则、人工确认与证据包

金额按整数分计算，空白不等于零。币种、正负号或精度不明确时为 `unchecked`，不能算通过。规则包括金额＋税额＝合计、已有明细合计、重复票号、重复文件哈希、可选购买方白名单与日期范围，以及按票号匹配的台账核对；不自动删重或合并。未执行和未实现的规则会列出。例：**SAMPLE / 非真实票据** `100.00 + 6.00` 对原始合计 `108.00`，报告应显示预期 `106.00`、实际 `108.00`、差额 `2.00`，保留原始 `108.00`。

提取值、标准化值、人工确认值分开保存。人工可按 [确认 JSON 格式](docs/reconciliation.md) 记录修改前后、确认人和时间，再 stop/start 重跑；模型不得代写确认文件，插件工具不能写入或替换金额、票号。确认人和时间是操作者声明，不是身份认证。字段审阅、规则结果、外部核验互相独立；外部核验始终为 `not-checked`。只要差异或关键待核字段仍在，就不能标记全部核对完成；算术通过但未人工核对的样例也仍是草稿。

导出新目录，内含 `report.md`、`report.xlsx`、`export-report.json`；可选 `includeOriginals: true` 在工具导出时附上经哈希检查的原件副本，默认只导出摘要。票号在 XLSX 中为文本。差异以文字列出 rule id、expected / actual / difference，来源保留真实页码、单元格、XML/JSON 路径或明确标为“无来源／待核”。报告包含导入清单、未执行规则、人工确认历史和草稿标记。详见 [导出说明](docs/exports.md)。

读写限制在启动时选定的项目目录，拒绝绝对路径、`..` 和逃逸符号链接。导出父目录必须存在，目标必须是新目录；通过临时目录写完后原子发布，失败不覆盖已有证据包。只支持单操作者，不承诺并发写入协调或断电持久性。运行状态只在内存，停止或会话释放后不会续跑，已导出文件保留。工具限制不是操作系统沙箱。

**平台边界：** 导入原件、清单、确认 JSON、导出时复制原件，以及证据包和状态文件写入均不依赖 `/proc/self/fd` 或 `/dev/fd`。Linux 测试强制这两类路径失败，验证读写、越界／符号链接／祖先目录替换拒绝、原子发布和失败保留；隔离 DSH 进程也在禁用这两类路径后完成 GBK、差异和 OFD 拒绝样例。原生 macOS／Windows 未测试，不能据此声称已在这些系统验证。

**本包不证明票据真实、已付款或可报销，不是会计档案合规认证。** 不做多币种换算、拆合付款、红蓝票专门流程、多人审批、付款、记账、报税或抵扣判断；完整约定见 [绑定决策](docs/decisions.md)。

插件自身不上传，但 DSH 的会话记录、上传及遥测属于宿主设置；不要把“不调用模型”理解为宿主不会记录命令结果。路径会出现在摘要中，文件名也应避免敏感信息。本次隔离 profile 检查显式关闭了宿主会话上传与遥测，未改变现有 `web` profile。

## English

**Unreleased 0.1.1; git branch installation only.** A local verification gate and evidence pack for a single operator reconciling CNY invoices against a ledger. Requires Node >=22 and DSH `>=0.2.1-rc.5 <0.3.0-0`; live loading was checked on Linux with `0.2.2-rc.1`, source `fcc0ad46`. Use the branch installation command above; this package is not npm-published.

Select a project, prepare the local manifest with explicit table mappings, then run `/invoice-gate start`, `ingest`, `check`, `export`, `status`, and `stop`. Commands need no model call. The three prefixed tools return counts, ids, status and paths only. The owning agent is restricted during a run; arbitrary PTC code is blocked. See [tools.md](docs/tools.md) for exact arguments and the manifest example.

Inputs are UTF-8 (optional BOM), GBK/GB18030 CSV, XLSX, documented structured or user-supplied OCR JSON, labelled PDF text layers and the documented XML dialect. CSV encoding is recorded in the file inventory; JSON manifests remain UTF-8. OFD and scans/images without OCR JSON are refused. No OCR engine, login, scraping or tax-bureau verification is included. Originals are read-only and hashed; every failure/skip is inventoried. Formulas, macros and external links are not executed. Missing cached formula results stay unchecked. Identifiers remain strings, including 20-digit invoice numbers.

**The model must never invent or change amounts, tax, totals or identifiers.** There is no rewrite tool. Integer-fen rules check arithmetic, line totals, duplicates, optional buyer/date constraints and invoice-number ledger matching. Blank is not zero; ambiguous money/currency is unchecked. Extracted, normalized and human-confirmed values stay separate. Human corrections carry before/after provenance and trigger fresh checks without changing originals; no tool accepts corrections or model-authored replacement values.

Exports contain Markdown, XLSX text cells and JSON, with optional hash-checked originals and relative paths. Reports show textual expected/actual/difference/rule-id evidence, unexecuted rules and draft status while mismatches or key reviews remain. External verification is always `not-checked`. New destinations are published atomically; previous packs are never overwritten. Reads and writes reject project escapes, including symlinks. Single-run in-memory state has no resume or concurrent-writer protocol. Each successful run command also atomically refreshes `invoice-gate-<run UUID>-status.md` in the project, with Chinese counts, refusal guidance and report paths. The command text equals this file; tools return its `statusFile` path without amount tables. Files survive stop.

Confined ingest/manifest/confirmation reads, copied-original reads, export and status writes work without `/proc/self/fd` or `/dev/fd`. Linux tests force both to fail and cover confinement, ancestor replacement, atomic publication and preservation on failure. An isolated DSH process also completed the GBK, mismatch and OFD-refusal samples with both fd paths disabled. Native macOS and Windows were not tested; this does not establish native compatibility.

The plugin makes no outbound network requests, model calls, automatic uploads or financial telemetry. DSH's own session recording/sharing settings remain host-owned. This pack **does not prove authenticity, payment or reimbursability and is not accounting-archive certification**. SHA-256 is not proof of a genuine ticket. Multi-currency, payment workflows, approval, booking and filing are outside this MVP.

## 构建与验证 / Development checks

```sh
cd packages/dsh-invoice-gate
npm ci --omit=optional --ignore-scripts
npm test
npm run verify-pack
```

The suite uses labelled synthetic documents only. It checks ingest/refusal, exact money and identifiers, immutable sources, path confinement, corrections/drafts, atomic exports and real native-tool scope/guard behavior with network entrypoints blocked. A live isolated DSH web load and synthetic command run complement the tests; they do not establish a full host-version matrix or Microsoft Office compatibility.

In the fresh command-only web session, the main view stayed on its landing screen instead of showing command-result cards. Durable `command/done` events, status files and GBK/mismatch/OFD-refusal packs confirmed execution without a model turn. Earlier Linux evidence includes LibreOffice Calc opening the mismatch XLSX read-only; this polish run checks XLSX with ExcelJS. Microsoft Excel, PowerPoint and WPS were not used.

Optional PDF rendering dependencies are unnecessary for text extraction and were omitted in testing. PDF.js may print missing-canvas/polyfill warnings; the plugin does not render PDFs. The 2026-11-11 package-root `npm audit --omit=dev` reports **0 vulnerabilities** (info/low/moderate/high/critical all zero), after a clean `npm ci --omit=optional --ignore-scripts`. ExcelJS stays pinned to 4.4.0; the scoped override pins its CommonJS-compatible uuid to 11.1.1, patched for [GHSA-w5hq-g745-h8pq](https://github.com/uuidjs/uuid/security/advisories/GHSA-w5hq-g745-h8pq). XLSX ingest/export, complete text identifiers and failed-export preservation pass. This is a dated dependency audit, not a security certification; development-only host findings remain outside this fix.

### 安装后的依赖审计 / Consumer override limit

上述零发现只适用于本包作为根项目、使用提交锁文件的安装。本包作为依赖安装时，[npm 不继承依赖里的 overrides](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#overrides)。DSH 使用 pnpm；Git 分支安装不能自动保证 uuid 已修复。停止目标 profile 的 DSH，在其 `pnpm-workspace.yaml` 中合并下列 [根级 overrides](https://pnpm.io/settings#overrides)（保留已有设置），再运行 `dsh plugin --profile <name> install --ignore-scripts`，并用 `dsh plugin --profile <name> why uuid` 检查解析结果：

```yaml
overrides:
  "exceljs@4.4.0>uuid": "11.1.1"
```

A consuming DSH profile must apply the override at its own pnpm root and audit that resolved graph. The package-root result does not claim every host/profile is audit-clean. The live check here used a local link to the clean npm-installed package tree; no existing profile was changed.

Prebuilt `lib/` and declarations are committed; installation has no lifecycle hooks. MIT © 2026 hzopc1031.


### 0.1.1 兼容性声明

本版声明 DSH `>=0.2.1-rc.5 <0.3.0-0`。官方版本检查使用 `semver.satisfies` 并开启 `includePrerelease`：接纳 0.2.1-rc.5、0.2.2-rc.1 及后续 0.2.x 预发布/正式版，排除 0.3.0（含预发布）。DSH peer 显式覆盖两个已知 RC，Cordis / Schemastery peer 覆盖两个官方 tag 的版本；开发依赖不变。此次没有安装到用户 DSH；准入通过不等于逐版本功能或界面验证通过。

校验逻辑、源码对照与本次检查结果见[兼容性报告](../../docs/engines-compatibility.md)。
