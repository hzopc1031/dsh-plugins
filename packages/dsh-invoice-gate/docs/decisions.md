# dsh-invoice-gate MVP decisions

Recorded: 2026-11-10, Asia/Shanghai (UTC+8).
These choices fill gaps the research left open, always preferring the **smallest reasonable MVP**. Sources: `next-plugin-candidates.md` item 2, `round9/our-analysis.md`, `codex-astra-round9-final.md`, `DSH-插件调研完整版.md` §7, `codex-astra-round10-final.md`.
Codex must follow this file. If a choice is unworkable, do not silently expand scope; record the problem in the task summary and pick the next-smallest fallback.

## Name and placement

- Package name: **`dsh-invoice-gate`**. Checked 2026-11-10 (Asia/Shanghai): `npm view dsh-invoice-gate` returned 404; GitHub repository search `dsh-invoice-gate in:name` returned 0 repos.
- Cordis plugin id: **`invoice-gate`**. Branch: **`feat/invoice-gate`**. Worktree: `/workspace/dev/dsh-plugins-invoice-gate`.
- Nearby names that are **not** this package and must not be taken or claimed as compatible by default:
  - npm `dsh-invoice` (0.0.1, “name reserved”)
  - npm / GitHub `dsh-einvoice`, `dsh-invoice-ledger`, `dsh-excel-reconcile` (PerryLink)
  - GitHub `dsh-invoice-tools`, `dsh_invoice`, `dsh-tool-invoice`, `dsh-invoice-organizer`
  - GitHub repos named `invoice-gate` without the `dsh-` prefix (unrelated)
  - EthanYoQ/Invoice-Downloader (InvoiceFlowAI)
- Do not vendor or copy source from those projects. Implement our own verification layer. Ideas may be reused at the rule level (价税勾稽, list unexecuted rules, integer fen, invoice numbers as text).

## Product role

- This is a **local verification gate + evidence pack**, not an AI invoice-to-Excel product, not a cloud OCR service, and not enterprise fee-control.
- It sits **on top of existing inputs**: spreadsheets, structured JSON (including user-supplied OCR field JSON), PDF text layers, and electronic-invoice XML.
- **No self-built OCR** and **no RapidOCR / vision model** in this MVP. No enterprise recognition APIs (TextIn, Baidu, Feishu, DingTalk, tax-bureau 验真).

## Inputs (in)

- Local files only, confined to the current project/workspace directory.
- Accepted: CSV, XLSX, structured JSON (documented schema), **text-layer** PDFs, electronic-invoice **XML**.
- Column mapping for tables is explicit (config or a mapping file). There is no first-party WeChat / Alipay bill template in MVP; those exports, if used, are treated as generic CSV/XLSX after the user names the amount / date / id columns.
- **OFD binary**: refuse with a clear message (research: OFD parsing is fragmented; not in MVP).
- **Raster images / scanned PDFs without a text layer** and without an accompanying OCR JSON: refuse with a clear message. Users may bring their own OCR JSON.
- No mailbox collection, no passworded account login, no platform scraping, no auto-download from 票夹 / 发票夹.
- Do not execute Excel macros, external links, or embedded scripts. Read stored cell values only. If a cell has formula text and no cached value, the field is `unchecked` (无法检查) — do not guess or recalculate.
- Invoice / ticket numbers (including 20-digit e-invoice numbers) are **always strings**. Never coerce to a number (Excel and JS both lose trailing digits).
- Every imported file, page, row, skipped row, and failed parse appears in an inventory. Silent drops are a bug.
- Originals are **read-only**. The plugin never writes back into source invoices or source spreadsheets. Record SHA-256 of each original.

## Scope of a run

- Single operator, single ledger / run, **CNY only**.
- Ticket-level fields in MVP: date, invoice/ticket number, buyer, seller, amount (金额), tax (税额), total (价税合计), currency, material type, optional line items.
- Out of MVP (list as “未实现” if a rule would need them; do not pretend a model can fill them in): multi-currency conversion, split / merged payments, first-class 红蓝票 workflows, SKU-level reconstruction of arbitrary tables, multi-person approval, auto payment / booking, tax filing, deductible judgements, tax-bureau live verification, email ingest, full OFD, built-in OCR.

## Amounts and rules

- Amounts use **integer fen** (minor units) for sums and comparisons. Blank is not zero. If currency, sign, or precision is unclear, stop that rule and mark it `unchecked`, not passed.
- Deterministic rules in MVP:
  1. amount + tax = total, when all three are present and comparable
  2. sum of line items = invoice total, when line items are present
  3. duplicate invoice/ticket numbers (report only; never auto-delete)
  4. duplicate file SHA-256
  5. optional buyer-name whitelist (if no whitelist configured, the rule is listed as not executed)
  6. optional date period (same: not executed if no period given)
  7. ledger (CSV/XLSX) vs invoices, matched **primarily by invoice/ticket number**; unmatched rows on either side are flagged; amounts compared when both sides have them
- “Arithmetic passed” only means the executed arithmetic relations hold. It is **not** a claim that the invoice is authentic, paid, or reimbursable. Missing fields never count as a pass.
- Suspected duplicates without a reliable id are reported as 疑似; nothing is deleted or merged automatically.
- Same inputs + same rules version must reproduce the same deterministic result.

## Model boundary (hard)

- **The model must never invent, rewrite, or “fix” amounts, tax, totals, or identifiers.** There is no amount-rewrite tool and no “ask the model to tidy the ledger” path.
- The MVP is fully usable **without any model call**. Slash command + tools + files are enough.
- Tools may start a run, report status, and point at output files. By default they **must not** return full reports, original invoice text, or amount tables into the host model context (research: “插件自身不调用模型” ≠ “结果不会进宿主上下文”). Return counts, ids, and file paths. A documented verbose opt-in may exist for debugging, default off.
- Logs and errors must not include tax IDs, bank numbers, or full transaction dumps. Financial data is not telemetry. Default: no outbound network. No silent cloud OCR fallback.

## Evidence, corrections, export

- Each output field has a source pointer (sheet + cell + original raw value; XML path + raw value; PDF page + excerpt when available) or is explicitly marked “无来源／待核”. Do not invent coordinates.
- Keep **extracted**, **normalized**, and **human-confirmed** values separate. An optional corrections JSON (and/or a tool that appends to it) records before/after, time, and who confirmed. Corrections never overwrite source files or the extracted record.
- Per-item states, kept distinct:
  - field review: pending / confirmed / unreadable
  - rule result: pass / mismatch / unchecked / not-implemented
  - external verification: always `not-checked` in MVP (feature not built)
- A run **cannot** be labelled “全部已核对” if any mismatch remains or key fields (amount, number, date, parties) are still pending. Draft export is allowed and must look like a draft.
- Export a pack: Markdown report + XLSX (identifiers as text) + `export-report.json` (or equivalent JSON). Optional copy of originals using **relative** paths. Failed export must not overwrite a previous good pack (atomic write). Distinguish a pack that includes originals from a summary-only export.
- Red flags use text (and icons if a UI exists), not color alone. Each mismatch shows expected value, actual value, difference, and the rule id.
- Copy / README must not claim: invoice authenticity, payment, policy compliance, or that the pack “satisfies accounting archive requirements”. SHA-256 detects file change; it does not prove a ticket is genuine.

## DSH surface

- Prefixed tools, conceptually `ingest` / `check` / `export` (exact names up to Codex, but keep the three verbs). Confine paths with `ctx.tools.restrict` and `ctx.tools.guard` (restrict needs a scoped `agent.ctx`, not the plugin root `ctx`).
- Slash command `/invoice-gate` (start/help/stop as appropriate). Optional thin `ctx.slots` panel listing run status and mismatches, linking to report files. **No Remote API** in MVP. No click-to-highlight original-page canvas in MVP (that is a later increment; the report’s source pointers are enough).
- No auto-upload, no publish, no approval-system integration.

## Samples and tests

- Only **synthetic, clearly labelled** fixtures (`SAMPLE` / `示例` / `非真实票据`). No real personal, employee, or customer invoices, even “for testing”.
- Include the research’s synthetic example: amount `100.00`, tax `6.00`, extracted total `108.00` → mismatch, difference `2.00`, waiting for confirmation. If the original itself says `108.00`, keep the mismatch; do not “fix” the ticket.
- Also cover: a clean passing set; duplicate numbers; a 20-digit number that must remain a string; missing fields → unchecked; ledger unmatched rows; whitelist / period misses; line-item sum miss; refuse OFD and image-without-JSON; path escape; atomic export.

## Later (not this branch’s required MVP)

- Local OCR (e.g. RapidOCR) behind an explicit offline install.
- OFD, WeChat / Alipay first-party templates, 红蓝票 / split payments, tax-bureau verification (explicit send-list if ever added), richer review UI with click-to-source highlighting.
- Merge to main, npm publish, and directory submission stay blocked until the user says so.
