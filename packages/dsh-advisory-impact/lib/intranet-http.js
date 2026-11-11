// Vendored identically in apache-radar, advisory-impact and github-triage; keep these copies in sync.
import { readFile } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { rootCertificates, connect as tlsConnect } from 'node:tls';
import { lookup } from 'node:dns/promises';
import { connect } from 'node:net';
import z from '@deepseek-ai/schemastery';
export const NETWORK_HINT = '可能是公司代理或网络拦截，可在插件设置里填写 HTTPS 代理，或把 HTTPS_PROXY 写入 %USERPROFILE%\\.dsh\\.env 后完全退出并重开 DSH';
const CERT_HINT = '可能是公司 HTTPS 解密证书，请设置 NODE_EXTRA_CA_CERTS 指向公司根证书 PEM，或在插件设置里填写 CA 证书路径';
export function describeNetworkError(error, _url) {
    const seen = new Set(), pending = [error];
    let code = '', status = '', timeout = false;
    while (pending.length) {
        const value = pending.shift();
        if (!value || typeof value !== 'object' || seen.has(value))
            continue;
        seen.add(value);
        const e = value;
        if (typeof e.code === 'string' && /^(?:E[A-Z0-9_]+|UND_ERR_[A-Z0-9_]+|CERT_[A-Z0-9_]+|[A-Z_]*(?:CERT|SIGNATURE|ISSUER)[A-Z_]*)$/.test(e.code))
            code = e.code;
        if (typeof e.status === 'number')
            status = `HTTP_${e.status}`;
        const embedded = e.message?.match(/\b(ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|UND_ERR_[A-Z_]+|UNABLE_TO_[A-Z_]+|SELF_SIGNED_CERT_IN_CHAIN|DEPTH_ZERO_SELF_SIGNED_CERT|CERT_HAS_EXPIRED|HTTP_\d{3})\b/);
        if (embedded && !code)
            code = embedded[1];
        const http = e.message?.match(/\bHTTP (\d{3})\b/);
        if (http)
            status = `HTTP_${http[1]}`;
        timeout ||= e.name === 'TimeoutError' || e.name === 'AbortError';
        pending.push(e.cause, ...(Array.isArray(e.errors) ? e.errors : []));
    }
    code ||= status || (timeout ? 'ETIMEDOUT' : 'NETWORK_ERROR');
    return { code, message: `${code} · 请求未完成`, hintZh: /CERT|SIGNATURE|ISSUER|SELF_SIGNED/.test(code) ? CERT_HINT : NETWORK_HINT };
}
export function collapseNetworkErrors(value) {
    const groups = new Map();
    const visit = (v, parentUrl = '') => {
        if (!v || typeof v !== 'object')
            return;
        const obj = v;
        const url = typeof obj.url === 'string' ? obj.url : parentUrl;
        for (const [key, item] of Object.entries(obj)) {
            if ((key === 'error' || key === 'cacheError') && typeof item === 'string'
                && /fetch failed|NETWORK_ERROR|ECONN|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|UND_ERR_|CERT|SIGNATURE|ISSUER|HTTP[ _]\d{3}/i.test(item)) {
                const { code } = describeNetworkError(new Error(item));
                const urls = item.match(/https?:\/\/[^\s;)]+/g);
                const identities = urls?.length ? urls : [url || item];
                if (!groups.has(code))
                    groups.set(code, new Set());
                for (const identity of identities)
                    groups.get(code).add(identity);
            }
            else
                visit(item, url);
        }
    };
    visit(value);
    return [...groups].map(([code, urls]) => ({ code, hintZh: describeNetworkError({ code }).hintZh, count: urls.size }));
}
export function createIntranetHttp(settings = {}, env = process.env) {
    const envValue = (name) => env[name.toLowerCase()] ?? env[name];
    if (settings.caBundlePath && !isAbsolute(settings.caBundlePath))
        throw new Error('CA 证书路径必须是绝对路径');
    if (settings.insecureSkipTlsVerify !== undefined && typeof settings.insecureSkipTlsVerify !== 'boolean')
        throw new Error('不安全 TLS 选项必须是布尔值');
    const proxyUrl = (value, secure = false) => {
        try {
            const url = new URL(value);
            if (!(url.protocol === 'http:' || secure && url.protocol === 'https:') || !url.hostname || url.hash || url.search || url.pathname !== '/')
                throw new Error();
            return url.href;
        }
        catch {
            throw new Error('HTTPS 代理必须是 http://host:port；不支持 SOCKS 或 PAC（地址已隐藏）');
        }
    };
    if (settings.httpsProxy)
        proxyUrl(settings.httpsProxy);
    function route(input) {
        const url = new URL(input);
        const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
        const port = url.port || (url.protocol === 'https:' ? '443' : '80');
        const bypass = (settings.noProxy ?? envValue('NO_PROXY') ?? '').split(/[\s,]+/).filter(Boolean).some(entry => {
            if (entry === '*')
                return true;
            const match = /^(.*?)(?::(\d+))?$/.exec(entry.toLowerCase());
            const target = match[1].replace(/^\*?\./, '');
            return (!match[2] || match[2] === port) && (host === target || host.endsWith('.' + target));
        }) || host === 'localhost' || host.endsWith('.localhost') || host === '::1' || /^127\./.test(host);
        if (bypass)
            return { source: 'direct (NO_PROXY / loopback)' };
        if (url.protocol === 'https:' && settings.httpsProxy)
            return { proxy: proxyUrl(settings.httpsProxy), source: 'plugin setting' };
        for (const name of [url.protocol === 'https:' ? 'HTTPS_PROXY' : 'HTTP_PROXY', 'ALL_PROXY']) {
            const value = envValue(name);
            if (value)
                return { proxy: proxyUrl(value, true), source: env[name.toLowerCase()] !== undefined ? name.toLowerCase() : name };
        }
        return { source: 'direct' };
    }
    const custom = !!(settings.httpsProxy || settings.noProxy !== undefined || settings.caBundlePath || settings.insecureSkipTlsVerify);
    const agents = new Map();
    let closed = false;
    let certificates;
    const ca = () => certificates ??= (async () => {
        const paths = [...new Set([env.NODE_EXTRA_CA_CERTS, settings.caBundlePath].filter((p) => !!p))];
        if (!paths.length)
            return undefined;
        const extra = [];
        for (const path of paths) {
            try {
                const pem = await readFile(path, 'utf8');
                if (!pem.includes('-----BEGIN CERTIFICATE-----'))
                    throw new Error();
                extra.push(pem);
            }
            catch {
                throw Object.assign(new Error('无法读取 CA 证书 PEM；请检查路径、文件内容和权限（内容已隐藏）'), { code: 'CERT_BUNDLE_INVALID' });
            }
        }
        return [...rootCertificates, ...extra];
    })();
    async function dispatcher(input) {
        if (closed)
            throw new Error('网络客户端已关闭');
        const { proxy } = route(input);
        const key = proxy ?? 'direct';
        if (!agents.has(key))
            agents.set(key, (async () => {
                const { Agent, ProxyAgent } = await import('undici');
                const tls = { ca: await ca(), rejectUnauthorized: !settings.insecureSkipTlsVerify };
                return proxy ? new ProxyAgent({ uri: proxy, requestTls: tls, proxyTls: tls }) : new Agent({ connect: tls });
            })());
        return agents.get(key);
    }
    const fetch = async (input, init) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        try {
            if (closed)
                throw new Error('网络客户端已关闭');
            return await globalThis.fetch(input, custom ? { ...init, dispatcher: await dispatcher(url) } : init);
        }
        catch (cause) {
            const info = describeNetworkError(cause, url);
            throw Object.assign(new Error(`${info.message}；${info.hintZh}`, { cause }), { code: info.code });
        }
    };
    async function diagnose(url = 'https://projects.apache.org/json/foundation/chooser.json') {
        const target = new URL(url), routing = route(url);
        if (!['https:', 'http:'].includes(target.protocol) || target.username || target.password)
            throw new Error('无效诊断地址');
        const probe = routing.proxy ? new URL(routing.proxy) : target;
        const host = probe.hostname.replace(/^\[|\]$/g, '');
        const result = {
            proxy: routing.source, probes: routing.proxy ? 'DNS/TCP 检查代理；TLS 通过代理请求官方地址' : '直接检查目标 DNS/TCP/TLS', dns: null, tcp: null, tls: null,
        };
        try {
            result.dns = (await lookup(host, { all: true })).map(r => ({ address: r.address, family: r.family }));
        }
        catch (error) {
            result.dns = describeNetworkError(error).code;
        }
        result.tcp = await new Promise(resolve => {
            const socket = connect({ host, port: Number(probe.port || (probe.protocol === 'https:' ? 443 : 80)), timeout: 5000 });
            socket.once('connect', () => { resolve('connected'); socket.destroy(); });
            socket.once('timeout', () => { resolve('ETIMEDOUT'); socket.destroy(); });
            socket.once('error', error => { resolve(describeNetworkError(error).code); socket.destroy(); });
        });
        if (routing.proxy) {
            try {
                const res = await fetch(url, { method: 'HEAD', redirect: 'error', signal: AbortSignal.timeout(8000) });
                await res.body?.cancel();
                result.tls = { authorized: !settings.insecureSkipTlsVerify, status: res.status };
            }
            catch (error) {
                result.tls = { authorized: false, code: describeNetworkError(error).code };
            }
        }
        else if (target.protocol === 'https:') {
            const certs = await ca();
            result.tls = await new Promise(resolve => {
                const socket = tlsConnect({ host, port: Number(target.port || 443), servername: host, ca: certs, rejectUnauthorized: !settings.insecureSkipTlsVerify, timeout: 5000 });
                socket.once('secureConnect', () => { resolve({ authorized: socket.authorized, code: socket.authorizationError || undefined }); socket.destroy(); });
                socket.once('timeout', () => { resolve({ authorized: false, code: 'ETIMEDOUT' }); socket.destroy(); });
                socket.once('error', error => { resolve({ authorized: false, code: describeNetworkError(error).code }); socket.destroy(); });
            });
        }
        return result;
    }
    return { fetch, diagnose, route: (url) => ({ source: route(url).source, proxied: !!route(url).proxy }),
        async close() { if (closed)
            return; closed = true; await Promise.all([...agents.values()].map(async (pending) => { const agent = await pending.catch(() => undefined); await agent?.close(); })); } };
}
export const intranetConfig = {
    httpsProxy: z.string().description('可选 HTTPS 代理，使用 http://host:port；不支持 SOCKS / PAC，勿在日志中分享凭据'),
    noProxy: z.string().description('可选代理绕过列表，例如 localhost,127.0.0.1,.company.example'),
    caBundlePath: z.string().description('可选公司根证书 PEM 绝对路径，与 NODE_EXTRA_CA_CERTS 合并'),
    insecureSkipTlsVerify: z.boolean().default(false).description('不安全 / insecure：跳过 TLS 证书校验，仅在明确接受风险时开启'),
};
