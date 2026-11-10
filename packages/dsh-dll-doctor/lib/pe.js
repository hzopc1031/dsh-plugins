import { open, realpath } from 'node:fs/promises';
import path from 'node:path';
export const MAX_FILE_BYTES = 64 * 1024 * 1024;
export const MAX_IMPORTS = 512;
export function dllName(value) {
    return value.length > 0 && value.length <= 255 && /^[\x21-\x7e]+$/.test(value)
        && !/[<>:"/\\|?*]/.test(value) && !/[. ]$/.test(value)
        && !/^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(value) && value !== '.' && value !== '..';
}
export function safeLocalPath(value) {
    if (!value || /[\x00-\x1f]/.test(value) || /^[\\/]{2}/.test(value) || /^[\\/](?:\?\?|Device)[\\/]/i.test(value))
        throw new Error('拒绝空路径、UNC 或设备路径。');
    if (value.split(/[\\/]/).some(part => /^(con|prn|aux|nul|conin\$|conout\$|com[1-9¹²³]|lpt[1-9¹²³])(?:[ .]|$)/i.test(part)))
        throw new Error('拒绝设备名称。');
    if (value.replace(/^[a-z]:/i, '').includes(':') || /^[a-z]:(?![\\/])/i.test(value))
        throw new Error('拒绝备用数据流或驱动器相对路径。');
    return value;
}
export function targetPath(input, cwd) {
    safeLocalPath(input);
    const file = path.resolve(cwd, input);
    safeLocalPath(file);
    if (!/\.(exe|dll)$/i.test(file))
        throw new Error('请选择 EXE 或 DLL 文件。');
    return file;
}
/** Read-only, regular local files only; cap allocation even if the file grows. */
export async function readPE(file, signal, budget) {
    signal?.throwIfAborted();
    safeLocalPath(file);
    safeLocalPath(await realpath(file));
    const handle = await open(file, 'r');
    try {
        const stat = await handle.stat();
        if (!stat.isFile())
            throw new Error('目标不是普通文件。');
        if (stat.size > MAX_FILE_BYTES)
            throw new Error('文件超过 64 MiB 解析上限。');
        if (budget && stat.size > budget.remaining)
            throw new Error('达到 256 MiB 总读取上限。');
        if (budget)
            budget.remaining -= stat.size;
        const buffer = Buffer.alloc(stat.size);
        let offset = 0;
        while (offset < buffer.length) {
            signal?.throwIfAborted();
            const { bytesRead } = await handle.read(buffer, offset, buffer.length - offset, offset);
            if (!bytesRead)
                throw new Error('文件读取中截断。');
            offset += bytesRead;
        }
        signal?.throwIfAborted();
        return parsePE(buffer);
    }
    finally {
        await handle.close();
    }
}
export function parsePE(b) {
    const fail = (text) => { throw new Error('PE 格式无效：' + text); };
    const range = (offset, length) => {
        if (!Number.isSafeInteger(offset) || offset < 0 || length < 0 || offset + length > b.length)
            fail('截断或越界');
    };
    const u16 = (o) => { range(o, 2); return b.readUInt16LE(o); };
    const u32 = (o) => { range(o, 4); return b.readUInt32LE(o); };
    if (b.length > MAX_FILE_BYTES)
        fail('文件过大');
    if (u16(0) !== 0x5a4d)
        fail('DOS 签名');
    const pe = u32(0x3c);
    if (pe < 64 || u32(pe) !== 0x4550)
        fail('PE 签名');
    const machine = u16(pe + 4);
    const architecture = { 0x14c: 'x86', 0x8664: 'x64', 0xaa64: 'ARM64' }[machine];
    if (!architecture)
        fail('不支持的 Machine');
    const count = u16(pe + 6), optSize = u16(pe + 20), opt = pe + 24;
    if (!count || count > 96)
        fail('节数量');
    range(opt, optSize);
    const magic = u16(opt), plus = magic === 0x20b;
    if (magic !== 0x10b && !plus)
        fail('可选头');
    if ((architecture === 'x86') === plus)
        fail('Machine 与 PE32/PE32+ 不一致');
    const dirOffset = plus ? 112 : 96;
    if (optSize < dirOffset)
        fail('可选头过短');
    const dirCount = u32(opt + dirOffset - 4);
    if (dirCount > 16 || dirOffset + dirCount * 8 > optSize)
        fail('数据目录');
    const headers = u32(opt + 60);
    const sectionStart = opt + optSize;
    range(sectionStart, count * 40);
    if (headers < sectionStart + count * 40 || headers > b.length)
        fail('SizeOfHeaders');
    const base = plus ? (range(opt + 24, 8), b.readBigUInt64LE(opt + 24)) : BigInt(u32(opt + 28));
    const sections = Array.from({ length: count }, (_, i) => {
        const s = sectionStart + i * 40;
        const va = u32(s + 12), size = u32(s + 16), raw = u32(s + 20), virtual = u32(s + 8);
        range(raw, size);
        if (va + Math.max(virtual, size) > 0x100000000)
            fail('节 RVA 溢出');
        return { va, size, raw };
    });
    const map = (rva, length) => {
        if (rva < headers && rva + length <= headers) {
            range(rva, length);
            return { offset: rva, end: headers };
        }
        const found = sections.filter(s => rva >= s.va && rva - s.va + length <= s.size);
        if (found.length !== 1)
            fail('RVA 无原始数据或节重叠');
        const s = found[0], offset = s.raw + rva - s.va;
        range(offset, length);
        return { offset, end: s.raw + s.size };
    };
    const nameAt = (rva) => {
        const { offset, end } = map(rva, 1);
        const limit = Math.min(end, offset + 256);
        let i = offset;
        while (i < limit && b[i])
            i++;
        if (i === limit)
            fail('导入名称未终止或过长');
        const name = b.toString('latin1', offset, i);
        if (!dllName(name))
            fail('导入名称不安全');
        return name;
    };
    const imports = [];
    const directory = (index) => index < dirCount ? [u32(opt + dirOffset + index * 8), u32(opt + dirOffset + index * 8 + 4)] : [0, 0];
    for (const [index, stride, delay] of [[1, 20, false], [13, 32, true]]) {
        const [rva, size] = directory(index);
        if (!rva && !size)
            continue;
        if (!rva || size < stride)
            fail('导入目录大小');
        const { offset } = map(rva, size);
        let ended = false;
        for (let pos = 0; pos + stride <= size; pos += stride) {
            const o = offset + pos;
            if (b.subarray(o, o + stride).every(v => v === 0)) {
                ended = true;
                break;
            }
            if (imports.length >= MAX_IMPORTS)
                fail('导入数量超过 512');
            let nameRva = u32(o + (delay ? 4 : 12));
            if (delay) {
                const attributes = u32(o);
                if (attributes > 1)
                    fail('延迟导入属性');
                if (!attributes) {
                    const delta = BigInt(nameRva) - base;
                    if (delta < 0n || delta > 0xffffffffn)
                        fail('延迟导入 VA');
                    nameRva = Number(delta);
                }
            }
            if (!nameRva)
                fail('导入名称 RVA 为零');
            imports.push({ name: nameAt(nameRva), delay });
        }
        if (!ended)
            fail('导入表缺少结束项');
    }
    return { architecture, format: plus ? 'PE32+' : 'PE32', imports, managed: directory(14)[0] !== 0 };
}
