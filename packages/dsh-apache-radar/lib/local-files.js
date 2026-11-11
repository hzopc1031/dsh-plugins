import { constants } from 'node:fs';
import { lstat, mkdtemp, open, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
export function validDirectory(directory) {
    return typeof directory === 'string' && isAbsolute(directory) && !directory.split(/[\\/]/).includes('..');
}
export async function localPath(directory, filename) {
    if (!validDirectory(directory) || !/^\.apache-radar-[a-z-]+\.(json|md)$/.test(filename))
        throw new Error('Local directory traversal or filename rejected');
    const root = resolve(directory);
    if (await realpath(root) !== root || !(await lstat(root)).isDirectory())
        throw new Error('Local directory symlink or invalid directory rejected');
    const path = join(root, filename);
    try {
        if (!(await lstat(path)).isFile())
            throw new Error('Local target symlink or non-file rejected');
    }
    catch (error) {
        if (error.code !== 'ENOENT')
            throw error;
    }
    return path;
}
export async function readLocal(directory, filename) {
    const path = await localPath(directory, filename);
    let file;
    try {
        file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    }
    catch (error) {
        if (error.code === 'ENOENT')
            return undefined;
        throw error;
    }
    try {
        return await file.readFile('utf8');
    }
    finally {
        await file.close();
    }
}
export async function writeLocal(directory, filename, content) {
    const path = await localPath(directory, filename);
    const temporary = await mkdtemp(join(resolve(directory), '.apache-radar-write-'));
    try {
        const staged = join(temporary, 'content');
        await writeFile(staged, content, { flag: 'wx', mode: 0o600 });
        await localPath(directory, filename);
        await rename(staged, path);
        return path;
    }
    finally {
        await rm(temporary, { recursive: true, force: true });
    }
}
