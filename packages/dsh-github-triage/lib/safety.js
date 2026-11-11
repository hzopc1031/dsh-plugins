/** All public/persistent/model-bound strings pass this boundary. No raw exception text. */
export class SafeText {
    #secrets = new Set();
    constructor(env = process.env) {
        for (const key of ['GH_TOKEN', 'GITHUB_TOKEN'])
            this.add(env[key]);
    }
    add(value) { if (value?.trim())
        this.#secrets.add(value.trim()); }
    text(input) {
        let value = input;
        for (const secret of this.#secrets)
            value = value.split(secret).join('[REDACTED]');
        return value.replace(/\b(?:github_pat_[\w]+|gh[pousr]_[\w]+)\b/g, '[REDACTED]')
            .replace(/(?:Bearer|token)\s+[A-Za-z0-9_.=-]{10,}/gi, '[REDACTED]')
            .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
    }
    value(value) {
        const walk = (v) => typeof v === 'string' ? this.text(v) :
            Array.isArray(v) ? v.map(walk) :
                v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [this.text(k), walk(x)])) : v;
        return walk(value);
    }
}
export function md(text) {
    return text.replace(/[\\\x60*_{}\[\]()<>!|#]/g, c => '\\' + c).replace(/[\r\n]/g, ' ');
}
