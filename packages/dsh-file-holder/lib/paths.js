import { realpath, stat } from 'node:fs/promises';
import { win32 as path } from 'node:path';
export function inputPath(raw) {
    let value = raw.trim();
    if (!value)
        throw new Error('用法：/file-holder <项目内文件>（路径含空格时可用双引号包围）');
    if (value.startsWith('"') && value.endsWith('"') && value.length > 1)
        value = value.slice(1, -1);
    if (!value || /[\x00-\x1f\x7f"<>|*?]/u.test(value))
        throw new Error('文件路径包含不支持的字符。');
    assertLocalPath(value);
    return value;
}
// Reject aliases before Win32 normalization: devices, UNC, ADS, rooted/drive-relative paths.
function assertLocalPath(value) {
    if (/^[\\/]/u.test(value) || /^[a-z]:(?![\\/])/iu.test(value))
        throw new Error('不接受 UNC、设备路径或不完整的绝对路径。');
    const rest = value.replace(/^[a-z]:[\\/]/iu, '');
    if (rest.includes(':'))
        throw new Error('不接受设备路径或备用数据流。');
    for (const part of rest.split(/[\\/]/u)) {
        if (part === '.' || part === '..')
            continue;
        if (/[. ]$/u.test(part) || /^(?:con|prn|aux|nul|clock\$|conin\$|conout\$|com[1-9¹²³]|lpt[1-9¹²³])[ .]*(?:\.|$)/iu.test(part)) {
            throw new Error('不接受 Windows 设备名或以点、空格结尾的路径。');
        }
    }
}
function inside(root, file) {
    const relative = path.relative(root, file);
    return relative !== '' && relative !== '..' && !relative.startsWith('..\\') && !path.isAbsolute(relative);
}
export async function validateProjectFile(raw, directory, io = { realpath, stat }) {
    const value = inputPath(raw);
    if (!/^[a-z]:[\\/]/iu.test(directory))
        throw new Error('当前项目必须位于本机 Windows 磁盘。');
    assertLocalPath(directory);
    const candidate = path.resolve(directory, value);
    if (!inside(path.resolve(directory), candidate))
        throw new Error('只允许当前项目内的普通文件。');
    try {
        const root = await io.realpath(directory);
        const file = await io.realpath(candidate);
        if (!/^[a-z]:[\\/]/iu.test(root) || !/^[a-z]:[\\/]/iu.test(file))
            throw new Error('boundary');
        assertLocalPath(root);
        assertLocalPath(file);
        if (!inside(root, file) || !(await io.stat(root)).isDirectory() || !(await io.stat(file)).isFile())
            throw new Error('boundary');
        return { root, file };
    }
    catch {
        throw new Error('只允许当前项目内存在的普通文件；请检查权限及符号链接/junction 的真实目标。');
    }
}
