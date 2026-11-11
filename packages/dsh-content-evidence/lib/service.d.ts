import type { Context } from '@deepseek-ai/cordis';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type { Topic, Source, Material, MaterialInput, Experiment, ExperimentInput, Claim, Draft, DraftInput, EvidenceSheet, Platform, PublishedLink, ExportRecord, ExportFormat } from './model.js';
declare module '@deepseek-ai/cordis' {
    interface Context {
        contentEvidence: ContentEvidenceService;
    }
}
export declare class ContentEvidenceService extends TypertRemoteService {
    private readonly store;
    constructor(ctx: Context, dataDir?: string, extraSensitiveTerms?: string[]);
    listTopics(signal: AbortSignal): Promise<Topic[]>;
    createTopic(idea: string, signal: AbortSignal): Promise<Topic>;
    readEvidence(topicId: string, signal: AbortSignal): Promise<EvidenceSheet>;
    addSource(topicId: string, sourceUrl: string, title: string, signal: AbortSignal): Promise<Source>;
    captureMaterial(topicId: string, input: MaterialInput, signal: AbortSignal): Promise<Material>;
    readMaterial(topicId: string, materialId: string, signal: AbortSignal): Promise<MaterialInput>;
    logExperiment(topicId: string, input: ExperimentInput, signal: AbortSignal): Promise<Experiment>;
    saveClaim(topicId: string, claimText: string, sourceId: string | null, signal: AbortSignal): Promise<Claim>;
    saveDraft(topicId: string, target: Platform, input: DraftInput, signal: AbortSignal): Promise<Draft>;
    reviewDraft(topicId: string, target: Platform, expectedRevision: number, signal: AbortSignal): Promise<Draft>;
    backfillPublishedLink(topicId: string, target: Platform, publishedUrl: string, signal: AbortSignal): Promise<PublishedLink>;
    requestExport(topicId: string, target: Platform, format: ExportFormat, directory: string, signal: AbortSignal): Promise<ExportRecord>;
}
