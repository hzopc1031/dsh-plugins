import { constants } from 'node:fs'
import { isAbsolute, join, relative, sep } from 'node:path'
import { Directory } from './directory-io.js'
import type { Draft, ExportFormat, Material, Platform, Topic } from './model.js'
import { fileName, id, invalid, text } from './validation.js'

async function openTarget(directory: string, blockedRoots: string[]) {
  Directory.supported()
  text(directory, 'directory', 4096)
  const parts = directory.split('/').filter(Boolean)
  if (!isAbsolute(directory) || !parts.length || parts.some(part => part === '.' || part === '..') || directory.includes('\\')) invalid('directory')
  const root = await Directory.open(directory)
  try {
    const canonical = await root.canonical(directory)
    for (const blocked of blockedRoots) {
      const rel = relative(blocked, canonical)
      if (rel !== '..' && !rel.startsWith('..' + sep) && !isAbsolute(rel)) invalid('directory inside package or data store')
    }
    return root
  } catch (error) { await root.handle.close(); throw error }
}

function citations(topic: Topic): string {
  return [
    '来源 / Sources',
    ...topic.sources.map(source => `[${source.id}] ${source.title}\n${source.url}`),
    '\n事实 / Claims (有来源 only means a reference exists)',
    ...topic.claims.map(claim => `[${claim.id}] ${claim.text}\n${claim.status}; reference: ${claim.sourceId ?? '待核实'}`),
    '\n材料 / Materials (inert bytes)',
    ...topic.materials.map(material => `[${material.id}] ${material.name}\nmaterials/${material.id}; ${material.mediaType}; bytes: ${material.bytes}; SHA-256: ${material.sha256}; source: ${material.sourceId ?? '待核实'}`),
    '\n实验 / Experiments (commands are records, never executed)',
    ...topic.experiments.map(experiment => `[${experiment.id}]\nCommand:\n${experiment.command}\nOutput:\n${experiment.output}\nVersions:\n${experiment.versions}\nConditions:\n${experiment.conditions}`),
    '\n手动回填的发布链接 / Manually supplied published URLs',
    ...topic.publishedLinks.map(link => `${link.platform}: ${link.url}\nRecorded: ${link.recordedAt}`),
  ].join('\n\n') + '\n'
}

function codeBlock(value: string): string {
  const longest = [...value.matchAll(/`+/g)].reduce((max, match) => Math.max(max, match[0].length), 2)
  const fence = '`'.repeat(longest + 1)
  return `${fence}\n${value}\n${fence}`
}

export function exportDocuments(topic: Topic, target: Platform, draft: Draft, format: ExportFormat, reviewPassed: boolean): Record<string, string> {
  const review = reviewPassed ? '审阅通过 / Review passed' : draft.review.status === 'failed' ? '审阅未通过 / Review failed' : '待复核 / Review pending or invalidated'
  const metadata = `Platform: ${target}\nTopic: ${topic.id}\nContent SHA-256: ${draft.contentHash}\nReview: ${review}\n仅供手动发布 / Manual publishing only; human fact and platform checks are still required.`
  const references = citations(topic)
  const documents: Record<string, string> = {}
  if (format === 'all' || format === 'markdown') documents['draft.md'] = `# 内容证据 / Content evidence\n\n${codeBlock(topic.idea)}\n\n${metadata}\n\n## 草稿 / Draft\n\n${codeBlock(draft.content)}\n\n## 审阅发现 / Review findings\n\n${codeBlock(JSON.stringify(draft.review.findings, null, 2))}\n\n## 证据与引用 / Evidence and citations\n\n${codeBlock(references)}\n`
  if (format === 'all' || format === 'text') documents['draft.txt'] = `${topic.idea}\n\n${metadata}\n\n${draft.content}\n\nReview findings:\n${JSON.stringify(draft.review.findings, null, 2)}\n\n${references}`
  if (format === 'all' || format === 'citations') documents['citations.txt'] = `${metadata}\n\n${references}`
  if (format === 'materials') documents['export.txt'] = `${metadata}\n\nReview findings:\n${JSON.stringify(draft.review.findings, null, 2)}\n`
  return documents
}

export async function writeExport(
  directory: string, blockedRoots: string[], exportId: string, documents: Record<string, string>,
  materials: Material[] | null, readMaterial: (material: Material) => Promise<Buffer>, signal?: AbortSignal,
): Promise<{ directory: string; files: string[] }> {
  signal?.throwIfAborted()
  id(exportId)
  let root: Directory
  try { root = await openTarget(directory, blockedRoots) }
  catch (error) {
    if (['ELOOP', 'ENOTDIR'].includes((error as NodeJS.ErrnoException).code ?? '')) invalid('directory symlink or non-directory')
    throw error
  }
  const name = `content-evidence-${exportId}`, temporary = `.${name}.tmp`
  let staging: Directory | undefined, materialDirectory: Directory | undefined
  let created = false, materialsCreated = false
  const written: { parent: Directory; name: string }[] = []
  try {
    await root.mkdir(temporary)
    created = true
    staging = await root.openDirectory(temporary)
    const files: string[] = []
    const write = async (parent: Directory, name: string, bytes: string | Buffer) => {
      fileName(name)
      signal?.throwIfAborted()
      const file = await parent.openFile(name, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW)
      written.push({ parent, name })
      try { await file.writeFile(bytes); await file.sync() } finally { await file.close() }
    }
    for (const [file, content] of Object.entries(documents)) {
      await write(staging, file, content)
      files.push(file)
    }
    if (materials !== null) {
      await staging.mkdir('materials')
      materialsCreated = true
      materialDirectory = await staging.openDirectory('materials')
      for (const material of materials) {
        id(material.id)
        await write(materialDirectory, material.id, await readMaterial(material))
        files.push(`materials/${material.id}`)
      }
      await write(materialDirectory, 'index.json', JSON.stringify(materials, null, 2) + '\n')
      files.push('materials/index.json')
      await materialDirectory.handle.sync()
    }
    await staging.handle.sync()
    const canonical = await root.canonical(directory)
    signal?.throwIfAborted()
    await root.rename(temporary, name)
    created = false
    await root.handle.sync()
    return { directory: join(canonical, name), files }
  } finally {
    try {
      if (created) {
        for (const file of written.reverse()) await file.parent.unlink(file.name)
        if (materialsCreated) await staging!.unlink('materials', true)
        await root.unlink(temporary, true)
      }
    } finally {
      try { await materialDirectory?.handle.close() }
      finally { try { await staging?.handle.close() } finally { await root.handle.close() } }
    }
  }
}
