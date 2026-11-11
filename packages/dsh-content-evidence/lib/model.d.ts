declare module '@deepseek-ai/dsh-typert-protocol' {
    interface RemoteErrorDetailsMap {
        'content-evidence/export-unsupported': null;
        'content-evidence/invalid-input': {
            readonly field: string;
        };
        'content-evidence/not-found': {
            readonly topicId: string;
        };
        'content-evidence/corrupt-store': null;
        'content-evidence/conflict': {
            readonly revision: number;
            readonly evidenceHash: string;
        };
    }
}
export declare const platforms: readonly ["x", "xiaohongshu", "douyin", "weixin-video"];
export type Platform = typeof platforms[number];
export interface Source {
    id: string;
    url: string;
    title: string;
    createdAt: string;
}
export interface Material {
    id: string;
    name: string;
    mediaType: string;
    path: string;
    bytes: number;
    sha256: string;
    sourceId: string | null;
    createdAt: string;
}
export interface Experiment {
    id: string;
    command: string;
    output: string;
    versions: string;
    conditions: string;
    createdAt: string;
}
export interface Claim {
    id: string;
    text: string;
    sourceId: string | null;
    status: '有来源' | '待核实';
    createdAt: string;
}
export type DraftBody = {
    kind: 'x-single';
    post: string;
} | {
    kind: 'x-thread';
    posts: string[];
} | {
    kind: 'xiaohongshu';
    title: string;
    body: string;
    cards: string[];
} | {
    kind: 'douyin';
    voiceover: string;
    shots: string[];
} | {
    kind: 'weixin-video';
    voiceover: string;
    shots: string[];
};
export interface DraftInput {
    body: DraftBody;
    claimIds: string[];
    expectedRevision: number;
    evidenceHash: string;
}
export interface ComplianceFinding {
    code: 'ai-label' | 'sensitive' | 'absolute' | 'citation' | 'evidence-changed' | 'legacy-shape';
    location: string;
    excerpt: string;
    fix: string;
}
export interface Review {
    status: 'pending' | 'passed' | 'failed';
    contentHash: string | null;
    findings: (string | ComplianceFinding)[];
    reviewedAt: string | null;
    rulesHash?: string;
}
export interface Draft {
    content: string;
    contentHash: string;
    revision: number;
    updatedAt: string;
    status: 'editing' | 'complete';
    review: Review;
    body?: DraftBody;
    claimIds?: string[];
    evidenceHash?: string;
}
export interface PublishedLink {
    platform: Platform;
    url: string;
    recordedAt: string;
}
export declare const exportFormats: readonly ["markdown", "text", "citations", "materials", "all"];
export type ExportFormat = typeof exportFormats[number];
export interface ExportRecord {
    id: string;
    platform: Platform;
    format: ExportFormat;
    status: 'pending' | 'complete';
    createdAt: string;
    contentHash?: string;
    reviewPassed?: boolean;
    directory?: string;
    files?: string[];
}
export interface Topic {
    id: string;
    idea: string;
    createdAt: string;
    updatedAt: string;
    sources: Source[];
    materials: Material[];
    experiments: Experiment[];
    claims: Claim[];
    drafts: Record<Platform, Draft | null>;
    publishedLinks: PublishedLink[];
    exports: ExportRecord[];
}
export interface Workspace {
    schemaVersion: 1;
    topics: Topic[];
}
export interface MaterialInput {
    name: string;
    mediaType: string;
    base64: string;
    sourceId: string | null;
}
export interface ExperimentInput {
    command: string;
    output: string;
    versions: string;
    conditions: string;
}
export interface EvidenceSheet extends Topic {
    evidenceHash: string;
}
