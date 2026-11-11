import { open, realpath } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
export class BusinessReadError extends Error {
}
export const BUSINESS_FILE_LIMIT = 16 * 1024, BUSINESS_PROMPT_LIMIT = 8 * 1024;
export const FILE_SNIPPET_LIMIT = 3 * 1024, MAX_CONTEXT_FILES = 3, PROMPT_LIMIT = 48 * 1024;
export function hash(text) { return createHash('sha256').update(text).digest('hex'); }
export function clip(text, max) {
    if (Buffer.byteLength(text) <= max)
        return text;
    const marker = '\n[已截断]';
    const bytes = Buffer.from(text).subarray(0, Math.max(0, max - Buffer.byteLength(marker)));
    // Drop an incomplete trailing UTF-8 sequence.
    return bytes.toString('utf8').replace(/\uFFFD$/, '') + marker;
}
export function localPath(file) { return path.isAbsolute(file) || path.win32.isAbsolute(file); }
export function validateLocal(file) {
    if (!localPath(file) || /^[\\]{2}|^\/\/|^\\[?.]\\|^\/dev(?:\/|$)|^\/proc(?:\/|$)|^\/sys(?:\/|$)/i.test(file) ||
        /[\x00-\x1f]/.test(file) || /(?:^|[\\/])(?:con|prn|aux|nul|com[0-9]|lpt[0-9])(?:[.: ]|$)/i.test(file) ||
        /:/.test(file.replace(/^[A-Za-z]:[\\/]/, '')))
        throw new BusinessReadError('拒绝设备路径、UNC 或非绝对路径');
}
export async function readLocal(file) {
    validateLocal(file);
    const resolved = await realpath(file);
    validateLocal(resolved);
    const handle = await open(resolved, constants.O_RDONLY | constants.O_NONBLOCK);
    try {
        const stat = await handle.stat();
        if (!stat.isFile())
            throw new BusinessReadError('仅允许普通文件');
        if (stat.size > BUSINESS_FILE_LIMIT)
            throw new BusinessReadError('业务文件超过 16KB');
        const buf = Buffer.alloc(BUSINESS_FILE_LIMIT + 1);
        let length = 0;
        while (length < buf.length) {
            const { bytesRead } = await handle.read(buf, length, buf.length - length, null);
            if (!bytesRead)
                break;
            length += bytesRead;
        }
        if (length > BUSINESS_FILE_LIMIT)
            throw new BusinessReadError('业务文件超过 16KB');
        try {
            return new TextDecoder('utf-8', { fatal: true }).decode(buf.subarray(0, length));
        }
        catch {
            throw new BusinessReadError('业务文件不是有效 UTF-8 文本');
        }
    }
    finally {
        await handle.close();
    }
}
export async function loadBusiness(repo, source, safe, signal) {
    const parts = [], labels = [];
    if (repo.business?.trim()) {
        parts.push(repo.business);
        labels.push('内联文本');
    }
    let failure = '';
    if (repo.businessFile) {
        try {
            const file = repo.businessFile;
            const content = localPath(file) ? await readLocal(file) : await source.contents?.(repo.repo, file, BUSINESS_FILE_LIMIT, signal);
            if (content === undefined)
                throw new BusinessReadError('当前来源不支持仓库文件读取');
            if (!content.trim())
                throw new BusinessReadError('业务文件为空');
            if (Buffer.byteLength(content) > BUSINESS_FILE_LIMIT)
                throw new BusinessReadError('业务文件超过 16KB');
            parts.push(content);
            labels.push(file);
        }
        catch (error) {
            signal?.throwIfAborted();
            const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
            const status = error && typeof error === 'object' && 'status' in error ? error.status : undefined;
            const reason = error instanceof BusinessReadError ? error.message : code === 'ENOENT' || status === 404 ? '业务文件不存在' :
                ['EACCES', 'EPERM'].includes(String(code)) || status === 403 ? '无权读取业务文件或 GitHub 限流' : '业务文件读取失败（网络、权限或格式限制）';
            failure = '读取失败：' + reason;
        }
    }
    const raw = parts.join('\n\n'), text = clip(safe.text(raw), BUSINESS_PROMPT_LIMIT);
    const status = raw ? '已使用（' + safe.text(labels.join(' + ')) + '，' + (Buffer.byteLength(text) / 1024).toFixed(1) + 'KB' + (text.endsWith('[已截断]') ? '，已截断' : '') + '）' + (failure ? '；' + failure : '') : failure || '未配置';
    return { text, status, fingerprint: hash(JSON.stringify([repo.business ?? '', repo.businessFile ?? '', hash(raw), failure])) };
}
