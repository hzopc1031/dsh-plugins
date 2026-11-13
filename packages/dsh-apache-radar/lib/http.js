import { createIntranetHttp, describeNetworkError, effectiveTimeout, fetchOfficial } from './intranet-http.js';
import { SOURCES as ADVISORY_SOURCES, osvUrl } from './advisory/http.js';
import { setTimeout as delay } from 'node:timers/promises';
export const USER_AGENT = 'dsh-apache-radar/0.1.5 (+https://github.com/hzopc1031/dsh-plugins)';
const hosts = new Set(['projects.apache.org', 'whimsy.apache.org', 'attic.apache.org',
    'incubator.apache.org', 'kafka.apache.org', 'svn.apache.org', 'issues.apache.org', 'cwiki.apache.org',
    'release-catalog.apache.org', 'www.apache.org', 'apache.org']);
export function publicSourceUrl(input) {
    const url = new URL(input);
    if (url.hostname === 'reporter.apache.org' || url.hostname.endsWith('.reporter.apache.org')) {
        throw new Error('reporter.apache.org is forbidden');
    }
    const advisory = Object.values(ADVISORY_SOURCES).includes(input)
        || (url.hostname === 'api.osv.dev' && input.startsWith('https://api.osv.dev/v1/vulns/') && osvUrl(input.slice('https://api.osv.dev/v1/vulns/'.length)) === input);
    if (advisory)
        return input;
    if (url.protocol !== 'https:' || !hosts.has(url.hostname) || url.username || url.password || url.port) {
        throw new Error('Only documented public ASF HTTPS hosts are allowed');
    }
    return url.href;
}
export class HttpError extends Error {
    url;
    status;
    retryAt;
    constructor(url, status, retryAt) {
        super(`HTTP ${status}: ${url}${retryAt ? `; back off until ${retryAt}` : ''}`);
        this.url = url;
        this.status = status;
        this.retryAt = retryAt;
    }
}
export function createHttpClient(options = {}) {
    const network = createIntranetHttp(options);
    const fetcher = options.fetch ?? network.fetch;
    const now = options.now ?? (() => new Date());
    const sleep = options.sleep ?? delay;
    const timeoutMs = options.timeoutMs ?? effectiveTimeout(options);
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0)
        throw new Error('Invalid HTTP timeout');
    let queue = Promise.resolve();
    let blockedUntil = 0;
    const client = input => {
        const url = publicSourceUrl(input);
        const request = queue.then(async () => {
            const remaining = blockedUntil - now().getTime();
            if (remaining > 0)
                await sleep(remaining);
            try {
                const response = await fetchOfficial(fetcher, url, {
                    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json, text/html, application/xml;q=0.9' },
                    signal: AbortSignal.timeout(timeoutMs), redirect: 'manual', credentials: 'omit',
                }, new Set([...hosts, ...Object.values(ADVISORY_SOURCES).map(url => new URL(url).hostname), 'api.osv.dev']));
                const osvNotIndexed = url.startsWith('https://api.osv.dev/v1/vulns/') && response.status === 404;
                if (!response.ok && !osvNotIndexed) {
                    if (response.status === 429) {
                        const retry = response.headers.get('retry-after');
                        const until = retry && /^\d+$/.test(retry)
                            ? now().getTime() + Number(retry) * 1000 : Date.parse(retry ?? '');
                        blockedUntil = Math.max(now().getTime() + 1000, Number.isFinite(new Date(until).getTime()) ? until : now().getTime() + 60_000);
                    }
                    await response.body?.cancel();
                    throw new HttpError(url, response.status, response.status === 429 ? new Date(blockedUntil).toISOString() : undefined);
                }
                if (osvNotIndexed && !response.body)
                    return { url, fetchedAt: now().toISOString(), payload: '', status: 404 };
                const reader = response.body?.getReader();
                if (!reader)
                    throw new Error('Empty response body');
                const chunks = [];
                let bytes = 0;
                try {
                    for (;;) {
                        const { done, value } = await reader.read();
                        if (done)
                            break;
                        bytes += value.byteLength;
                        if (bytes > 8 * 1024 * 1024)
                            throw new Error('Response exceeds size limit');
                        chunks.push(value);
                    }
                }
                catch (error) {
                    await reader.cancel().catch(() => { });
                    throw error;
                }
                finally {
                    reader.releaseLock();
                }
                const payload = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
                return { url, fetchedAt: now().toISOString(), payload, ...(url.startsWith('https://api.osv.dev/') ? { status: response.status } : {}) };
            }
            catch (cause) {
                if (cause instanceof HttpError)
                    throw cause;
                const info = describeNetworkError(cause);
                const detail = cause instanceof Error ? cause.message : 'fetch failed';
                const hint = !detail.includes(info.hintZh) && (info.code !== 'NETWORK_ERROR' || /fetch failed/i.test(detail)) ? `；${info.code}；${info.hintZh}` : '';
                throw new Error(`Fetch failed: ${url}: ${detail}${hint}`, { cause });
            }
        });
        queue = request.catch(() => { });
        return request;
    };
    return Object.assign(client, { close: network.close, diagnose: network.diagnose, detectProxy: network.detectProxy, proxyStatus: network.proxyStatus });
}
