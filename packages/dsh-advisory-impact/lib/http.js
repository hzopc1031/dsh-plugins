import { setTimeout as delay } from 'node:timers/promises';
export const SOURCES = {
    kafka: 'https://kafka.apache.org/community/cve-list/',
    hadoop: 'https://hadoop.apache.org/cve_list.html',
    flink: 'https://security.apache.org/projects/flink/',
    flinkPointer: 'https://flink.apache.org/what-is-flink/security/',
    suppressions: 'https://raw.githubusercontent.com/apache/kafka/trunk/gradle/resources/dependencycheck-suppressions.xml',
    guidance: 'https://security.apache.org/report-dependency/',
};
export const USER_AGENT = 'dsh-advisory-impact/0.1.0 (https://github.com/hzopc1031/dsh-plugins)';
const allowed = new Set(Object.values(SOURCES));
export class SourceError extends Error {
    url;
    constructor(url, message, options) {
        super(`${message} (${url})`, options);
        this.url = url;
        this.name = 'SourceError';
    }
}
export function assertSourceUrl(url) {
    // Exact public endpoints also exclude credentials, login, reporter.apache.org and arbitrary redirects.
    if (!allowed.has(url))
        throw new Error('Only documented anonymous official source URLs are allowed');
}
async function readPayload(response, maxBytes) {
    if (!response.body)
        throw new Error('Empty response body');
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done)
                break;
            size += value.byteLength;
            if (size > maxBytes)
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
    return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
}
/** Serial anonymous GETs, one bounded 429 retry, no redirects or implicit live requests. */
export function createHttpClient(options = {}) {
    const fetch = options.fetch ?? globalThis.fetch;
    const now = options.now ?? (() => new Date());
    const sleep = options.sleep ?? delay;
    const timeoutMs = options.timeoutMs ?? 15_000;
    const maxBytes = options.maxBytes ?? 4 * 1024 * 1024;
    for (const n of [timeoutMs, maxBytes]) {
        if (!Number.isSafeInteger(n) || n <= 0)
            throw new Error('HTTP limits must be positive integers');
    }
    const request = async (url) => {
        assertSourceUrl(url);
        try {
            for (let attempt = 0; attempt < 2; attempt++) {
                const response = await fetch(url, {
                    method: 'GET', redirect: 'manual', credentials: 'omit',
                    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html, application/xml, text/xml, text/plain' },
                    signal: AbortSignal.timeout(timeoutMs),
                });
                if (response.status === 429 && attempt === 0) {
                    await response.body?.cancel();
                    const retry = response.headers.get('retry-after');
                    const ms = retry === null ? 1_000 : /^\d+$/.test(retry)
                        ? Number(retry) * 1_000 : Date.parse(retry) - now().getTime();
                    if (!Number.isFinite(ms) || ms > 60_000)
                        throw new Error('HTTP 429; retry later');
                    await sleep(Math.max(1_000, ms));
                    continue;
                }
                if (!response.ok) {
                    await response.body?.cancel();
                    throw new Error(`HTTP ${response.status}`);
                }
                const payload = await readPayload(response, maxBytes);
                if (!payload.trim())
                    throw new Error('Empty response body');
                return { url, payload, fetchedAt: now().toISOString() };
            }
            throw new Error('HTTP 429; retry later');
        }
        catch (error) {
            throw new SourceError(url, error instanceof Error ? error.message : 'Fetch failed', { cause: error });
        }
    };
    let pending = Promise.resolve();
    return url => {
        const result = pending.then(() => request(url));
        pending = result.catch(() => { });
        return result;
    };
}
