import path from 'node:path';
import { open, realpath, mkdir, rename, unlink, lstat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { ImpactError, fail, localPath, parseRegistration, emptyRegistry, parseRegistry, register, analyze, validId, } from './core.js';
export const MAX_BYTES = 5 * 1024 * 1024;
const STATE_LIMIT = 16 * 1024 * 1024;
function code(error) { return error?.code; }
function within(root, target) {
    const rel = path.relative(root, target);
    return rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel);
}
function check(signal) { signal?.throwIfAborted(); }
/** Read at most limit + 1 bytes, even if a file grows while reading. */
async function bounded(file, limit, signal) {
    check(signal);
    const handle = await open(file, 'r');
    try {
        const stat = await handle.stat();
        if (!stat.isFile())
            fail('仅可读取普通文件');
        if (stat.size > limit)
            fail('文件超过大小限制');
        const chunks = [];
        let total = 0;
        while (true) {
            check(signal);
            const buffer = Buffer.alloc(Math.min(65536, limit + 1 - total));
            const { bytesRead } = await handle.read(buffer, 0, buffer.length, null);
            if (!bytesRead)
                break;
            total += bytesRead;
            if (total > limit)
                fail('文件超过大小限制');
            chunks.push(buffer.subarray(0, bytesRead));
        }
        try {
            return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
        }
        catch {
            fail('文件必须为有效 UTF-8 文本');
        }
    }
    finally {
        await handle.close();
    }
}
export class ImpactStore {
    cwd;
    constructor(cwd) {
        this.cwd = cwd;
        if (!path.isAbsolute(cwd) || cwd.startsWith('\\\\') || cwd.startsWith('//'))
            fail('必须提供本地项目绝对路径 cwd');
    }
    async root() {
        try {
            return await realpath(this.cwd);
        }
        catch {
            fail('项目目录不可用');
        }
    }
    async readSource(file, signal) {
        const relative = localPath(file), root = await this.root();
        check(signal);
        const target = await realpath(path.resolve(root, relative));
        if (!within(root, target))
            fail('来源路径越出项目目录');
        // Check the resolved target as well, so links cannot bypass restricted directory checks.
        localPath(path.relative(root, target));
        return bounded(target, MAX_BYTES, signal);
    }
    /** State folders never follow symbolic links/junctions. Reading never creates them. */
    async stateDir(create) {
        const root = await this.root();
        let current = root;
        for (const part of ['.dsh', 'source-impact']) {
            current = path.join(current, part);
            if (create) {
                try {
                    await mkdir(current);
                }
                catch (e) {
                    if (code(e) !== 'EEXIST')
                        throw e;
                }
            }
            let stat;
            try {
                stat = await lstat(current);
            }
            catch (e) {
                if (!create && code(e) === 'ENOENT')
                    return null;
                throw e;
            }
            if (!stat.isDirectory() || stat.isSymbolicLink() || !within(root, await realpath(current)))
                fail('登记目录必须是项目内的普通目录');
        }
        return current;
    }
    async load(signal) {
        check(signal);
        const dir = await this.stateDir(false);
        if (!dir)
            return emptyRegistry();
        const file = path.join(dir, 'registry.json');
        try {
            const stat = await lstat(file);
            if (stat.isSymbolicLink())
                fail('登记文件不得为符号链接');
            return parseRegistry(JSON.parse(await bounded(file, STATE_LIMIT, signal)));
        }
        catch (e) {
            if (code(e) === 'ENOENT')
                return emptyRegistry();
            if (e instanceof ImpactError)
                throw e;
            if (e instanceof SyntaxError)
                fail('登记文件不是有效 JSON；不会覆盖损坏文件');
            check(signal);
            fail('无法读取登记文件');
        }
    }
    async mutate(update, signal) {
        check(signal);
        const dir = await this.stateDir(true);
        if (!dir)
            fail('无法创建登记目录');
        const lockPath = path.join(dir, 'registry.lock');
        let lock;
        try {
            lock = await open(lockPath, 'wx', 0o600);
        }
        catch {
            fail('登记正在被修改或目录不可写；若上次进程异常退出，确认无人写入后移除 registry.lock 再试');
        }
        const temp = path.join(dir, randomUUID() + '.tmp');
        try {
            const next = await update(await this.load(signal));
            const data = JSON.stringify(next, null, 2) + '\n';
            if (Buffer.byteLength(data, 'utf8') > STATE_LIMIT)
                fail('登记数据超过 16 MiB 限制');
            check(signal);
            const handle = await open(temp, 'wx', 0o600);
            try {
                await handle.writeFile(data, 'utf8');
                await handle.sync();
            }
            finally {
                await handle.close();
            }
            check(signal);
            await rename(temp, path.join(dir, 'registry.json'));
            return next;
        }
        finally {
            await unlink(temp).catch(() => { });
            await lock.close();
            await unlink(lockPath);
        }
    }
    async add(input, signal) {
        const registration = parseRegistration(input);
        return this.mutate(async (registry) => register(registry, registration, await this.readSource(registration.source, signal)), signal);
    }
    async remove(id, signal) {
        validId(id);
        return this.mutate(async (registry) => {
            if (!registry.references.some(r => r.id === id))
                fail('引用 id 不存在');
            return { schemaVersion: 1, references: registry.references.filter(r => r.id !== id) };
        }, signal);
    }
    async scan(signal) {
        const registry = await this.load(signal);
        const observations = new Map();
        for (const source of new Set(registry.references.map(r => r.source))) {
            check(signal);
            try {
                observations.set(source, { text: await this.readSource(source, signal) });
            }
            catch (e) {
                check(signal);
                observations.set(source, { error: e instanceof ImpactError ? e.message : code(e) === 'ENOENT' ? '来源文件不存在或已移动' : '来源读取失败，请检查权限和路径' });
            }
        }
        return analyze(registry, observations);
    }
}
