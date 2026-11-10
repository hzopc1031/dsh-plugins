import { constants } from 'node:fs';
import { mkdir, open, realpath, rename, rm } from 'node:fs/promises';
import { isAbsolute, join, relative, sep } from 'node:path';
import { fileName, id, invalid, text } from './validation.js';
const directoryFlags = constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW;
const fdPath = (directory) => `/proc/self/fd/${directory.fd}`;
async function openTarget(directory, blockedRoots) {
    text(directory, 'directory', 4096);
    const parts = directory.split('/').filter(Boolean);
    if (!isAbsolute(directory) || !parts.length || parts.some(part => part === '.' || part === '..') || directory.includes('\\'))
        invalid('directory');
    let handle = await open('/', directoryFlags);
    try {
        // Pin each Linux directory fd so ancestor replacement cannot redirect later writes.
        for (const part of parts) {
            const next = await open(join(fdPath(handle), part), directoryFlags);
            await handle.close();
            handle = next;
        }
        const canonical = await realpath(fdPath(handle));
        for (const root of blockedRoots) {
            const rel = relative(root, canonical);
            if (rel !== '..' && !rel.startsWith('..' + sep) && !isAbsolute(rel))
                invalid('directory inside package or data store');
        }
        return handle;
    }
    catch (error) {
        await handle.close();
        if (['ELOOP', 'ENOTDIR'].includes(error.code ?? ''))
            invalid('directory symlink or non-directory');
        throw error;
    }
}
function citations(topic) {
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
    ].join('\n\n') + '\n';
}
function codeBlock(value) {
    const longest = [...value.matchAll(/`+/g)].reduce((max, match) => Math.max(max, match[0].length), 2);
    const fence = '`'.repeat(longest + 1);
    return `${fence}\n${value}\n${fence}`;
}
export function exportDocuments(topic, target, draft, format, reviewPassed) {
    const review = reviewPassed ? '审阅通过 / Review passed' : draft.review.status === 'failed' ? '审阅未通过 / Review failed' : '待复核 / Review pending or invalidated';
    const metadata = `Platform: ${target}\nTopic: ${topic.id}\nContent SHA-256: ${draft.contentHash}\nReview: ${review}\n仅供手动发布 / Manual publishing only; human fact and platform checks are still required.`;
    const references = citations(topic);
    const documents = {};
    if (format === 'all' || format === 'markdown')
        documents['draft.md'] = `# 内容证据 / Content evidence\n\n${codeBlock(topic.idea)}\n\n${metadata}\n\n## 草稿 / Draft\n\n${codeBlock(draft.content)}\n\n## 审阅发现 / Review findings\n\n${codeBlock(JSON.stringify(draft.review.findings, null, 2))}\n\n## 证据与引用 / Evidence and citations\n\n${codeBlock(references)}\n`;
    if (format === 'all' || format === 'text')
        documents['draft.txt'] = `${topic.idea}\n\n${metadata}\n\n${draft.content}\n\nReview findings:\n${JSON.stringify(draft.review.findings, null, 2)}\n\n${references}`;
    if (format === 'all' || format === 'citations')
        documents['citations.txt'] = `${metadata}\n\n${references}`;
    if (format === 'materials')
        documents['export.txt'] = `${metadata}\n\nReview findings:\n${JSON.stringify(draft.review.findings, null, 2)}\n`;
    return documents;
}
export async function writeExport(directory, blockedRoots, exportId, documents, materials, readMaterial, signal) {
    signal?.throwIfAborted();
    id(exportId);
    const root = await openTarget(directory, blockedRoots);
    const name = `content-evidence-${exportId}`;
    const temporary = join(fdPath(root), `.${name}.tmp`);
    let staging;
    let materialDirectory;
    let created = false;
    try {
        await mkdir(temporary, { mode: 0o700 });
        created = true;
        staging = await open(temporary, directoryFlags);
        const files = [];
        const write = async (parent, name, bytes) => {
            fileName(name);
            signal?.throwIfAborted();
            const file = await open(join(fdPath(parent), name), constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
            try {
                await file.writeFile(bytes);
                await file.sync();
            }
            finally {
                await file.close();
            }
        };
        for (const [file, content] of Object.entries(documents)) {
            await write(staging, file, content);
            files.push(file);
        }
        if (materials !== null) {
            await mkdir(join(fdPath(staging), 'materials'), { mode: 0o700 });
            materialDirectory = await open(join(fdPath(staging), 'materials'), directoryFlags);
            for (const material of materials) {
                id(material.id);
                await write(materialDirectory, material.id, await readMaterial(material));
                files.push(`materials/${material.id}`);
            }
            await write(materialDirectory, 'index.json', JSON.stringify(materials, null, 2) + '\n');
            files.push('materials/index.json');
            await materialDirectory.sync();
        }
        await staging.sync();
        signal?.throwIfAborted();
        await rename(temporary, join(fdPath(root), name));
        await root.sync();
        return { directory: join(await realpath(fdPath(root)), name), files };
    }
    finally {
        await materialDirectory?.close();
        await staging?.close();
        try {
            if (created)
                await rm(temporary, { recursive: true, force: true });
        }
        finally {
            await root.close();
        }
    }
}
