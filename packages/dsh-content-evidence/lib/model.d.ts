declare module '@deepseek-ai/dsh-typert-protocol' {
    interface RemoteErrorDetailsMap {
        'content-evidence/invalid-input': {
            readonly field: string;
        };
        'content-evidence/not-found': {
            readonly topicId: string;
        };
        'content-evidence/corrupt-store': null;
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
export interface Review {
    status: 'pending' | 'passed' | 'failed';
    contentHash: string | null;
    findings: string[];
    reviewedAt: string | null;
}
export interface Draft {
    content: string;
    contentHash: string;
    revision: number;
    updatedAt: string;
    status: 'editing' | 'complete';
    review: Review;
}
export interface PublishedLink {
    platform: Platform;
    url: string;
    recordedAt: string;
}
export type ExportFormat = 'markdown' | 'text' | 'citations' | 'materials';
export interface ExportRecord {
    id: string;
    platform: Platform;
    format: ExportFormat;
    status: 'pending';
    createdAt: string;
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
