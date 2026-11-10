# Deterministic reconciliation library (task 3)

`reconcile(ingestResult, options?, corrections?)` is a synchronous, pure local function. It reads no files, calls no model or network service, mutates no arguments and writes nothing. The full result contains financial evidence; future DSH tools must return counts, ids and paths instead of this object. No corrections or amount-rewrite tool is registered.

```js
import { ingest, reconcile } from 'dsh-invoice-gate'
const extracted = await ingest('/absolute/project', [
  { path: 'SAMPLE-tickets.json', kind: 'ticket' },
])
const run = reconcile(extracted, {
  buyerWhitelist: ['SAMPLE 示例买方'],
  period: { start: '2026-11-01', end: '2026-11-30' },
})
// Local processing only; do not send `run` into model context.
```

## Values and rules

Rules version `invoice-gate/1` identifies the behavior below. Same input, options and corrections reproduce byte-identical JSON; no generated timestamps, random ids or locale-dependent comparisons enter the result. Internal arithmetic uses BigInt integer fen. JSON stores fen as signed decimal **strings**, so values beyond JavaScript's safe-integer range remain exact. Display money always has two decimal places. Difference is **actual − expected**.

Money accepts trimmed decimal strings with an optional explicit `+` or `-`, digits and zero to two fractional digits. Blank/null is missing, never zero. Thousands separators, exponent notation, accounting parentheses, ambiguous signs, currency symbols embedded in money and more than two fractional digits are unchecked. No rounding is performed. Only explicit `CNY` (case-insensitive) is comparable. Dates require real calendar days in `YYYY-MM-DD`; names and identifiers are trimmed strings, without numeric conversion or fuzzy matching. Negative values can be compared arithmetically; this does not implement a 红蓝票 workflow.

Outcomes are exactly `pass`, `mismatch`, `unchecked`, `not-implemented`. Each result has `ruleId`, target `recordIds`/`fileIds`, `expected`, `actual`, `difference`, optional `field` and a safe `reason`. Numeric money comparisons also include `expectedFen`, `actualFen`, `differenceFen`. Nonnumeric differences are `null`. Missing/incomparable data is unchecked, with a reason, never passed.

| Rule id | Behavior |
| --- | --- |
| `amount-tax-total` | Ticket amount + tax is expected; ticket total is actual. All three and CNY are required. |
| `line-items-total` | Sum every line's `total` and compare with ticket total. A missing line total stops the rule; it is not reconstructed from net amount. Missing line currency inherits ticket currency; an explicit invalid currency stops the rule. Absent/empty lines are listed as unexecuted. |
| `duplicate-number` | Report duplicate numbers separately within tickets and within ledger rows. A normal ticket/ledger pair is not a duplicate. Missing numbers are unchecked. All records remain. |
| `duplicate-file-hash` | Report every SHA-256 group, including repeated selected originals and sidecars. Missing hashes are unchecked. All files remain. |
| `buyer-whitelist` | Exact ticket buyer membership in an optional list (trimmed names, case-sensitive). An explicit empty list permits nobody. Missing configuration is unexecuted. |
| `date-period` | Ticket date within an optional inclusive ISO date range. Missing configuration is unexecuted. Invalid configuration rejects the call. |
| `ledger-match` | Exact number matches only; unmatched sides are mismatches. Missing numbers and duplicate-number ambiguities are unchecked; no auto-pairing, deletion or merge. No ledger records means unexecuted. |
| `ledger-amount` | For an unambiguous pair, compare invoice net `amount` to ledger net `amount`, and invoice `total` to ledger `total`, separately. If either side supplies a field, missing/incomparable data on the other side is unchecked. Fields missing on both sides are skipped; no comparable fields is unchecked. Invoice is expected; ledger is actual. No net/gross fallback. |

All supported rules appear even if no records apply. `unexecutedRules` lists every unchecked and not-implemented result, including per-record failures to execute. Currency conversion, split/merged payments, 红蓝票 workflows, authenticity, payment verification, reimbursability and archive compliance are explicitly `not-implemented`. `externalVerification` is always `not-checked`.

## Human corrections JSON v1

The third argument accepts a parsed object or JSON text with this strict schema. Read a corrections file through the project's confined file layer when adding a command/tool in a later task; this function does not accept paths. All examples here are **SAMPLE / 示例 / 非真实票据**.

```json
{
  "schemaVersion": 1,
  "entries": [{
    "recordId": "file-1:json:1",
    "field": "total",
    "before": "108.00",
    "after": "106.00",
    "confirmedBy": "SAMPLE local human reviewer",
    "confirmedAt": "2026-11-10T01:00:00Z"
  }]
}
```

Use actual ids from ingest; the id above is illustrative. An optional zero-based `lineItem` selects a line; omit it for ticket/ledger fields. All ingest field names are accepted. Every entry requires string `after`, exact original raw string/null `before`, a nonblank reviewer and a valid UTC timestamp in `YYYY-MM-DDTHH:mm:ssZ`. Numeric identifiers/money, unknown fields/keys/records/lines, malformed timestamps and stale `before` values reject the entire call, without mutating inputs. Multiple entries for a field form an ordered audit history: each `before` must equal the preceding `after`. Confirm an unchanged field by making `before` and `after` identical. Time and reviewer are supplied assertions, not authenticated identities.

Corrections are human review assertions, never model suggestions or automatic arithmetic fixes. If the original says `108.00`, retain the mismatch unless a human checks the original and explicitly supplies a correction. A confirmation can record an unusable value, but it remains unreadable/unchecked and blocks full confirmation. The engine does not invent a valid replacement.

The result keeps these layers separate:

- `extracted`: a copy of the entire original ingest result, including hashes, raw values, source pointers, inventory and synthetic labels. It is never rewritten by corrections.
- `records[].fields` and optional `lineItems`: each field has `normalized` derived from extraction, optional `confirmed` with separately normalized value, raw `after`, reviewer and timestamp, plus `review` (`pending`, `confirmed`, `unreadable`). Rules use confirmed values when present. Original normalization remains intact.
- `corrections`: the supplied before/after audit entries. They are not persisted or assigned timestamps by this function.

Source pointers remain in `extracted` under the same record id, field and line index. A correction does not create an original source coordinate. An originally absent source stays absent (无来源／待核).

## Confirmation gate and later exports

`fullyConfirmed` requires at least one record, no mismatches or required unchecked rules, no unresolved ingest failures/partials/refusals, and human confirmation of key fields. Ticket keys are amount, tax, total, currency, number, date, buyer and seller. Ledger keys are amount, currency, number, date, buyer and seller, plus total if supplied. Supplied lines require confirmed totals and any explicit currency. Optional rules without configuration, absent lines, absent ledger and rules without applicable records do not block confirmation. Deliberate inventory skips for headers, blank rows, explicitly unselected sheets and OCR-sidecar substitution do not count as failures. `pendingKeyFields` lists all remaining required reviews.

A fully confirmed result describes local review within this selected scope. It does not prove authenticity, payment or reimbursability, or accounting-archive compliance. SHA-256 does not prove a ticket is genuine. No status removes these limits or changes `externalVerification`.

Conservative limit: a partial import remains draft even when all accepted fields are later corrected. The inventory records the historical parse problem and this MVP has no unit-level exception confirmation. Correcting fields re-runs their rules but does not certify that no input row/page was lost.

The JSON result is available even while `fullyConfirmed` is false. A later exporter may write a clearly labelled draft. This task implements no Markdown/XLSX pack writer, filesystem corrections writer, DSH check tools or UI.
