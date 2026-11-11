export declare const fieldNames: readonly ["date", "number", "buyer", "seller", "amount", "tax", "total", "currency", "materialType"];
export type FieldName = typeof fieldNames[number];
export type ColumnMapping = Partial<Record<FieldName, string>>;
export interface InputFile {
    path: string;
    kind: 'ticket' | 'ledger';
    mapping?: ColumnMapping;
    sheet?: string;
    ocrJson?: string;
}
export interface Source {
    file: string;
    raw: string | null;
    sheet?: string;
    cell?: string;
    row?: number;
    page?: number;
    box?: [number, number, number, number];
    path?: string;
    excerpt?: string;
    formula?: string;
}
export interface ExtractedField {
    raw: string | null;
    source: Source | null;
    review: 'pending' | 'unreadable';
    issue?: string;
}
export interface ExtractedRecord {
    id: string;
    fileId: string;
    originalFileId?: string;
    kind: 'ticket' | 'ledger';
    label?: string;
    fields: Record<FieldName, ExtractedField>;
    lineItems?: Record<FieldName, ExtractedField>[];
}
type Status = 'parsed' | 'partial' | 'skipped' | 'refused' | 'failed';
export interface InventoryEntry {
    fileId: string;
    unit: 'file' | 'sheet' | 'page' | 'row';
    status: Status;
    reason?: string;
    encoding?: 'utf-8' | 'gb18030';
    sheet?: string;
    row?: number;
    page?: number;
}
export interface OriginalFile {
    id: string;
    path: string;
    sha256: string | null;
    status: Status;
    reason?: string;
    originalFileId?: string;
}
export interface IngestResult {
    files: OriginalFile[];
    inventory: InventoryEntry[];
    records: ExtractedRecord[];
}
export declare function readOriginal(root: string, path: string): Promise<Buffer>;
/** Local library result contains raw evidence; never return it directly to the host model. */
export declare function ingest(projectDir: string, inputs: readonly InputFile[]): Promise<IngestResult>;
export {};
