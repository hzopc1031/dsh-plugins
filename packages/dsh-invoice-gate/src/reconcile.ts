import { fieldNames, type ExtractedField, type ExtractedRecord, type FieldName, type IngestResult } from './ingest.js'

export const rulesVersion = 'invoice-gate/1'
export const reconciliationDisclaimer = 'Arithmetic checks do not prove authenticity, payment or reimbursability. Evidence packs do not establish accounting-archive compliance. SHA-256 does not prove a genuine ticket.'
export type RuleOutcome = 'pass' | 'mismatch' | 'unchecked' | 'not-implemented'
export interface RuleResult {
  ruleId: string
  outcome: RuleOutcome
  recordIds: string[]
  fileIds: string[]
  field?: FieldName
  expected: string | string[] | null
  actual: string | null
  difference: string | null
  expectedFen?: string
  actualFen?: string
  differenceFen?: string
  reason?: string
}
export interface NormalizedValue {
  value: string | null
  fen?: string
  issue?: string
}
export interface ConfirmedValue extends NormalizedValue {
  raw: string
  confirmedBy: string
  confirmedAt: string
}
export interface ReviewedField {
  normalized: NormalizedValue
  confirmed?: ConfirmedValue
  review: 'pending' | 'confirmed' | 'unreadable'
}
export interface NormalizedRecord extends Omit<ExtractedRecord, 'fields' | 'lineItems'> {
  fields: Record<FieldName, ReviewedField>
  lineItems?: Record<FieldName, ReviewedField>[]
}
export interface Correction {
  recordId: string
  field: FieldName
  lineItem?: number
  before: string | null
  after: string
  confirmedBy: string
  confirmedAt: string
}
export interface Corrections {
  schemaVersion: 1
  entries: Correction[]
}
export interface ReconcileOptions {
  buyerWhitelist?: string[]
  period?: { start: string; end: string }
}
export interface PendingField {
  recordId: string
  field: FieldName
  lineItem?: number
  review: 'pending' | 'unreadable'
}
export interface ReconciliationResult {
  rulesVersion: string
  disclaimer: string
  extracted: IngestResult
  records: NormalizedRecord[]
  corrections: Corrections
  options: ReconcileOptions
  results: RuleResult[]
  unexecutedRules: RuleResult[]
  pendingKeyFields: PendingField[]
  fullyConfirmed: boolean
  externalVerification: 'not-checked'
}

const moneyFields = new Set<FieldName>(['amount', 'tax', 'total'])
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const exactKeys = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).every(key => keys.includes(key))
function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false
  const date = new Date(value + 'T00:00:00Z')
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function decimal(fen: bigint): string {
  const absolute = fen < 0n ? -fen : fen
  return `${fen < 0n ? '-' : ''}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`
}

function normalize(raw: string | null, name: FieldName, issue?: string): NormalizedValue {
  if (issue) return { value: null, issue }
  const value = raw?.trim()
  if (!value) return { value: null, issue: 'missing-value' }
  if (moneyFields.has(name)) {
    const parts = /^([+-]?)(\d+)(?:\.(\d{1,2}))?$/.exec(value)
    if (!parts) return { value: null, issue: 'unclear-money-sign-or-precision' }
    const fen = (BigInt(parts[2]!) * 100n + BigInt((parts[3] ?? '').padEnd(2, '0'))) * (parts[1] === '-' ? -1n : 1n)
    return { value: decimal(fen), fen: String(fen) }
  }
  if (name === 'date' && !validDate(value)) return { value: null, issue: 'invalid-iso-date' }
  if (name === 'currency') return value.toUpperCase() === 'CNY' ? { value: 'CNY' } : { value: null, issue: 'unsupported-or-unclear-currency' }
  return { value }
}

function normalizeFields(fields: Record<FieldName, ExtractedField>): Record<FieldName, ReviewedField> {
  return Object.fromEntries(fieldNames.map(name => {
    const field = fields[name]
    const normalized = normalize(field.raw, name, field.issue ?? (field.review === 'unreadable' ? 'unreadable-value' : undefined))
    return [name, { normalized, review: normalized.issue ? 'unreadable' : 'pending' }]
  })) as Record<FieldName, ReviewedField>
}
const effective = (field: ReviewedField): NormalizedValue => field.confirmed ?? field.normalized

function validateOptions(value: ReconcileOptions): void {
  if (!object(value) || !exactKeys(value, ['buyerWhitelist', 'period'])) throw new Error('invalid-reconcile-options')
  if (value.buyerWhitelist !== undefined && (!Array.isArray(value.buyerWhitelist) || value.buyerWhitelist.some(name => typeof name !== 'string' || !name.trim()))) throw new Error('invalid-buyer-whitelist')
  const period = value.period
  if (period !== undefined && (!object(period) || !exactKeys(period, ['start', 'end']) || !validDate(period.start) || !validDate(period.end) || period.start > period.end)) throw new Error('invalid-date-period')
}

function validateInput(input: IngestResult): void {
  if (!object(input) || !Array.isArray(input.records) || !Array.isArray(input.files) || !Array.isArray(input.inventory)) throw new Error('invalid-ingest-result')
  const files = new Set<string>(), records = new Set<string>()
  for (const file of input.files) {
    if (!object(file) || typeof file.id !== 'string' || !file.id || files.has(file.id) || (file.sha256 !== null && (typeof file.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(file.sha256)))) throw new Error('invalid-ingest-files')
    files.add(file.id)
  }
  for (const record of input.records) {
    if (!object(record) || typeof record.id !== 'string' || !record.id || records.has(record.id) || !files.has(record.fileId) || !['ticket', 'ledger'].includes(record.kind)) throw new Error('invalid-ingest-record')
    records.add(record.id)
    if (record.lineItems !== undefined && !Array.isArray(record.lineItems)) throw new Error('invalid-ingest-lines')
    for (const fields of [record.fields, ...(record.lineItems ?? [])]) {
      if (!object(fields) || fieldNames.some(name => {
        const field = fields[name]
        return !object(field) || (field.raw !== null && typeof field.raw !== 'string') || !['pending', 'unreadable'].includes(field.review) || (field.issue !== undefined && typeof field.issue !== 'string')
      })) throw new Error('invalid-ingest-fields')
    }
  }
}

function applyCorrections(value: unknown, records: NormalizedRecord[], extracted: IngestResult): Corrections {
  if (value === undefined) return { schemaVersion: 1, entries: [] }
  if (typeof value === 'string') {
    try { value = JSON.parse(value) } catch { throw new Error('invalid-corrections-json') }
  }
  if (!object(value) || !exactKeys(value, ['schemaVersion', 'entries']) || value.schemaVersion !== 1 || !Array.isArray(value.entries)) throw new Error('invalid-corrections-schema')
  const byId = new Map(records.map((record, index) => [record.id, { record, original: extracted.records[index]! }]))
  const entries: Correction[] = []
  for (const entry of value.entries) {
    if (!object(entry) || !exactKeys(entry, ['recordId', 'field', 'lineItem', 'before', 'after', 'confirmedBy', 'confirmedAt'])
      || typeof entry.recordId !== 'string' || !fieldNames.includes(entry.field as FieldName)
      || (entry.before !== null && typeof entry.before !== 'string') || typeof entry.after !== 'string'
      || typeof entry.confirmedBy !== 'string' || !entry.confirmedBy.trim()
      || typeof entry.confirmedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(entry.confirmedAt)
      || !validDate(entry.confirmedAt.slice(0, 10)) || !Number.isFinite(Date.parse(entry.confirmedAt))
      || new Date(entry.confirmedAt).toISOString().replace('.000Z', 'Z') !== entry.confirmedAt) throw new Error('invalid-correction-entry')
    const target = byId.get(entry.recordId)
    if (!target) throw new Error('unknown-correction-record')
    const name = entry.field as FieldName
    const line = entry.lineItem
    if (line !== undefined && (!Number.isSafeInteger(line) || (line as number) < 0 || (line as number) >= (target.record.lineItems?.length ?? 0))) throw new Error('unknown-correction-line')
    const field = line === undefined ? target.record.fields[name] : target.record.lineItems![line as number]![name]
    const original = line === undefined ? target.original.fields[name] : target.original.lineItems![line as number]![name]
    if (entry.before !== (field.confirmed?.raw ?? original.raw)) throw new Error('stale-correction-before-value')
    const normalized = normalize(entry.after, name)
    field.confirmed = { ...normalized, raw: entry.after, confirmedBy: entry.confirmedBy, confirmedAt: entry.confirmedAt }
    field.review = normalized.issue ? 'unreadable' : 'confirmed'
    entries.push(structuredClone(entry) as unknown as Correction)
  }
  return { schemaVersion: 1, entries }
}

/** Pure local evidence result, not a model-facing tool response. Corrections must come from human review. */
export function reconcile(input: IngestResult, options: ReconcileOptions = {}, corrections?: unknown): ReconciliationResult {
  validateInput(input)
  validateOptions(options)
  const extracted = structuredClone(input)
  const records: NormalizedRecord[] = extracted.records.map(({ fields, lineItems, ...record }) => ({ ...record, fields: normalizeFields(fields), ...(lineItems === undefined ? {} : { lineItems: lineItems.map(normalizeFields) }) }))
  const audit = applyCorrections(corrections, records, extracted)
  const results: RuleResult[] = []
  function add(ruleId: string, outcome: RuleOutcome, ids: string[] = [], detail: Partial<RuleResult> = {}): void {
    results.push({ ruleId, outcome, recordIds: ids, fileIds: [], expected: null, actual: null, difference: null, ...detail })
  }
  function compare(ruleId: string, ids: string[], expected: bigint, actual: bigint, field: FieldName): void {
    add(ruleId, expected === actual ? 'pass' : 'mismatch', ids, { field, expected: decimal(expected), actual: decimal(actual), difference: decimal(actual - expected), expectedFen: String(expected), actualFen: String(actual), differenceFen: String(actual - expected) })
  }
  function currency(fields: Record<FieldName, ReviewedField>, parent?: NormalizedRecord): boolean {
    const own = effective(fields.currency)
    return (own.issue === 'missing-value' && parent ? effective(parent.fields.currency).value : own.value) === 'CNY'
  }
  function money(record: NormalizedRecord, names: FieldName[]): bigint[] | null {
    if (!currency(record.fields)) return null
    const values = names.map(name => effective(record.fields[name]).fen)
    return values.every(value => value !== undefined) ? values.map(value => BigInt(value!)) : null
  }
  const tickets = records.filter(record => record.kind === 'ticket')
  const ledger = records.filter(record => record.kind === 'ledger')
  for (const record of tickets) {
    const ids = [record.id]
    const amounts = money(record, ['amount', 'tax', 'total'])
    if (amounts) compare('amount-tax-total', ids, amounts[0]! + amounts[1]!, amounts[2]!, 'total')
    else add('amount-tax-total', 'unchecked', ids, { reason: 'missing-or-incomparable-money-or-currency' })
    const lines = record.lineItems
    if (!lines?.length) add('line-items-total', 'unchecked', ids, { reason: 'no-line-items' })
    else {
      const total = money(record, ['total'])
      const lineValues = lines.map(fields => currency(fields, record) ? effective(fields.total).fen : undefined)
      if (!total || lineValues.some(value => value === undefined)) add('line-items-total', 'unchecked', ids, { reason: 'missing-or-incomparable-line-total-or-currency' })
      else compare('line-items-total', ids, lineValues.reduce((sum, value) => sum + BigInt(value!), 0n), total[0]!, 'total')
    }
  }
  for (const kind of ['ticket', 'ledger'] as const) {
    const groups = new Map<string, string[]>()
    for (const record of records.filter(record => record.kind === kind)) {
      const number = effective(record.fields.number).value
      if (number === null) add('duplicate-number', 'unchecked', [record.id], { field: 'number', reason: 'missing-or-unreadable-number' })
      else groups.set(number, [...(groups.get(number) ?? []), record.id])
    }
    for (const [number, ids] of groups) add('duplicate-number', ids.length > 1 ? 'mismatch' : 'pass', ids, { field: 'number', expected: `unique-${kind}-number`, actual: number })
  }
  const hashes = new Map<string, string[]>()
  for (const file of extracted.files) {
    if (file.sha256 === null) add('duplicate-file-hash', 'unchecked', [], { fileIds: [file.id], reason: 'missing-file-hash' })
    else hashes.set(file.sha256, [...(hashes.get(file.sha256) ?? []), file.id])
  }
  for (const [hash, ids] of hashes) add('duplicate-file-hash', ids.length > 1 ? 'mismatch' : 'pass', [], { fileIds: ids, expected: 'unique-file-sha256', actual: hash })
  for (const ruleId of ['buyer-whitelist', 'date-period']) {
    if ((ruleId === 'buyer-whitelist' ? options.buyerWhitelist : options.period) === undefined) {
      add(ruleId, 'unchecked', [], { reason: 'not-configured' }); continue
    }
    for (const record of tickets) {
      if (ruleId === 'buyer-whitelist') {
        const buyer = effective(record.fields.buyer).value
        const expected = options.buyerWhitelist!.map(name => name.trim())
        add(ruleId, buyer === null ? 'unchecked' : expected.includes(buyer) ? 'pass' : 'mismatch', [record.id], { field: 'buyer', expected, actual: buyer, ...(buyer === null ? { reason: 'missing-or-unreadable-buyer' } : {}) })
      } else {
        const date = effective(record.fields.date).value, period = options.period!
        add(ruleId, date === null ? 'unchecked' : date >= period.start && date <= period.end ? 'pass' : 'mismatch', [record.id], { field: 'date', expected: `${period.start}..${period.end}`, actual: date, ...(date === null ? { reason: 'missing-or-invalid-date' } : {}) })
      }
    }
  }
  if (!ledger.length) add('ledger-match', 'unchecked', [], { reason: 'no-ledger-records' })
  else {
    const byNumber = (rows: NormalizedRecord[]) => {
      const map = new Map<string, NormalizedRecord[]>()
      for (const record of rows) {
        const number = effective(record.fields.number).value
        if (number !== null) map.set(number, [...(map.get(number) ?? []), record])
      }
      return map
    }
    const ticketNumbers = byNumber(tickets), ledgerNumbers = byNumber(ledger)
    for (const record of records) {
      const number = effective(record.fields.number).value
      const own = record.kind === 'ticket' ? ticketNumbers : ledgerNumbers
      const other = record.kind === 'ticket' ? ledgerNumbers : ticketNumbers
      const matches = number === null ? [] : other.get(number) ?? []
      if (number === null) add('ledger-match', 'unchecked', [record.id], { reason: 'missing-or-unreadable-number' })
      else if (!matches.length) add('ledger-match', 'mismatch', [record.id], { field: 'number', expected: `matching-${record.kind === 'ticket' ? 'ledger' : 'ticket'}-number`, actual: number, reason: 'unmatched-' + record.kind })
      else if (matches.length !== 1 || own.get(number)!.length !== 1) add('ledger-match', 'unchecked', [record.id, ...matches.map(match => match.id)], { reason: 'ambiguous-duplicate-number' })
      else if (record.kind === 'ticket') {
        const match = matches[0]!, ids = [record.id, match.id]
        add('ledger-match', 'pass', ids, { field: 'number', expected: number, actual: number })
        let compared = false
        for (const field of ['amount', 'total'] as const) {
          if (effective(record.fields[field]).issue === 'missing-value' && effective(match.fields[field]).issue === 'missing-value') continue
          compared = true
          const left = money(record, [field]), right = money(match, [field])
          if (left && right) compare('ledger-amount', ids, left[0]!, right[0]!, field)
          else add('ledger-amount', 'unchecked', ids, { field, reason: 'missing-or-incomparable-money-or-currency' })
        }
        if (!compared) add('ledger-amount', 'unchecked', ids, { reason: 'no-comparable-amount-fields' })
      }
    }
  }
  for (const ruleId of ['amount-tax-total', 'line-items-total', 'duplicate-number', 'duplicate-file-hash', 'buyer-whitelist', 'date-period', 'ledger-match', 'ledger-amount']) {
    if (!results.some(result => result.ruleId === ruleId)) add(ruleId, 'unchecked', [], { reason: 'no-applicable-records' })
  }
  for (const ruleId of ['currency-conversion', 'split-merged-payments', 'red-blue-workflow', 'authenticity', 'payment-verification', 'reimbursability', 'archive-compliance']) add(ruleId, 'not-implemented', [], { reason: 'outside-mvp' })
  const pendingKeyFields: PendingField[] = []
  for (const record of records) {
    const keys: FieldName[] = ['amount', 'number', 'date', 'buyer', 'seller', 'currency']
    if (record.kind === 'ticket') keys.push('tax', 'total')
    else if (effective(record.fields.total).issue !== 'missing-value') keys.push('total')
    function pending(fields: Record<FieldName, ReviewedField>, names: FieldName[], lineItem?: number): void {
      for (const field of names) if (fields[field].review !== 'confirmed') pendingKeyFields.push({ recordId: record.id, field, ...(lineItem === undefined ? {} : { lineItem }), review: fields[field].review as 'pending' | 'unreadable' })
    }
    pending(record.fields, keys)
    record.lineItems?.forEach((fields, index) => pending(fields, effective(fields.currency).issue === 'missing-value' ? ['total'] : ['total', 'currency'], index))
  }
  const allowedSkips = new Set(['not-configured', 'no-line-items', 'no-ledger-records', 'no-applicable-records'])
  // shortcut: partial imports stay draft even after field corrections; refine when unit-level exception review exists.
  const unresolvedInventory = extracted.files.some(file => file.status !== 'parsed') || extracted.inventory.some(entry => !['parsed', 'skipped'].includes(entry.status) || (entry.status === 'skipped' && !['header', 'blank-row', 'explicit-ocr-sidecar', 'sheet-not-selected'].includes(entry.reason ?? '')))
  const fullyConfirmed = records.length > 0 && !unresolvedInventory && !pendingKeyFields.length && results.every(result => result.outcome === 'pass' || result.outcome === 'not-implemented' || (result.outcome === 'unchecked' && allowedSkips.has(result.reason ?? '')))
  return { rulesVersion, disclaimer: reconciliationDisclaimer, extracted, records, corrections: audit, options: structuredClone(options), results, unexecutedRules: results.filter(result => result.outcome === 'unchecked' || result.outcome === 'not-implemented'), pendingKeyFields, fullyConfirmed, externalVerification: 'not-checked' }
}
