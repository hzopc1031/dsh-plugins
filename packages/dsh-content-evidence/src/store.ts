import { constants } from 'node:fs'
import { lstat, mkdir, open, realpath, rename, unlink } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { RemoteError } from '@deepseek-ai/dsh-typert-protocol'
import {
  exportFormats,
  type Topic, type Workspace, type Source, type Material, type MaterialInput,
  type Experiment, type ExperimentInput, type Claim, type Draft, type Platform,
  type PublishedLink, type ExportRecord, type ExportFormat, type DraftInput, type EvidenceSheet,
} from './model.js'
import { fileName, hash, id, invalid, parseWorkspace, platform, record, text, url } from './validation.js'
import { checkCompliance, draftHash, evidenceHash, parseDraftInput, renderDraft, revision, rulesHash, stringList, validateFacts } from './drafts.js'
import { exportDocuments, writeExport } from './exports.js'
import { Directory } from './directory-io.js'

const pendingReview = () => ({ status: 'pending' as const, contentHash: null, findings: [], reviewedAt: null })
const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const STATE_LIMIT = 16 * 1024 * 1024
const MATERIAL_LIMIT = 10 * 1024 * 1024
const queues = new Map<string, Promise<unknown>>()
function within(root: string, target: string): boolean {
  const rel = relative(root, target)
  return rel !== '..' && !rel.startsWith('..' + sep) && !isAbsolute(rel)
}
function missing(error: unknown): boolean { return (error as NodeJS.ErrnoException)?.code === 'ENOENT' }

async function readFile(file: string, limit: number, directory?: Directory): Promise<Buffer> {
  const flags = constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK
  const handle = directory ? await directory.openFile(file, flags) : await open(file, flags)
  try {
    const stat = await handle.stat()
    if (!stat.isFile() || stat.size > limit) invalid('stored file')
    const buffer = Buffer.alloc(limit + 1)
    let size = 0
    while (size < buffer.length) {
      const { bytesRead } = await handle.read(buffer, size, buffer.length - size, null)
      if (!bytesRead) break
      size += bytesRead
    }
    if (size > limit) invalid('stored file size')
    return buffer.subarray(0, size)
  } finally { await handle.close() }
}
async function atomicWrite(directory: string, name: string, data: string | Buffer): Promise<void> {
  const temporary = join(directory, `${randomUUID()}.tmp`)
  try {
    const handle = await open(temporary, 'wx', 0o600)
    try { await handle.writeFile(data); await handle.sync() } finally { await handle.close() }
    await rename(temporary, join(directory, name))
    const dir = await open(directory, 'r')
    try { await dir.sync() } finally { await dir.close() }
  } finally { await unlink(temporary).catch(error => { if (!missing(error)) throw error }) }
}

export class EvidenceStore {
  readonly dataDir: string
  private readonly extraSensitiveTerms: string[]
  constructor(dataDir: string = join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'content-evidence'), extraSensitiveTerms: string[] = []) {
    this.extraSensitiveTerms = stringList(extraSensitiveTerms, 'extraSensitiveTerms').map(term => text(term, 'extraSensitiveTerms', 100))
    text(dataDir, 'dataDir', 4096)
    this.dataDir = resolve(dataDir)
    if (within(PACKAGE_ROOT, this.dataDir)) invalid('dataDir inside package')
  }
  private async root(): Promise<string> {
    await mkdir(this.dataDir, { recursive: true, mode: 0o700 })
    const root = await realpath(this.dataDir)
    const packageRoot = await realpath(PACKAGE_ROOT)
    if (within(packageRoot, root)) invalid('dataDir inside package')
    return root
  }
  private async materials(root: string): Promise<string> {
    const directory = join(root, 'materials')
    await mkdir(directory, { mode: 0o700 }).catch(error => { if (error.code !== 'EEXIST') throw error })
    const stat = await lstat(directory)
    if (!stat.isDirectory() || stat.isSymbolicLink() || !within(root, await realpath(directory))) invalid('materials directory')
    return directory
  }
  private async load(root: string): Promise<Workspace> {
    let bytes: Buffer
    try { bytes = await readFile(join(root, 'workspace.json'), STATE_LIMIT) }
    catch (error) { if (missing(error)) return { schemaVersion: 1, topics: [] }; throw error }
    let parsed: unknown
    try { parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) }
    catch (cause) {
      throw new RemoteError('content-evidence/corrupt-store', 'Cannot decode workspace; existing data was not overwritten', null, { cause })
    }
    const workspace = parseWorkspace(parsed)
    for (const topic of workspace.topics) this.invalidateReviews(topic)
    return workspace
  }
  private invalidateReviews(topic: Topic): void {
    for (const draft of Object.values(topic.drafts)) {
      if (draft?.review.status === 'passed' && (draft.evidenceHash !== evidenceHash(topic) || draft.review.rulesHash !== rulesHash(this.extraSensitiveTerms))) draft.review = pendingReview()
    }
  }
  private async mutate<T>(update: (workspace: Workspace, root: string) => Promise<T> | T, signal?: AbortSignal): Promise<T> {
    const root = await this.root()
    // shortcut: one DSH process per data root; use an interprocess lock before supporting concurrent hosts.
    const task = (queues.get(root) ?? Promise.resolve()).catch(() => {}).then(async () => {
      signal?.throwIfAborted()
      const workspace = await this.load(root)
      const result = await update(workspace, root)
      parseWorkspace(workspace)
      const json = JSON.stringify(workspace, null, 2) + '\n'
      if (Buffer.byteLength(json) > STATE_LIMIT) invalid('workspace size')
      signal?.throwIfAborted()
      await atomicWrite(root, 'workspace.json', json)
      return result
    })
    queues.set(root, task)
    try { return await task }
    finally { if (queues.get(root) === task) queues.delete(root) }
  }
  private topic(workspace: Workspace, topicId: string): Topic {
    id(topicId)
    const topic = workspace.topics.find(topic => topic.id === topicId)
    if (!topic) throw new RemoteError('content-evidence/not-found', 'Topic not found', { topicId })
    return topic
  }
  private update<T>(topicId: string, update: (topic: Topic, root: string) => Promise<T> | T, signal?: AbortSignal): Promise<T> {
    id(topicId)
    return this.mutate(async (workspace, root) => {
      const topic = this.topic(workspace, topicId)
      const result = await update(topic, root)
      this.invalidateReviews(topic)
      topic.updatedAt = new Date().toISOString()
      return result
    }, signal)
  }
  async listTopics(signal?: AbortSignal): Promise<Topic[]> {
    signal?.throwIfAborted()
    return (await this.load(await this.root())).topics
  }
  async createTopic(idea: string, signal?: AbortSignal): Promise<Topic> {
    text(idea, 'idea', 2000)
    if (/[\r\n]/.test(idea)) invalid('one-line idea')
    return this.mutate(workspace => {
      const now = new Date().toISOString()
      const topic: Topic = {
        id: randomUUID(), idea, createdAt: now, updatedAt: now,
        sources: [], materials: [], experiments: [], claims: [],
        drafts: { x: null, xiaohongshu: null, douyin: null, 'weixin-video': null },
        publishedLinks: [], exports: [],
      }
      workspace.topics.push(topic)
      return topic
    }, signal)
  }
  async readEvidence(topicId: string, signal?: AbortSignal): Promise<EvidenceSheet> {
    id(topicId); signal?.throwIfAborted()
    const topic = this.topic(await this.load(await this.root()), topicId)
    return { ...topic, evidenceHash: evidenceHash(topic) }
  }
  async addSource(topicId: string, sourceUrl: string, title: string, signal?: AbortSignal): Promise<Source> {
    url(sourceUrl); text(title, 'title', 2000, true)
    return this.update(topicId, topic => {
      const source: Source = { id: randomUUID(), url: sourceUrl, title, createdAt: new Date().toISOString() }
      topic.sources.push(source)
      return source
    }, signal)
  }
  async captureMaterial(topicId: string, input: MaterialInput, signal?: AbortSignal): Promise<Material> {
    record(input); fileName(input.name); text(input.mediaType, 'mediaType', 255)
    const base64 = text(input.base64, 'base64', Math.ceil(MATERIAL_LIMIT / 3) * 4, true)
    if (base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) invalid('base64')
    const bytes = Buffer.from(base64, 'base64')
    if (bytes.length > MATERIAL_LIMIT || bytes.toString('base64') !== base64) invalid('base64')
    if (input.sourceId !== null) id(input.sourceId)
    return this.update(topicId, async (topic, root) => {
      if (input.sourceId !== null && !topic.sources.some(source => source.id === input.sourceId)) invalid('sourceId')
      const materialId = randomUUID()
      await atomicWrite(await this.materials(root), materialId, bytes)
      const material: Material = {
        id: materialId, name: input.name, mediaType: input.mediaType, path: `materials/${materialId}`,
        bytes: bytes.length, sha256: hash(bytes), sourceId: input.sourceId, createdAt: new Date().toISOString(),
      }
      topic.materials.push(material)
      return material
    }, signal)
  }
  async readMaterial(topicId: string, materialId: string, signal?: AbortSignal): Promise<MaterialInput> {
    id(materialId)
    const topic = await this.readEvidence(topicId, signal)
    const material = topic.materials.find(item => item.id === materialId)
    if (!material) invalid('materialId')
    const bytes = await this.materialBytes(await this.root(), material, signal)
    return { name: material.name, mediaType: material.mediaType, base64: bytes.toString('base64'), sourceId: material.sourceId }
  }
  private async materialBytes(root: string, material: Material, signal?: AbortSignal): Promise<Buffer> {
    signal?.throwIfAborted()
    const directory = await Directory.open(await this.materials(root))
    let bytes: Buffer
    try { bytes = await readFile(material.id, MATERIAL_LIMIT, directory) }
    finally { await directory.handle.close() }
    signal?.throwIfAborted()
    if (bytes.length !== material.bytes || hash(bytes) !== material.sha256) {
      throw new RemoteError('content-evidence/corrupt-store', 'Material integrity check failed', null)
    }
    return bytes
  }
  async logExperiment(topicId: string, input: ExperimentInput, signal?: AbortSignal): Promise<Experiment> {
    record(input)
    text(input.command, 'command', 100_000, true); text(input.output, 'output', 1_000_000, true)
    text(input.versions, 'versions', 100_000, true); text(input.conditions, 'conditions', 100_000, true)
    return this.update(topicId, topic => {
      const experiment: Experiment = {
        id: randomUUID(), command: input.command, output: input.output, versions: input.versions,
        conditions: input.conditions, createdAt: new Date().toISOString(),
      }
      topic.experiments.push(experiment)
      return experiment
    }, signal)
  }
  async saveClaim(topicId: string, claimText: string, sourceId: string | null, signal?: AbortSignal): Promise<Claim> {
    text(claimText, 'claim')
    if (sourceId !== null) id(sourceId)
    return this.update(topicId, topic => {
      if (sourceId !== null && ![...topic.sources, ...topic.materials, ...topic.experiments].some(item => item.id === sourceId)) invalid('sourceId')
      const claim: Claim = {
        id: randomUUID(), text: claimText, sourceId, status: sourceId === null ? '待核实' : '有来源', createdAt: new Date().toISOString(),
      }
      topic.claims.push(claim)
      return claim
    }, signal)
  }
  async saveDraft(topicId: string, target: Platform, value: DraftInput, signal?: AbortSignal): Promise<Draft> {
    platform(target)
    const input = parseDraftInput(value, target)
    return this.update(topicId, topic => {
      const previous = topic.drafts[target]
      this.compare(topic, previous?.revision ?? 0, input.expectedRevision, input.evidenceHash)
      validateFacts(input.body, topic, input.claimIds)
      const content = renderDraft(input.body, topic, input.claimIds)
      text(content, 'content', 200_000)
      const draft: Draft = {
        body: input.body, claimIds: input.claimIds, evidenceHash: input.evidenceHash,
        content, contentHash: '', revision: (previous?.revision ?? 0) + 1,
        updatedAt: new Date().toISOString(), status: 'complete', review: pendingReview(),
      }
      draft.contentHash = draftHash(draft)
      if (previous?.contentHash === draft.contentHash) return previous
      topic.drafts[target] = draft
      return draft
    }, signal)
  }
  private compare(topic: Topic, current: number, expected: number, base: string): void {
    if (current !== expected || evidenceHash(topic) !== base) {
      throw new RemoteError('content-evidence/conflict', 'Draft or evidence changed; read the latest evidence before retrying', { revision: current, evidenceHash: evidenceHash(topic) })
    }
  }
  async reviewDraft(topicId: string, target: Platform, expectedRevision: number, signal?: AbortSignal): Promise<Draft> {
    platform(target); revision(expectedRevision)
    return this.update(topicId, topic => {
      const draft = topic.drafts[target]
      if (!draft) invalid('missing draft')
      this.compare(topic, draft.revision, expectedRevision, evidenceHash(topic))
      const findings = checkCompliance(topic, draft, this.extraSensitiveTerms)
      draft.review = {
        status: findings.length ? 'failed' : 'passed', contentHash: draft.contentHash,
        findings, reviewedAt: new Date().toISOString(), rulesHash: rulesHash(this.extraSensitiveTerms),
      }
      return draft
    }, signal)
  }
  async backfillPublishedLink(topicId: string, target: Platform, publishedUrl: string, signal?: AbortSignal): Promise<PublishedLink> {
    platform(target); url(publishedUrl)
    return this.update(topicId, topic => {
      const link: PublishedLink = { platform: target, url: publishedUrl, recordedAt: new Date().toISOString() }
      topic.publishedLinks.push(link)
      return link
    }, signal)
  }
  async requestExport(topicId: string, target: Platform, format: ExportFormat, directory: string, signal?: AbortSignal): Promise<ExportRecord> {
    platform(target)
    if (!exportFormats.includes(format)) invalid('format')
    return this.update(topicId, async (topic, root) => {
      const draft = topic.drafts[target]
      if (!draft) invalid('missing draft')
      const reviewPassed = draft.review.status === 'passed' && draft.review.contentHash === draftHash(draft)
        && draft.evidenceHash === evidenceHash(topic) && draft.review.rulesHash === rulesHash(this.extraSensitiveTerms)
      const exportId = randomUUID()
      const output = await writeExport(directory, [await realpath(PACKAGE_ROOT), root], exportId,
        exportDocuments(topic, target, draft, format, reviewPassed),
        format === 'all' || format === 'materials' ? topic.materials : null,
        material => this.materialBytes(root, material, signal), signal)
      const item: ExportRecord = {
        id: exportId, platform: target, format, status: 'complete', createdAt: new Date().toISOString(),
        contentHash: draft.contentHash, reviewPassed, ...output,
      }
      topic.exports.push(item)
      return item
    }, signal)
  }
}
