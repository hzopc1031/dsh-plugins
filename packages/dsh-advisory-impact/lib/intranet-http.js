// Vendored identically in apache-radar, advisory-impact and github-triage; keep these copies in sync.
import { readFile } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { rootCertificates, connect as tlsConnect } from 'node:tls';
import { lookup } from 'node:dns/promises';
import { connect } from 'node:net';
import z from '@deepseek-ai/schemastery';
import { systemProxy, createSystemProxy } from './system-proxy.js';
import { isIP } from 'node:net';
export const API_TLS_SKIP_LABEL = '不安全：仅跳过 OSV / GitHub API 证书校验';
export const WEAK_CA_HINT = `公司网络的 HTTPS 拦截证书密钥太短，无法通过 OpenSSL 3 校验；导入 CA 证书解决不了。可在插件设置中开启「${API_TLS_SKIP_LABEL}」（仅限 api.osv.dev / api.github.com）。`;
export const NETWORK_HINT = '可能是公司代理或网络拦截，可在插件设置里填写 HTTPS 代理，或把 HTTPS_PROXY 写入 %USERPROFILE%\\.dsh\\.env 后完全退出并重开 DSH';
const CERT_HINT = '可能是公司 HTTPS 解密证书，请设置 NODE_EXTRA_CA_CERTS 指向公司根证书 PEM，或在插件设置里填写 CA 证书路径';
export function describeNetworkError(error, _url) {
    const seen = new Set(), pending = [error];
    let code = '', status = '', timeout = false, weakKey = false;
    while (pending.length && seen.size < 32) {
        const value = pending.shift();
        if (!value || typeof value !== 'object' || seen.has(value))
            continue;
        seen.add(value);
        const e = value;
        weakKey ||= e.code === 67 || e.verifyCode === 67 || /(?:CA|EE|TLS)(?:_CERTIFICATE)?_KEY_TOO_(?:SMALL|WEAK)|key too (?:small|weak)|verify error\s*[:=]?\s*(?:num\s*=\s*)?67\b|verify return code:\s*67\b/i.test(`${e.code ?? ''} ${e.message ?? ''}`);
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
        pending.push(e.cause, ...(Array.isArray(e.errors) ? e.errors.slice(0, 32) : []));
    }
    if (weakKey)
        return { code: 'TLS_KEY_TOO_SMALL', message: 'TLS_KEY_TOO_SMALL · 请求未完成', hintZh: WEAK_CA_HINT };
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
                && /fetch failed|NETWORK_ERROR|ECONN|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|UND_ERR_|CERT|SIGNATURE|ISSUER|KEY_TOO_(?:SMALL|WEAK)|key too (?:small|weak)|verify error.*67|HTTP[ _]\d{3}/i.test(item)) {
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
export function effectiveTimeout(settings = {}) {
    const n = settings.timeoutSeconds;
    return typeof n === 'number' && Number.isFinite(n) ? Math.round(Math.max(10, Math.min(120, n)) * 1000) : 30_000;
}
export async function fetchOfficial(fetcher, input, init, hosts) {
    let url = input;
    const seen = new Set([url]);
    for (let hop = 0;; hop++) {
        const response = await fetcher(url, { ...init, redirect: 'manual', credentials: 'omit' });
        if (![301, 302, 303, 307, 308].includes(response.status))
            return response;
        const location = response.headers.get('location');
        await response.body?.cancel();
        let next;
        try {
            next = new URL(location ?? '', url);
        }
        catch {
            throw new Error('REDIRECT_BLOCKED · 重定向地址无效');
        }
        // Validate every hop before sending another anonymous request; never widen the source host list.
        if (!location || next.protocol !== 'https:' || next.username || next.password || next.port || isIP(next.hostname.replace(/^\[|\]$/g, '')) || !hosts.has(next.hostname)) {
            throw new Error('REDIRECT_BLOCKED · 重定向不在官方 HTTPS 来源白名单，请核对原文地址');
        }
        next.hash = '';
        if (seen.has(next.href))
            throw new Error('REDIRECT_LOOP · 官方来源重定向循环');
        if (hop >= 5)
            throw new Error('REDIRECT_LIMIT · 官方来源重定向超过 5 次');
        seen.add(next.href);
        url = next.href;
    }
}
export function createIntranetHttp(settings = {}, env = process.env, dependencies, transport) {
    const envValue = (name) => env[name.toLowerCase()] ?? env[name] ?? Object.entries(env).find(([key]) => key.toUpperCase() === name)?.[1];
    const detector = dependencies ? createSystemProxy(dependencies) : systemProxy;
    const explicit = () => !!(settings.httpsProxy || envValue('HTTPS_PROXY') || envValue('HTTP_PROXY') || envValue('ALL_PROXY'));
    let lastDetection;
    let automaticUsed = false;
    if (settings.caBundlePath && !isAbsolute(settings.caBundlePath))
        throw new Error('CA 证书路径必须是绝对路径');
    if (settings.insecureSkipTlsVerify !== undefined && typeof settings.insecureSkipTlsVerify !== 'boolean')
        throw new Error('不安全 TLS 选项必须是布尔值');
    const apiSkipEnabled = () => {
        const setting = settings.insecureSkipTlsVerifyHosts;
        const value = setting && typeof setting === 'object' && 'get' in setting && typeof setting.get === 'function' ? setting.get() : setting === undefined ? false : setting;
        if (typeof value !== 'boolean')
            throw new Error('按主机跳过 TLS 校验选项必须是布尔值');
        return value;
    };
    apiSkipEnabled();
    const skipVerification = (host, apiSkip = apiSkipEnabled()) => !!settings.insecureSkipTlsVerify || apiSkip && ['api.osv.dev', 'api.github.com'].includes(host);
    const proxyUrl = (value, secure = false) => {
        try {
            const url = new URL(value);
            if (!(url.protocol === 'http:' || secure && url.protocol === 'https:') || !url.hostname || url.hash || url.search || url.pathname !== '/')
                throw new Error();
            return url.href;
        }
        catch {
            throw new Error('HTTPS 代理必须是 http://host:port；不支持 SOCKS（地址已隐藏）');
        }
    };
    if (settings.httpsProxy)
        proxyUrl(settings.httpsProxy, true);
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
            return { proxy: proxyUrl(settings.httpsProxy, true), source: 'plugin setting' };
        for (const name of (url.protocol === 'https:' ? ['HTTPS_PROXY', 'HTTP_PROXY', 'ALL_PROXY'] : ['HTTP_PROXY', 'ALL_PROXY'])) {
            const value = envValue(name);
            if (value)
                return { proxy: proxyUrl(value, true), source: env[name.toLowerCase()] !== undefined ? name.toLowerCase() : name };
        }
        return { source: 'direct' };
    }
    const custom = !!(settings.httpsProxy || settings.noProxy !== undefined || settings.caBundlePath || settings.insecureSkipTlsVerify
        || envValue('HTTPS_PROXY') || envValue('HTTP_PROXY') || envValue('ALL_PROXY') || env.NODE_EXTRA_CA_CERTS);
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
    async function dispatcher(proxy) {
        if (closed)
            throw new Error('网络客户端已关闭');
        const apiSkip = apiSkipEnabled();
        const key = `${proxy ?? 'direct'}|${apiSkip}`;
        if (!agents.has(key))
            agents.set(key, (async () => {
                const { Agent, Client, Pool, ProxyAgent } = await import('undici');
                const proxyTls = { ca: await ca(), rejectUnauthorized: !settings.insecureSkipTlsVerify };
                // Choose TLS policy per origin, including redirects; the proxy's own TLS keeps its global policy.
                return new Agent({ factory(origin, options) {
                        const tls = { ca: proxyTls.ca, rejectUnauthorized: !skipVerification(new URL(origin).hostname, apiSkip) };
                        return proxy ? new ProxyAgent({ uri: proxy, requestTls: tls, proxyTls, clientFactory(proxyOrigin, proxyOptions) {
                                const connector = proxyOptions.connect;
                                return new Client(proxyOrigin, { ...proxyOptions, connect(options, callback) {
                                        // IP literals must not be sent in TLS SNI; certificate verification still checks the IP.
                                        const servername = options.servername?.replace(/^\[|\]$/g, '');
                                        connector({ ...options, servername: servername && isIP(servername) ? undefined : options.servername }, callback);
                                    } });
                            } }) : new Pool(origin, { ...options, connect: tls });
                    } });
            })());
        return agents.get(key);
    }
    async function detectProxy(url = 'https://projects.apache.org/json/foundation/chooser.json', refresh = false) {
        if (explicit() || settings.systemProxy === 'off')
            return { source: '未检测到', detectedAt: new Date().toISOString(), ttlSeconds: 1800,
                timeoutSeconds: effectiveTimeout(settings) / 1000, note: explicit() ? '已配置显式代理，保持原访问路径；未运行系统检测。' : 'systemProxy: off，未运行系统检测。' };
        if (refresh) {
            await detector.clear();
            automaticUsed = false;
        }
        const result = await detector.detect(url);
        lastDetection = { ...result.info, timeoutSeconds: effectiveTimeout(settings) / 1000 };
        return lastDetection;
    }
    async function resolveRoute(url) {
        const original = route(url);
        if (explicit() || settings.systemProxy === 'off' || original.source !== 'direct')
            return original;
        const result = await detector.detect(url);
        automaticUsed ||= !!result.proxy;
        lastDetection = { ...result.info, automatic: automaticUsed, timeoutSeconds: effectiveTimeout(settings) / 1000 };
        return result.proxy ? { proxy: result.proxy, source: result.info.source } : original;
    }
    const requestWithDispatcher = async (input, init) => {
        if (transport)
            return transport(input, init);
        // Use fetch and Dispatcher from the same Undici release.
        const { fetch: undiciFetch } = await import('undici');
        return undiciFetch(input, init);
    };
    const fetch = async (input, init) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        try {
            if (closed)
                throw new Error('网络客户端已关闭');
            const routing = await resolveRoute(url);
            try {
                return custom || apiSkipEnabled() || routing.proxy
                    ? await requestWithDispatcher(input, { ...init, dispatcher: await dispatcher(routing.proxy) })
                    : await (transport ?? globalThis.fetch)(input, init);
            }
            catch (error) {
                if (!routing.proxy || !['Windows PAC', '静态系统代理'].includes(routing.source))
                    throw error;
                if (lastDetection)
                    lastDetection.warning = '系统代理请求失败，已尝试原访问路径。';
                return custom || apiSkipEnabled()
                    ? await requestWithDispatcher(input, { ...init, dispatcher: await dispatcher(route(url).proxy) })
                    : await (transport ?? globalThis.fetch)(input, init);
            }
        }
        catch (cause) {
            const info = describeNetworkError(cause, url);
            throw Object.assign(new Error(`${info.message}；${info.hintZh}`, { cause }), { code: info.code });
        }
    };
    async function diagnose(url = 'https://projects.apache.org/json/foundation/chooser.json') {
        const target = new URL(url), routing = await resolveRoute(url);
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
                result.tls = { authorized: !skipVerification(target.hostname), status: res.status };
            }
            catch (error) {
                result.tls = { authorized: false, ...describeNetworkError(error) };
            }
        }
        else if (target.protocol === 'https:') {
            const certs = await ca();
            result.tls = await new Promise(resolve => {
                const socket = tlsConnect({ host, port: Number(target.port || 443), servername: isIP(host) ? undefined : host, ca: certs, rejectUnauthorized: !skipVerification(target.hostname), timeout: 5000 });
                socket.once('secureConnect', () => { resolve({ authorized: socket.authorized, code: socket.authorizationError || undefined }); socket.destroy(); });
                socket.once('timeout', () => { resolve({ authorized: false, code: 'ETIMEDOUT' }); socket.destroy(); });
                socket.once('error', error => { resolve({ authorized: false, ...describeNetworkError(error) }); socket.destroy(); });
            });
        }
        return { ...result, tlsVerification: { host: target.hostname, skipped: target.protocol === 'https:' && skipVerification(target.hostname) }, systemProxy: lastDetection, timeoutSeconds: effectiveTimeout(settings) / 1000 };
    }
    return { fetch, diagnose, detectProxy, proxyStatus: () => lastDetection && { ...lastDetection, automatic: automaticUsed }, route: (url) => ({ source: route(url).source, proxied: !!route(url).proxy }),
        async close() { if (closed)
            return; closed = true; await Promise.all([...agents.values()].map(async (pending) => { const agent = await pending.catch(() => undefined); await agent?.close(); })); } };
}
export const intranetConfig = {
    systemProxy: z.union(['auto', 'off']).default('auto').description('无显式代理时自动读取 Windows PAC / 系统代理；off 沿用原访问路径'),
    timeoutSeconds: z.union([z.number(), z.transform(z.any(), () => 30)]).default(30).description('请求超时秒数，限制为 10–120，默认 30 秒'),
    httpsProxy: z.string().description('可选 HTTP(S) 代理 URL；清空恢复自动检测，勿在日志中分享凭据'),
    noProxy: z.string().description('可选代理绕过列表，例如 localhost,127.0.0.1,.company.example'),
    caBundlePath: z.string().description('可选公司根证书 PEM 绝对路径，与 NODE_EXTRA_CA_CERTS 合并'),
    insecureSkipTlsVerify: z.boolean().default(false).description('不安全 / insecure：跳过 TLS 证书校验，仅在明确接受风险时开启'),
    insecureSkipTlsVerifyHosts: z.boolean().default(false).volatile().description(API_TLS_SKIP_LABEL),
};
