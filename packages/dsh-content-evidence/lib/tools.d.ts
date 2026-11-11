import type { Context } from '@deepseek-ai/cordis';
import type { Agent } from '@deepseek-ai/dsh-agent';
import type { ContentEvidenceService } from './service.js';
export declare const toolNames: readonly ["content_evidence_capture_material", "content_evidence_read_evidence", "content_evidence_save_draft", "content_evidence_export_draft"];
export declare function registerTools(ctx: Context, service: ContentEvidenceService): void;
/** Enter before running a topic's model turn; retain confinement until the task is quiescent. */
export declare function enterWorkbench(ctx: Context, agent: Pick<Agent, 'ctx' | 'status'>, topicId: string, signal: AbortSignal): Promise<() => void>;
