import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { EvidenceStore } from './store.js'
import type {
  Topic, Source, Material, MaterialInput, Experiment, ExperimentInput,
  Claim, Draft, DraftInput, EvidenceSheet, Platform, PublishedLink, ExportRecord, ExportFormat,
} from './model.js'

declare module '@deepseek-ai/cordis' {
  interface Context { contentEvidence: ContentEvidenceService }
}

export class ContentEvidenceService extends TypertRemoteService {
  private readonly store: EvidenceStore
  constructor(ctx: Context, dataDir?: string, extraSensitiveTerms?: string[]) {
    super(ctx, 'contentEvidence')
    this.store = new EvidenceStore(dataDir, extraSensitiveTerms)
  }
  @Remote
  async listTopics(signal: AbortSignal): Promise<Topic[]> {
    return this.store.listTopics(signal)
  }
  @Remote
  async createTopic(idea: string, signal: AbortSignal): Promise<Topic> {
    return this.store.createTopic(idea, signal)
  }
  @Remote
  async readEvidence(topicId: string, signal: AbortSignal): Promise<EvidenceSheet> {
    return this.store.readEvidence(topicId, signal)
  }
  @Remote
  async addSource(topicId: string, sourceUrl: string, title: string, signal: AbortSignal): Promise<Source> {
    return this.store.addSource(topicId, sourceUrl, title, signal)
  }
  @Remote
  async captureMaterial(topicId: string, input: MaterialInput, signal: AbortSignal): Promise<Material> {
    return this.store.captureMaterial(topicId, input, signal)
  }
  @Remote
  async readMaterial(topicId: string, materialId: string, signal: AbortSignal): Promise<MaterialInput> {
    return this.store.readMaterial(topicId, materialId, signal)
  }
  @Remote
  async logExperiment(topicId: string, input: ExperimentInput, signal: AbortSignal): Promise<Experiment> {
    return this.store.logExperiment(topicId, input, signal)
  }
  @Remote
  async saveClaim(topicId: string, claimText: string, sourceId: string | null, signal: AbortSignal): Promise<Claim> {
    return this.store.saveClaim(topicId, claimText, sourceId, signal)
  }
  @Remote
  async saveDraft(topicId: string, target: Platform, input: DraftInput, signal: AbortSignal): Promise<Draft> {
    return this.store.saveDraft(topicId, target, input, signal)
  }
  @Remote
  async reviewDraft(topicId: string, target: Platform, expectedRevision: number, signal: AbortSignal): Promise<Draft> {
    return this.store.reviewDraft(topicId, target, expectedRevision, signal)
  }
  @Remote
  async backfillPublishedLink(topicId: string, target: Platform, publishedUrl: string, signal: AbortSignal): Promise<PublishedLink> {
    return this.store.backfillPublishedLink(topicId, target, publishedUrl, signal)
  }
  @Remote
  async requestExport(topicId: string, target: Platform, format: ExportFormat, signal: AbortSignal): Promise<ExportRecord> {
    return this.store.requestExport(topicId, target, format, signal)
  }
}
