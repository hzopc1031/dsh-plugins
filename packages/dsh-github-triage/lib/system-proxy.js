// Vendored identically in the three Node network plugins; check-compat enforces this.
import { execFile } from 'node:child_process';
import { lookup } from 'node:dns/promises';
import { networkInterfaces } from 'node:os';
import { Script, createContext } from 'node:vm';
import { request } from 'node:http';
import { request as secureRequest } from 'node:https';
import { mkdir, open, rename, rm } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';
export const SYSTEM_PROXY_TTL = 30 * 60 * 1000;
const MAX_PAC = 1024 * 1024;
const queryRegistry = () => new Promise((resolve, reject) => {
    execFile('reg.exe', ['query', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings'], { shell: false, windowsHide: true, timeout: 2000, maxBuffer: 64 * 1024 }, (error, stdout) => error ? reject(error) : resolve(stdout));
});
export async function readWindowsProxy(deps = {}) {
    if ((deps.platform ?? process.platform) !== 'win32')
        return {};
    const output = await (deps.query ?? queryRegistry)();
    const settings = {};
    for (const line of output.split(/\r?\n/)) {
        const match = /^\s*(AutoConfigURL|ProxyEnable|ProxyServer|ProxyOverride)\s+REG_(?:SZ|EXPAND_SZ|DWORD)\s+(.*?)\s*$/.exec(line);
        if (!match)
            continue;
        if (match[1] === 'ProxyEnable')
            settings.ProxyEnable = Number(match[2]);
        else
            settings[match[1]] = match[2];
    }
    return settings;
}
function pacUrl(input) {
    const url = new URL(input);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
        throw new Error('PAC 仅支持无凭据的 HTTP(S) 地址；不支持 file://');
    return url;
}
export function fetchPacDirect(input) {
    const url = pacUrl(input);
    // Native request with agent:false deliberately avoids DSH's global fetch proxy dispatcher.
    return new Promise((resolve, reject) => {
        const req = (url.protocol === 'https:' ? secureRequest : request)(url, { agent: false, headers: { Accept: 'application/x-ns-proxy-autoconfig, text/plain' } }, res => {
            if (res.statusCode !== 200) {
                res.destroy();
                reject(new Error('PAC 获取失败'));
                return;
            }
            const chunks = [];
            let size = 0;
            res.on('data', (chunk) => {
                size += chunk.length;
                if (size > MAX_PAC)
                    res.destroy(new Error('PAC 超过 1 MiB'));
                else
                    chunks.push(chunk);
            });
            res.on('error', reject);
            res.on('end', () => { try {
                resolve(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
            }
            catch (error) {
                reject(error);
            } });
        });
        const timer = setTimeout(() => req.destroy(new Error('PAC 获取超时')), 3000);
        req.on('error', reject);
        req.on('close', () => clearTimeout(timer));
        req.end();
    });
}
function bounded(work, ms) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('系统代理检测超时')), ms);
        work.then(resolve, reject).finally(() => clearTimeout(timer));
    });
}
export function displayProxy(input) {
    const url = new URL(input);
    url.username = '';
    url.password = '';
    return url.href;
}
function proxyEndpoint(value, protocol = 'http:') {
    try {
        if (!value || /[\s/#?]/.test(value) || !/:\d+$/.test(value))
            return undefined;
        const url = new URL(protocol + '//' + value);
        if (!url.hostname || Number(value.slice(value.lastIndexOf(':') + 1)) < 1 || Number(value.slice(value.lastIndexOf(':') + 1)) > 65535)
            return undefined;
        return url.href;
    }
    catch {
        return undefined;
    }
}
export function parsePacResult(result) {
    let socks = false;
    for (const entry of result.split(';')) {
        const parts = entry.trim().split(/\s+/);
        if (parts.length === 1 && parts[0]?.toUpperCase() === 'DIRECT')
            return {};
        if (parts.length !== 2)
            continue;
        const kind = parts[0].toUpperCase();
        if (/^SOCKS(?:4|5)?$/.test(kind)) {
            socks = true;
            continue;
        }
        if (!['PROXY', 'HTTP', 'HTTPS'].includes(kind))
            continue;
        const proxy = proxyEndpoint(parts[1], kind === 'HTTPS' ? 'https:' : 'http:');
        if (proxy)
            return { proxy };
    }
    if (socks)
        return { warning: 'DSH / 插件不支持 SOCKS 代理，已沿用原访问路径。' };
    throw new Error('PAC 返回值无可用的 HTTP 代理或 DIRECT');
}
// PAC is corporate network code. vm is NOT a security boundary against a determined attacker.
// Only serialized primitives enter the fresh context; size caps, deadlines and in-context coercion limit exposure.
const helpers = String.raw `
function isPlainHostName(h) { return !h.includes('.'); }
function dnsDomainIs(h,d) { return h.endsWith(d); }
function localHostOrDomainIs(h,d) { return h === d || isPlainHostName(h) && d.startsWith(h + '.'); }
function dnsDomainLevels(h) { return h.split('.').length - 1; }
function dnsResolve(h) { return h === targetHost ? targetAddress : null; }
function isResolvable(h) { return dnsResolve(h) !== null; }
function myIpAddress() { return localAddress; }
function convertAddr(ip) { const p = ip.split('.'); return p.length === 4 && p.every(x => /^\d+$/.test(x) && +x <= 255) ? p.reduce((v,x) => (v * 256 + +x) >>> 0,0) : null; }
function isInNet(h,p,m) { const ip = convertAddr(h) === null ? dnsResolve(h) : h; const a = ip && convertAddr(ip), b = convertAddr(p), mask = convertAddr(m); return a !== null && a !== false && b !== null && mask !== null && (a & mask) === (b & mask); }
function shExpMatch(s,p) { return new RegExp('^' + p.split('').map(c => c === '*' ? '.*' : c === '?' ? '.' : c.replace(/[\\^$+.[\]{}()|]/g,'\\$&')).join('') + '$').test(s); }
function range(v,a,b) { return a <= b ? v >= a && v <= b : v >= a || v <= b; }
function clockArgs(args) { const a = Array.from(args), utc = a[a.length-1] === 'GMT'; if (utc) a.pop(); const d = new Date(nowMs); return {a,d,get: p => d[(utc ? 'getUTC' : 'get') + p]()}; }
function weekdayRange() { const {a,get} = clockArgs(arguments), days = ['SUN','MON','TUE','WED','THU','FRI','SAT']; return a.length >= 1 && a.length <= 2 && a.every(x => days.includes(x)) && range(get('Day'),days.indexOf(a[0]),days.indexOf(a[1] || a[0])); }
function timeRange() { const {a,get} = clockArgs(arguments), s = get('Hours')*3600 + get('Minutes')*60 + get('Seconds'); if (!a.every(Number.isInteger)) return false; if (a.length === 1) return get('Hours') === a[0]; if (a.length === 2) return range(get('Hours'),a[0],a[1]); if (a.length === 4) return range(s,a[0]*3600+a[1]*60,a[2]*3600+a[3]*60+59); if (a.length === 6) return range(s,a[0]*3600+a[1]*60+a[2],a[3]*3600+a[4]*60+a[5]); return false; }
function dateRange() {
 const {a,get} = clockArgs(arguments), months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
 const month = x => months.indexOf(x), day = get('Date'), mon = get('Month'), year = get('FullYear');
 if (a.length === 1 || a.length === 2) { const x=a[0], y=a[a.length-1]; return typeof x === 'string' ? month(x)>=0 && month(y)>=0 && range(mon,month(x),month(y)) : Number.isInteger(x) && Number.isInteger(y) && range(x>31?year:day,x,y); }
 if (a.length === 4) { if (typeof a[0] === 'string') return month(a[0])>=0 && month(a[2])>=0 && range(year*12+mon,a[1]*12+month(a[0]),a[3]*12+month(a[2])); return month(a[1])>=0 && month(a[3])>=0 && range(mon*32+day,month(a[1])*32+a[0],month(a[3])*32+a[2]); }
 if (a.length === 6) return month(a[1])>=0 && month(a[4])>=0 && range(year*512+mon*32+day,a[2]*512+month(a[1])*32+a[0],a[5]*512+month(a[4])*32+a[3]);
 return false;
}
`;
export async function evaluatePac(script, input, deps = {}) {
    if (typeof script !== 'string' || Buffer.byteLength(script) > MAX_PAC)
        throw new Error('PAC 超过 1 MiB');
    const url = new URL(input);
    const resolver = deps.resolve ?? (async (host) => (await lookup(host, { family: 4 })).address);
    const address = await bounded(resolver(url.hostname), 1000).catch(() => null);
    const local = Object.values(networkInterfaces()).flat().find(i => i?.family === 'IPv4' && !i.internal)?.address ?? '127.0.0.1';
    const context = createContext(Object.create(null), { codeGeneration: { strings: false, wasm: false } });
    const vars = `const targetHost=${JSON.stringify(url.hostname)},targetAddress=${JSON.stringify(address)},localAddress=${JSON.stringify(local)},nowMs=${(deps.now ?? Date.now)()};`;
    new Script(vars + helpers + '\n' + script).runInContext(context, { timeout: 1000 });
    const result = new Script(`String(FindProxyForURL(${JSON.stringify(url.href)},${JSON.stringify(url.hostname)}))`).runInContext(context, { timeout: 1000 });
    if (typeof result !== 'string' || result.length > 8192)
        throw new Error('PAC 返回值无效');
    return parsePacResult(result);
}
export function createSystemProxy(deps = {}) {
    const now = deps.now ?? Date.now;
    let cached;
    let expires = 0;
    const file = deps.cacheDirectory ? join(deps.cacheDirectory, 'system-proxy-cache.json') : undefined;
    async function load() {
        const settings = await bounded((deps.readSettings ?? (() => readWindowsProxy(deps)))(), 2500);
        if (!settings || typeof settings !== 'object')
            throw new Error('系统代理设置无效');
        for (const key of ['AutoConfigURL', 'ProxyServer', 'ProxyOverride'])
            if (settings[key] !== undefined && (typeof settings[key] !== 'string' || settings[key].length > 16384))
                throw new Error('系统代理设置无效');
        const script = settings.AutoConfigURL ? await bounded((deps.fetchPac ?? fetchPacDirect)(pacUrl(settings.AutoConfigURL).href), 3500) : undefined;
        if (script !== undefined && (typeof script !== 'string' || Buffer.byteLength(script) > MAX_PAC))
            throw new Error('PAC 超过 1 MiB');
        const data = { settings, script, at: now() };
        // Cache only settings, never PAC code or proxy userinfo/query secrets on disk.
        if (file) {
            const safe = { ...settings, ProxyServer: settings.ProxyServer?.includes('@') ? undefined : settings.ProxyServer };
            if (safe.AutoConfigURL)
                safe.AutoConfigURL = new URL(safe.AutoConfigURL).origin + new URL(safe.AutoConfigURL).pathname;
            try {
                await mkdir(deps.cacheDirectory, { recursive: true });
                const temp = file + '.' + process.pid + '.tmp';
                const handle = await open(temp, 'wx', 0o600);
                try {
                    await handle.writeFile(JSON.stringify({ settings: safe, at: data.at, reusable: !settings.AutoConfigURL && !settings.ProxyServer?.includes('@') }));
                }
                finally {
                    await handle.close();
                }
                await rename(temp, file);
            }
            catch { /* Optional cache must never affect requests. */ }
        }
        return data;
    }
    async function settings() {
        if (!cached || now() >= expires) {
            expires = now() + SYSTEM_PROXY_TTL;
            cached = (async () => {
                if (file && (deps.readSettings || (deps.platform ?? process.platform) === 'win32')) {
                    try {
                        const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
                        let data;
                        try {
                            if ((await handle.stat()).size > 65536)
                                throw new Error();
                            data = JSON.parse(await handle.readFile('utf8'));
                        }
                        finally {
                            await handle.close();
                        }
                        if (data.reusable === true && typeof data.at === 'number' && data.at <= now() && now() - data.at < SYSTEM_PROXY_TTL && data.settings && !data.settings.AutoConfigURL) {
                            expires = data.at + SYSTEM_PROXY_TTL;
                            return { settings: data.settings, at: data.at };
                        }
                    }
                    catch { /* Re-read settings when cache is absent or invalid. */ }
                }
                return load();
            })();
        }
        return cached;
    }
    return {
        async clear() { cached = undefined; expires = 0; if (file)
            await rm(file, { force: true }).catch(() => { }); },
        async detect(input) {
            const info = { source: '未检测到', detectedAt: new Date(now()).toISOString(), ttlSeconds: SYSTEM_PROXY_TTL / 1000 };
            try {
                const data = await settings(), s = data.settings;
                info.detectedAt = new Date(data.at).toISOString();
                let result = {};
                if (s.AutoConfigURL) {
                    info.source = 'Windows PAC';
                    const display = pacUrl(s.AutoConfigURL);
                    info.pacUrl = display.origin + display.pathname;
                    result = await evaluatePac(data.script, input, deps);
                }
                else if (s.ProxyEnable === 1 && s.ProxyServer) {
                    info.source = '静态系统代理';
                    const url = new URL(input), host = url.hostname;
                    const bypass = (s.ProxyOverride ?? '').split(';').some(entry => entry.trim().toLowerCase() === '<local>' ? !host.includes('.') : entry.trim() && new RegExp('^' + entry.trim().split('*').map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$', 'i').test(host));
                    if (!bypass) {
                        const entries = s.ProxyServer.split(';').map(e => e.trim());
                        const value = entries.find(e => e.toLowerCase().startsWith(url.protocol.slice(0, -1) + '='))?.split('=')[1] ?? entries.find(e => !e.includes('='));
                        if (value) {
                            const proxy = proxyEndpoint(value);
                            if (!proxy)
                                throw new Error('静态系统代理格式不支持');
                            result = { proxy };
                        }
                    }
                }
                return { ...result, info: { ...info, ...(result.proxy ? { proxy: displayProxy(result.proxy) } : {}), ...(result.warning ? { warning: result.warning } : {}) } };
            }
            catch {
                return { info: { ...info, warning: '系统代理读取、PAC 获取或求值失败（可能是不支持的地址/返回值），已沿用原访问路径。' } };
            }
        },
    };
}
export const systemProxy = createSystemProxy();
