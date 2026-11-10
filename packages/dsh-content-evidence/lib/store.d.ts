import { type Topic, type Source, type Material, type MaterialInput, type Experiment, type ExperimentInput, type Claim, type Draft, type Platform, type PublishedLink, type ExportRecord, type ExportFormat, type DraftInput, type EvidenceSheet } from './model.js';
export declare class EvidenceStore {
    readonly dataDir: string;
    private readonly extraSensitiveTerms;
    constructor(dataDir?: string, extraSensitiveTerms?: string[]);
    private root;
    private materials;
    private load;
    private invalidateReviews;
    private mutate;
    private topic;
    private update;
    listTopics(signal?: AbortSignal): Promise<Topic[]>;
    createTopic(idea: string, signal?: AbortSignal): Promise<Topic>;
    readEvidence(topicId: string, signal?: AbortSignal): Promise<EvidenceSheet>;
    addSource(topicId: string, sourceUrl: string, title: string, signal?: AbortSignal): Promise<Source>;
    captureMaterial(topicId: string, input: MaterialInput, signal?: AbortSignal): Promise<Material>;
    readMaterial(topicId: string, materialId: string, signal?: AbortSignal): Promise<MaterialInput>;
    private materialBytes;
    logExperiment(topicId: string, input: ExperimentInput, signal?: AbortSignal): Promise<Experiment>;
    saveClaim(topicId: string, claimText: string, sourceId: string | null, signal?: AbortSignal): Promise<Claim>;
    saveDraft(topicId: string, target: Platform, value: DraftInput, signal?: AbortSignal): Promise<Draft>;
    private compare;
    reviewDraft(topicId: string, target: Platform, expectedRevision: number, signal?: AbortSignal): Promise<Draft>;
    backfillPublishedLink(topicId: string, target: Platform, publishedUrl: string, signal?: AbortSignal): Promise<PublishedLink>;
    requestExport(topicId: string, target: Platform, format: ExportFormat, directory: string, signal?: AbortSignal): Promise<ExportRecord>;
}
