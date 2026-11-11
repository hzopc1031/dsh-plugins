# Confined tools and command UI

The command is the MVP's thin UI. It runs directly without calling a model. No slots panel, Remote API, background upload or financial telemetry is registered. Full evidence stays in local report files. This gate does not prove authenticity, payment, reimbursability or accounting-archive compliance.

## Select a run locally

Create a UTF-8 JSON manifest inside the selected DSH project. This example selects synthetic files that you supply; names do not imply the files already exist:

```json
{
  "schemaVersion": 1,
  "inputs": [
    { "path": "SAMPLE-invoices.json", "kind": "ticket" },
    {
      "path": "SAMPLE-ledger.csv",
      "kind": "ledger",
      "mapping": {
        "number": "发票号码", "amount": "金额", "tax": "税额",
        "total": "价税合计", "currency": "币种", "date": "开票日期",
        "buyer": "购买方", "seller": "销售方"
      }
    }
  ],
  "rules": {
    "buyerWhitelist": ["SAMPLE 示例买方"],
    "period": { "start": "2026-11-01", "end": "2026-11-30" }
  }
}
```

Only `schemaVersion`, `inputs`, optional `rules` and optional `corrections` are accepted at the top level. `inputs` must be nonempty. Each input accepts `path`, `kind`, optional `mapping`, `sheet`, and `ocrJson`, as documented in [inputs.md](inputs.md). Table column mapping is explicit. `rules` accepts only the optional buyer whitelist and date period from [reconciliation.md](reconciliation.md). Omitted rules appear as unexecuted in reports.

An optional `"corrections": "SAMPLE-human-confirmations.json"` names a human-prepared corrections file with the documented before/after audit schema. Only the human `start` command reads it. Its bytes and the manifest are captured once; edits require stop/start to take effect. Tools cannot select, reload, append or supply corrections, manifests, input lists or field values. Human reviewer names/timestamps are assertions, not authenticated identity. Model-authored corrections are forbidden. No plugin hook writes back amounts, identifiers or source files.

All paths resolve from the selected project, including paths in a manifest stored in a subdirectory. Absolute paths, traversal and escaping symlinks are rejected. Manifest and correction reads use the same descriptor-checked, read-only reader as originals. Input failures, including missing files and symlink escapes, remain in the ingest inventory; they increase exception counts and do not become passes. Missing or invalid table mappings are refused during ingest, with the file and its rows inventoried; columns are never guessed. Export requires a new relative destination with an existing parent; see [exports.md](exports.md).

## Commands

```text
/invoice-gate help
/invoice-gate start SAMPLE-run.json
/invoice-gate ingest
/invoice-gate check
/invoice-gate export SAMPLE-pack
/invoice-gate status
/invoice-gate stop
```

The path is the entire remaining argument; spaces in local filenames need no quoting. Start pins the canonical current project directory from `workingDirectory.get(session)`, falling back to `session.header.cwd` only when that service is absent. A directory change requires stop/start. One run is allowed per plugin instance and belongs to its starting agent. Other sessions cannot operate or stop it. Runs are in memory; session/plugin disposal clears them. Exported files remain on disk. There is no resume protocol.

Ingest snapshots the selected originals. Re-ingest invalidates the previous check/export summary. Check uses the snapshot, selected rules and captured human confirmations. Export requires a check; unresolved evidence exports visibly as a draft. Status includes mismatch, unchecked, pending key-field and exception counts plus report paths when exported. Exception count is inventory entries in failed/refused/partial state, including file and unit entries; it is not a unique-document count. Read the exported inventory for details. Stop lifts the tool mask and guard; it never deletes packs or originals. A busy operation rejects overlapping operations and stop; retry once it settles. Cancellation is checked before and after local work; parser/writer operations settle before returning, and an already published pack may remain after cancellation.

### 中文状态文件与命令回执

`start`、`ingest`、`check`、`export`、`status`、`stop` 成功后，命令回执返回中文 Markdown，并将完全相同的 UTF-8 文本写入所选项目内的 `invoice-gate-<运行 ID>-status.md`。一次运行始终原子替换同一路径；下一次 start 使用新路径，保留上一次状态文件。工具成功执行 ingest/check/export 也会更新该文件，但只把路径及精简摘要返回模型。

状态文件列出运行 ID、草稿／本地字段已核对状态、文件与异常项计数、每个拒绝／失败／待核单元的原因和处理建议，以及已导出的 Markdown、XLSX、JSON 路径。金额表、原文和完整检查结果仍只在证据包中。只用命令的 DSH 会话可能停在欢迎页且不显示结果卡片；此时请在项目目录中找到 `invoice-gate-*-status.md`，打开它及证据包查看结果。无需模型调用。

状态文件权限为 `0600`。写入使用与现有导出器一致的 Linux `/proc/self/fd` 目录锚定；本任务未验证原生 macOS／Windows 写入。已有状态文件若被删除、替换或改为符号链接，会拒绝覆盖；停止后重新 start 可生成新路径。写入失败会保留上一次文件并返回错误，本次内存检查或已完成的证据包导出可能已生效，可用 status 重试更新。stop 即使写入失败也会恢复工具权限。停止后的 status 可刷新该会话最后一次状态；插件／会话销毁后不提供恢复运行协议。

导入清单保留稳定的 `reason` 代码，并附带中文 `message`（文件名、真实的工作表／页／行定位和下一步建议）。数值类型票号和无缓存公式的说明也保存在对应字段及行清单中。Markdown、XLSX、JSON 证据包均保留这些说明；不会把已知编码或格式错误都归为通用解析失败。

## Model tools

| Tool | Arguments | Effect |
| --- | --- | --- |
| `invoice_gate_ingest` | `{}` | Read the human-selected inputs; inventory every outcome. |
| `invoice_gate_check` | `{}` | Run deterministic checks on the snapshot. |
| `invoice_gate_export` | `{"directory":"SAMPLE-pack"}` | Write a new Markdown/XLSX/JSON pack. Optional `includeOriginals: true` copies hash-checked originals locally; default false. |

The canonical successful tool value is a JSON string containing counts, run id, status, project/manifest paths, the project-relative `statusFile` path and optional compact pack summary. The renderer returns that same JSON string; it does not return the human command recap or refusal details. Neither tool surface contains extracted records, original text, invoice numbers, parties, field values, amounts or full rule reports. There is no verbose/details opt-in. Unknown arguments are rejected, including `amount`, `tax`, `total`, `number`, `corrections`, `inputs`, `manifest`, `verbose` and `details`. Unknown/rewrite tools have no registered executor and are denied. The plugin catches file/parser/schema errors and emits fixed messages without raw exceptions or transaction dumps; it does not log financial payloads. DSH's own tool-call/session recording remains host-owned; use manifests rather than financial data as tool arguments. File paths themselves are visible, so avoid sensitive identifiers in filenames.

`agent.ctx.tools.restrict({ allow: [...] })` masks other global tools for the run. A scoped monotonic guard also denies scope-local tools, descendant calls and `run_code`, which the restriction API itself cannot mask. A global guard rejects invoice-gate requests without the owning run and rejects unknown arguments/traversal. The bodies repeat validation, and actual reads/writes enforce resolved-path/descriptor confinement. Stop/disposal restores prior tools without changing other agents' masks.

**Use the native executor for model tool calls.** PTC's arbitrary-code `run_code` transport is blocked during a confined run; allowing it could bypass file/amount boundaries through runtime filesystem APIs. The plugin does not switch the host's executor. All slash commands remain usable with zero model calls in either deployment. This is an invoice-gate tool boundary, not an operating-system sandbox: local operators and unrelated host services remain outside its control.

No plugin operation requests network access, invokes OCR, uploads data or calls a model. No amount-rewrite API is provided. Human review changes belong in the confined corrections-file workflow, with extracted and normalized evidence preserved separately.
