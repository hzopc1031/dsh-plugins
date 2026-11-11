import path from 'node:path';
import { constants } from 'node:fs';
import { lstat, mkdir, open, realpath, rename, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
export const isMissing = (error) => error?.code === 'ENOENT';
async function directory(input, create) {
    if (!path.isAbsolute(input) || input.split(path.sep).includes('..'))
        throw new Error('目录必须为绝对路径，且不得包含 ..');
    const root = path.resolve(input);
    let current = path.parse(root).root;
    for (const part of root.slice(current.length).split(path.sep).filter(Boolean)) {
        current = path.join(current, part);
        if (create) {
            try {
                await mkdir(current, { mode: 0o700 });
            }
            catch (error) {
                if (error.code !== 'EEXIST')
                    throw error;
            }
        }
        const stat = await lstat(current);
        if (!stat.isDirectory() || stat.isSymbolicLink())
            throw new Error('目录不得经过符号链接');
    }
    if (await realpath(root) !== root)
        throw new Error('目录越出目标路径');
    return root;
}
function filename(name) {
    if (!/^[a-zA-Z0-9.-]+$/.test(name) || name.includes('..') || name === '.')
        throw new Error('文件名不得包含路径或 ..');
}
export async function readLocal(dir, name, limit) {
    filename(name);
    const root = await directory(dir, false);
    const handle = await open(path.join(root, name), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
        if (!(await handle.stat()).isFile())
            throw new Error('仅可读取普通文件');
        const chunks = [];
        let total = 0;
        while (total <= limit) {
            const buffer = Buffer.alloc(Math.min(65536, limit + 1 - total));
            const { bytesRead } = await handle.read(buffer, 0, buffer.length, null);
            if (!bytesRead)
                break;
            total += bytesRead;
            chunks.push(buffer.subarray(0, bytesRead));
        }
        if (total > limit)
            throw new Error('本地文件超过大小限制');
        return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
    }
    finally {
        await handle.close();
    }
}
export async function writeLocal(dir, name, text, create = false) {
    filename(name);
    const root = await directory(dir, create);
    const target = path.join(root, name);
    const check = async () => {
        await directory(dir, false);
        try {
            if (!(await lstat(target)).isFile())
                throw new Error('目标必须是普通文件，不得为符号链接');
        }
        catch (error) {
            if (!isMissing(error))
                throw error;
        }
    };
    await check();
    const temp = path.join(root, `${randomUUID()}.tmp`);
    const handle = await open(temp, 'wx', 0o600);
    try {
        await handle.writeFile(text, 'utf8');
        await handle.sync();
        await check();
        await rename(temp, target);
    }
    finally {
        await handle.close();
        await unlink(temp).catch(error => { if (!isMissing(error))
            throw error; });
    }
}
