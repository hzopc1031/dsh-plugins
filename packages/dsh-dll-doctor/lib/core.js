import path from 'node:path';
import { stat, realpath } from 'node:fs/promises';
import { readPE, safeLocalPath, targetPath, dllName } from './pe.js';
import { knownDLLs, supplement, FALLBACK_KNOWN } from './process.js';
export { parsePE, readPE } from './pe.js';
export function systemRoots(file, cwd) {
    const windows = safeLocalPath(process.env.SystemRoot || 'C:\\Windows');
    const os64 = process.arch !== 'ia32' || !!process.env.PROCESSOR_ARCHITEW6432;
    const localRoot = (v) => { safeLocalPath(v); if (!path.isAbsolute(v))
        throw new Error('搜索根目录必须是本地绝对路径。'); return v; };
    localRoot(windows);
    localRoot(cwd);
    return { application: path.dirname(file), windows, current: cwd, system32: path.join(windows, 'System32'), sysWOW64: path.join(windows, 'SysWOW64'), system16: path.join(windows, 'System'), sysnative: path.join(windows, 'Sysnative'), node32: process.arch === 'ia32', os64,
        path: (process.env.PATH || '').split(';').map(v => v.trim().replace(/^"(.*)"$/, '$1')).filter(Boolean).slice(0, 128).flatMap(v => { try {
            return [localRoot(v)];
        }
        catch {
            return [];
        } }) };
}
export function systemDirectory(architecture, roots) {
    if (architecture === 'x86' && roots.os64)
        return { directory: roots.sysWOW64, source: 'SysWOW64' };
    if (architecture !== 'x86' && roots.os64 && roots.node32)
        return { directory: roots.sysnative, source: 'System32 (Sysnative)' };
    return { directory: roots.system32, source: 'System32' };
}
export async function resolveDLL(name, architecture, roots, known) {
    if (!dllName(name))
        throw new Error('不安全的 DLL 名称。');
    if (/^(api-ms-win-|ext-ms-)/i.test(name))
        return { source: 'API set schema', note: /^ext-ms-/i.test(name) ? 'ext-ms 合约：仅提示；未验证本机 schema 是否提供。' : '按前缀交由系统 API set schema；未验证具体 host。' };
    const system = systemDirectory(architecture, roots);
    const isKnown = known.names.has(name.toLowerCase());
    const locations = isKnown ? [[system.directory, 'KnownDLLs → ' + system.source]] : [
        [roots.application, '应用目录'], [system.directory, system.source], [roots.system16, '16 位系统目录'], [roots.windows, 'Windows 目录'], [roots.current, '当前目录'], ...roots.path.map(v => [v, 'PATH']),
    ];
    for (const [directory, source] of locations) {
        safeLocalPath(directory);
        const file = path.join(directory, name);
        try {
            if ((await stat(file)).isFile())
                return { file, source };
        }
        catch (error) {
            if (!['ENOENT', 'ENOTDIR'].includes(error.code || ''))
                return { source, note: '搜索位置不可读取，无法确认是否缺失。' };
        }
    }
    return { source: isKnown ? 'KnownDLLs' : '未找到', note: isKnown ? 'KnownDLLs 系统副本不存在；不回退应用目录。' : undefined };
}
export function suggestions(rows, managed) {
    const result = new Set();
    for (const row of rows) {
        if (row.status === 'mismatch')
            result.add('架构不匹配：使用与目标程序相同架构的 DLL 或重新安装对应版本；不要覆盖系统 DLL。');
        if (row.status !== 'missing')
            continue;
        if (/^(vcruntime140.*|msvcp140.*|concrt140|vccorlib140)\.dll$/i.test(row.name))
            result.add('建议安装与目标架构对应的 Microsoft Visual C++ 2015-2022 Redistributable。');
        else if (/^(d3dx9_.*|xinput1_3|d3dcompiler_43|xaudio2_7)\.dll$/i.test(row.name))
            result.add('建议安装 DirectX 最终用户运行时（旧版组件）。');
        else if (/^(mscoree|mscorwks|clr|hostfxr|hostpolicy)\.dll$/i.test(row.name))
            result.add('检查程序要求的 .NET Framework / .NET Desktop Runtime 版本及架构。');
        else
            result.add('优先修复或重装原软件及官方依赖；不要从随机 DLL 下载站复制文件。');
    }
    if (managed)
        result.add('检测到 CLR 目录：本报告未检查托管程序集、AnyCPU 或 .NET 运行时版本。');
    return [...result];
}
/** Avoid executing the analyzed file even when it is itself a configured/system helper. */
function protectTarget(run, target) {
    return async (argv, signal) => {
        signal?.throwIfAborted();
        if (path.resolve(argv[0]).toLowerCase() === path.resolve(target).toLowerCase())
            throw new Error('禁止将分析目标作为助手执行。');
        try {
            const helperPath = await realpath(argv[0]), targetReal = await realpath(target);
            safeLocalPath(helperPath);
            if (helperPath.toLowerCase() === targetReal.toLowerCase())
                throw new Error('禁止将分析目标作为助手执行。');
            const [helper, selected] = await Promise.all([stat(helperPath), stat(targetReal)]);
            if (helper.ino !== 0 && helper.dev === selected.dev && helper.ino === selected.ino)
                throw new Error('禁止将分析目标的硬链接作为助手执行。');
        }
        catch (error) {
            // A missing helper is left to the subprocess provider; no target alias exists there.
            if (error.code !== 'ENOENT')
                throw error;
        }
        signal?.throwIfAborted();
        return run(argv, signal);
    };
}
export async function analyze(input, options) {
    if ((options.platform ?? process.platform) !== 'win32')
        throw new Error('暂不支持（仅 Windows）。');
    const signal = options.signal;
    signal?.throwIfAborted();
    const depth = options.depth ?? 1, max = options.maxDependencies ?? 256;
    if (!Number.isInteger(depth) || depth < 1 || depth > 3 || !Number.isInteger(max) || max < 1 || max > 512)
        throw new Error('depth 必须为 1–3，总数上限必须为 1–512。');
    const file = targetPath(input, options.cwd), budget = { remaining: 256 * 1024 * 1024 };
    const root = await readPE(file, signal, budget);
    const roots = options.roots ?? systemRoots(file, options.cwd);
    const run = options.run ? protectTarget(options.run, file) : undefined;
    const known = options.known ?? (run ? await knownDLLs(run, roots.windows, signal) : { names: new Set(FALLBACK_KNOWN), source: 'fallback' });
    const report = { target: file, architecture: root.architecture, managed: root.managed, dependencies: [], knownSource: known.source, warnings: [], suggestions: [], limited: false };
    if (known.source === 'fallback')
        report.warnings.push('KnownDLLs 注册表未读取成功，使用内置常见列表（可能不完整）。');
    const queue = [{ file, pe: root, level: 1 }];
    const visited = new Set([file.toLowerCase()]);
    for (let index = 0; index < queue.length; index++) {
        const parent = queue[index];
        for (const imported of parent.pe.imports) {
            signal?.throwIfAborted();
            if (report.dependencies.length >= max) {
                report.limited = true;
                break;
            }
            const resolution = await resolveDLL(imported.name, root.architecture, roots, known);
            const row = { ...resolution, ...imported, parent: parent.file, depth: parent.level, status: resolution.source === 'API set schema' ? 'api-set' : resolution.file ? 'found' : resolution.note?.includes('不可读取') ? 'unreadable' : 'missing' };
            report.dependencies.push(row);
            if (resolution.file) {
                try {
                    const pe = await readPE(resolution.file, signal, budget);
                    row.architecture = pe.architecture;
                    if (pe.architecture !== root.architecture)
                        row.status = 'mismatch';
                    const key = resolution.file.toLowerCase();
                    if (parent.level < depth && row.status === 'found' && !visited.has(key)) {
                        visited.add(key);
                        queue.push({ file: resolution.file, pe, level: parent.level + 1 });
                    }
                }
                catch {
                    signal?.throwIfAborted();
                    row.status = 'unreadable';
                    row.note = '无法解析 PE（格式、权限或读取上限）；未继续递归。';
                }
            }
        }
        if (report.limited)
            break;
    }
    if (report.limited)
        report.warnings.push('达到依赖总数上限，报告不完整。');
    if (options.dependenciesExe) {
        if (!run)
            report.warnings.push('Dependencies 补充不可用：没有 subprocess 服务。');
        else
            try {
                report.supplement = await supplement(run, options.dependenciesExe, file, signal);
            }
            catch {
                signal?.throwIfAborted();
                report.warnings.push('Dependencies 补充失败（路径、超时、输出限制或格式）；核心结果保留。');
            }
    }
    report.suggestions = suggestions(report.dependencies, root.managed);
    return report;
}
export function render(report) {
    const clean = (s) => s.replace(/[\x00-\x1f\x7f]/g, ' ').replace(/[`<>]/g, '');
    return [
        `DLL 诊断：${clean(report.target)}\n目标架构：${report.architecture}\nKnownDLLs：${report.knownSource === 'registry' ? '注册表' : '内置回退'}\n依赖记录：${report.dependencies.length}`,
        ...report.dependencies.map(r => `[${r.depth} 层${r.delay ? ' / 延迟' : ''}] ${clean(r.name)}：${({ found: '找到', missing: '缺失', 'api-set': '系统 API set', mismatch: '架构不匹配', unreadable: '无法确认' })[r.status]}；${r.source}${r.file ? '；' + clean(r.file) : ''}${r.architecture ? '；' + r.architecture : ''}${r.note ? '；' + r.note : ''}${r.depth > 1 ? '；引用自 ' + clean(r.parent) : ''}`),
        ...report.warnings, ...report.suggestions,
        ...(report.supplement ? ['Dependencies 补充导入名称：' + (report.supplement.map(clean).join(', ') || '无') + '（不覆盖核心结果）'] : []),
        '限制：静态依赖推断；延迟导入缺失可能只影响特定功能。未检查动态 LoadLibrary、SxS manifest、导出符号或实际启动行为。',
    ].join('\n');
}
