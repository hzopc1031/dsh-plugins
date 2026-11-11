import { createHash } from 'node:crypto'
import { isAbsolute } from 'node:path'
import { RemoteError } from '@deepseek-ai/dsh-typert-protocol'
import { draftHash, parseBody, selectedClaims, stringList } from './drafts.js'
import { exportFormats, platforms, type Platform, type Workspace, type Draft, type Topic } from './model.js'


export function invalid(field: string): never {
  throw new RemoteError('content-evidence/invalid-input', `Invalid ${field}`, { field })
}
export function text(value: unknown, field: string, max = 100_000, empty = false): string {
  if (typeof value !== 'string' || value.length > max || (!empty && !value.trim()) || value.includes('\0')) invalid(field)
  return value
}
export function id(value: unknown): string {
  const result = text(value, 'id', 36)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(result)) invalid('id')
  return result
}
export function url(value: unknown): string {
  const result = text(value, 'url', 8192)
  let parsed: URL
  try { parsed = new URL(result) } catch { return invalid('url') }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) invalid('url')
  return result
}
export function platform(value: unknown): Platform {
  if (!platforms.includes(value as Platform)) invalid('platform')
  return value as Platform
}
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid('record')
  return value as Record<string, unknown>
}
export function hash(value: string | Uint8Array): string { return createHash('sha256').update(value).digest('hex') }
export function fileName(value: unknown): string {
  const result = text(value, 'name', 255)
  if (result === '.' || result === '..' || /[\\/\x00-\x1f]/.test(result)) invalid('name')
  return result
}
function array(value: unknown): unknown[] { if (!Array.isArray(value)) invalid('array'); return value }
function date(value: unknown): void {
  const result = text(value, 'date', 30)
  if (!Number.isFinite(Date.parse(result))) invalid('date')
}
function integer(value: unknown, min: number): void {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min) invalid('integer')
}
function nullableId(value: unknown): void { if (value !== null) id(value) }
function digest(value: unknown): void {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) invalid('sha256')
}

export function parseWorkspace(value: unknown): Workspace {
  try {
    const workspace = record(value)
    if (workspace.schemaVersion !== 1) invalid('schemaVersion')
    const topicIds = new Set<string>()
    for (const raw of array(workspace.topics)) {
      const topic = record(raw), topicId = id(topic.id)
      if (topicIds.has(topicId)) invalid('duplicate topic')
      topicIds.add(topicId)
      text(topic.idea, 'idea', 2000); date(topic.createdAt); date(topic.updatedAt)
      const references = new Set<string>()
      for (const rawSource of array(topic.sources)) {
        const source = record(rawSource), sourceId = id(source.id)
        if (references.has(sourceId)) invalid('duplicate source')
        references.add(sourceId)
        url(source.url); text(source.title, 'title', 2000, true); date(source.createdAt)
      }
      for (const rawMaterial of array(topic.materials)) {
        const material = record(rawMaterial)
        const materialId = id(material.id)
        fileName(material.name); text(material.mediaType, 'mediaType', 255)
        if (material.path !== `materials/${materialId}`) invalid('material.path')
        integer(material.bytes, 0); digest(material.sha256); date(material.createdAt)
        nullableId(material.sourceId)
        if (material.sourceId !== null && !references.has(material.sourceId as string)) invalid('sourceId')
        references.add(materialId)
      }
      for (const rawExperiment of array(topic.experiments)) {
        const experiment = record(rawExperiment), experimentId = id(experiment.id)
        text(experiment.command, 'command', 100_000, true); text(experiment.output, 'output', 1_000_000, true)
        text(experiment.versions, 'versions', 100_000, true); text(experiment.conditions, 'conditions', 100_000, true)
        date(experiment.createdAt); references.add(experimentId)
      }
      for (const rawClaim of array(topic.claims)) {
        const claim = record(rawClaim)
        id(claim.id); text(claim.text, 'claim'); date(claim.createdAt); nullableId(claim.sourceId)
        if (claim.sourceId !== null && !references.has(claim.sourceId as string)) invalid('sourceId')
        if (claim.status !== (claim.sourceId === null ? '待核实' : '有来源')) invalid('claim.status')
      }
      const drafts = record(topic.drafts)
      for (const key of platforms) {
        if (drafts[key] === null) continue
        const draft = record(drafts[key]), review = record(draft.review)
        text(draft.content, 'content', 200_000, true)
        if (draft.body !== undefined) {
          parseBody(draft.body, key)
          const claimIds = stringList(draft.claimIds, 'claimIds')
          claimIds.forEach(id)
          if (new Set(claimIds).size !== claimIds.length) invalid('claimIds')
          selectedClaims(topic as unknown as Topic, claimIds)
          digest(draft.evidenceHash)
        } else if (draft.claimIds !== undefined || draft.evidenceHash !== undefined) invalid('draft metadata')
        if (draft.contentHash !== draftHash(draft as unknown as Draft)) invalid('contentHash')
        integer(draft.revision, 1); date(draft.updatedAt)
        if (!['editing', 'complete'].includes(draft.status as string)) invalid('draft.status')
        if (!['pending', 'passed', 'failed'].includes(review.status as string)) invalid('review.status')
        if (review.contentHash !== null) digest(review.contentHash)
        if (review.status === 'passed' && review.contentHash !== draft.contentHash) invalid('review.contentHash')
        array(review.findings).forEach(item => {
          if (typeof item === 'string') { text(item, 'finding'); return }
          const finding = record(item)
          if (!['ai-label', 'sensitive', 'absolute', 'citation', 'evidence-changed', 'legacy-shape'].includes(finding.code as string)) invalid('finding.code')
          text(finding.location, 'location'); text(finding.excerpt, 'excerpt', 100_000, true); text(finding.fix, 'fix')
        })
        if (review.rulesHash !== undefined) digest(review.rulesHash)
        if (review.reviewedAt !== null) date(review.reviewedAt)
      }
      for (const rawLink of array(topic.publishedLinks)) {
        const link = record(rawLink)
        platform(link.platform); url(link.url); date(link.recordedAt)
      }
      for (const rawExport of array(topic.exports)) {
        const item = record(rawExport)
        id(item.id); platform(item.platform); date(item.createdAt)
        if (item.contentHash !== undefined) digest(item.contentHash)
        if (item.reviewPassed !== undefined && typeof item.reviewPassed !== 'boolean') invalid('reviewPassed')
        if (!['pending', 'complete'].includes(item.status as string) || !exportFormats.includes(item.format as typeof exportFormats[number])) invalid('export')
        if (item.status === 'complete') {
          digest(item.contentHash)
          if (typeof item.reviewPassed !== 'boolean' || !isAbsolute(text(item.directory, 'directory', 4096))) invalid('export metadata')
          const files = array(item.files)
          if (!files.length) invalid('export files')
          files.forEach(file => text(file, 'export file', 4096).split('/').forEach(fileName))
        }
      }
    }
    return value as Workspace
  } catch (cause) {
    throw new RemoteError('content-evidence/corrupt-store', 'Stored workspace is invalid; existing data was not overwritten', null, { cause })
  }
}
