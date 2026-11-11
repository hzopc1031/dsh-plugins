// Source identities ported from dsh-advisory-impact (hzopc1031, MIT); transport is shared with Radar.
export const SOURCES = {
    kafka: 'https://kafka.apache.org/community/cve-list/',
    hadoop: 'https://hadoop.apache.org/cve_list.html',
    flink: 'https://security.apache.org/projects/flink/',
    flinkPointer: 'https://flink.apache.org/what-is-flink/security/',
    suppressions: 'https://raw.githubusercontent.com/apache/kafka/trunk/gradle/resources/dependencycheck-suppressions.xml',
    guidance: 'https://security.apache.org/report-dependency/',
};
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
export const OSV_ID = /^(?:CVE-\d{4}-\d{4,}|GHSA-[23456789cfghjmpqrvwx]{4}-[23456789cfghjmpqrvwx]{4}-[23456789cfghjmpqrvwx]{4})$/;
export function osvUrl(id) {
    if (!OSV_ID.test(id))
        throw new Error('Invalid CVE/GHSA id');
    return `https://api.osv.dev/v1/vulns/${id}`;
}
