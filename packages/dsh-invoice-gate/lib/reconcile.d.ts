import { type ExtractedRecord, type FieldName, type IngestResult } from './ingest.js';
export declare const rulesVersion = "invoice-gate/1";
export declare const reconciliationDisclaimer = "Arithmetic checks do not prove authenticity, payment or reimbursability. Evidence packs do not establish accounting-archive compliance. SHA-256 does not prove a genuine ticket.";
export type RuleOutcome = 'pass' | 'mismatch' | 'unchecked' | 'not-implemented';
export interface RuleResult {
    ruleId: string;
    outcome: RuleOutcome;
    recordIds: string[];
    fileIds: string[];
    field?: FieldName;
    expected: string | string[] | null;
    actual: string | null;
    difference: string | null;
    expectedFen?: string;
    actualFen?: string;
    differenceFen?: string;
    reason?: string;
}
export interface NormalizedValue {
    value: string | null;
    fen?: string;
    issue?: string;
}
export interface ConfirmedValue extends NormalizedValue {
    raw: string;
    confirmedBy: string;
    confirmedAt: string;
}
export interface ReviewedField {
    normalized: NormalizedValue;
    confirmed?: ConfirmedValue;
    review: 'pending' | 'confirmed' | 'unreadable';
}
export interface NormalizedRecord extends Omit<ExtractedRecord, 'fields' | 'lineItems'> {
    fields: Record<FieldName, ReviewedField>;
    lineItems?: Record<FieldName, ReviewedField>[];
}
export interface Correction {
    recordId: string;
    field: FieldName;
    lineItem?: number;
    before: string | null;
    after: string;
    confirmedBy: string;
    confirmedAt: string;
}
export interface Corrections {
    schemaVersion: 1;
    entries: Correction[];
}
export interface ReconcileOptions {
    buyerWhitelist?: string[];
    period?: {
        start: string;
        end: string;
    };
}
export interface PendingField {
    recordId: string;
    field: FieldName;
    lineItem?: number;
    review: 'pending' | 'unreadable';
}
export interface ReconciliationResult {
    rulesVersion: string;
    disclaimer: string;
    extracted: IngestResult;
    records: NormalizedRecord[];
    corrections: Corrections;
    options: ReconcileOptions;
    results: RuleResult[];
    unexecutedRules: RuleResult[];
    pendingKeyFields: PendingField[];
    fullyConfirmed: boolean;
    externalVerification: 'not-checked';
}
/** Pure local evidence result, not a model-facing tool response. Corrections must come from human review. */
export declare function reconcile(input: IngestResult, options?: ReconcileOptions, corrections?: unknown): ReconciliationResult;
