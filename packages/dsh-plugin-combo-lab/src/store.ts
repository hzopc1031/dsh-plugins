import { mkdir, readFile, writeFile, rename, unlink } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { compare, identifier, object, parseStudy, string, timestamp, type Study, type Comparison } from './core.js'

export interface Snapshot { schemaVersion: 1; id: string; label: string; savedAt: string; study: Study }
export interface ComparisonArchive {
  schemaVersion: 1; id: string; savedAt: string
  before: { id: string; label: string }; after: { id: string; label: string }; result: Comparison
}
/** Only UUID filenames under this explicit workspace directory. No user-selected file import. */
export class Store {
  constructor(readonly directory: string) {}
  private file(id: string, kind: 'study' | 'snapshot' | 'comparison'): string { return path.join(this.directory, kind + '-' + identifier(id) + '.json') }
  private async read(file: string): Promise<unknown> {
    const data = await readFile(file, 'utf8')
    if (Buffer.byteLength(data) > 8 * 1024 * 1024) throw new Error('存档超过 8 MiB 限制')
    return JSON.parse(data)
  }
  async load(id: string): Promise<Study> {
    const study = parseStudy(await this.read(this.file(id, 'study')))
    if (study.plan.id !== id) throw new Error('存档 ID 不符')
    return study
  }
  async save(study: Study, create = false): Promise<void> {
    await mkdir(this.directory, { recursive: true })
    const target = this.file(study.plan.id, 'study'), body = JSON.stringify(study, null, 2)
    if (Buffer.byteLength(body) > 8 * 1024 * 1024) throw new Error('存档超过 8 MiB 限制')
    if (create) { await writeFile(target, body, { encoding: 'utf8', flag: 'wx' }); return }
    const temp = path.join(this.directory, '.write-' + randomUUID())
    try { await writeFile(temp, body, { encoding: 'utf8', flag: 'wx' }); await rename(temp, target) }
    finally { await unlink(temp).catch(() => {}) }
  }
  async freeze(study: Study, label: string, now: string): Promise<Snapshot> {
    const snapshot: Snapshot = { schemaVersion: 1, id: randomUUID(), label: string(label, '快照标签', 200), savedAt: timestamp(now), study: parseStudy(study) }
    await mkdir(this.directory, { recursive: true })
    const body = JSON.stringify(snapshot, null, 2)
    if (Buffer.byteLength(body) > 8 * 1024 * 1024) throw new Error('快照超过 8 MiB 限制')
    await writeFile(this.file(snapshot.id, 'snapshot'), body, { encoding: 'utf8', flag: 'wx' })
    return snapshot
  }
  async saveComparison(before: Snapshot, after: Snapshot, now: string): Promise<ComparisonArchive> {
    if (before.savedAt > after.savedAt) throw new Error('升级前快照时间晚于升级后，请核对传入顺序')
    const report: ComparisonArchive = {
      schemaVersion: 1, id: randomUUID(), savedAt: timestamp(now),
      before: { id: identifier(before.id), label: before.label }, after: { id: identifier(after.id), label: after.label },
      result: compare(before.study, after.study)
    }
    await mkdir(this.directory, { recursive: true })
    await writeFile(this.file(report.id, 'comparison'), JSON.stringify(report, null, 2), { encoding: 'utf8', flag: 'wx' })
    return report
  }
  async snapshot(id: string): Promise<Snapshot> {
    const s = object(await this.read(this.file(id, 'snapshot')))
    if (s.schemaVersion !== 1 || identifier(s.id) !== id) throw new Error('快照格式或 ID 不符')
    return { schemaVersion: 1, id, label: string(s.label, '快照标签', 200), savedAt: timestamp(s.savedAt), study: parseStudy(s.study) }
  }
}