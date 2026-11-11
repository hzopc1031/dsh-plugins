export const SUPPORTED_VERSION = '0.2.1-rc.5';
export const STORAGE_PREFIX = 'dsh.conversation.';
function object(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
/** Exact boot release identity, never inferred from the draft's shape. */
export function requireVersion(boot) {
    const version = object(boot) && object(boot.release) ? boot.release.version : undefined;
    if (version !== SUPPORTED_VERSION && version !== '0.2.2-rc.1')
        throw new Error(`仅支持已核对的 DSH 0.2.1-rc.5 / 0.2.2-rc.1，当前 ${typeof version === 'string' ? version : '未知'}；已拒绝读取草稿。`);
}
/** Validate rc.5 semantic spans, but recover only their plain text projection. */
export function draftText(value) {
    if (typeof value === 'string')
        return value;
    if (!object(value) || typeof value.text !== 'string' || !Array.isArray(value.references))
        return undefined;
    const text = value.text;
    let end = 0;
    if (value.command !== undefined) {
        if (!object(value.command) || typeof value.command.token !== 'string')
            return undefined;
        const spelling = value.command.token.trimEnd();
        if (!/^\/\S/u.test(spelling) || !text.startsWith(spelling))
            return undefined;
        end = spelling.length;
    }
    for (const ref of value.references) {
        if (!object(ref) || typeof ref.source !== 'string' || typeof ref.ref !== 'string'
            || typeof ref.label !== 'string' || typeof ref.clipboardText !== 'string'
            || typeof ref.offset !== 'number' || !Number.isInteger(ref.offset) || ref.offset < end
            || typeof ref.length !== 'number' || !Number.isInteger(ref.length) || ref.length <= 0
            || ref.length !== ref.clipboardText.length
            || (ref.appearance !== undefined && !['session', 'file', 'folder'].includes(String(ref.appearance)))
            || (ref.invalid !== undefined && typeof ref.invalid !== 'boolean'))
            return undefined;
        end = ref.offset + ref.length;
        if (end > text.length || text.slice(ref.offset, end) !== ref.clipboardText)
            return undefined;
    }
    if (value.quotes !== undefined) {
        if (!Array.isArray(value.quotes))
            return undefined;
        for (const quote of value.quotes) {
            if (!object(quote) || typeof quote.text !== 'string' || !quote.text.trim()
                || !Number.isSafeInteger(quote.offset) || !Number.isSafeInteger(quote.length)
                || Number(quote.offset) < 0 || Number(quote.length) <= 0)
                return undefined;
            const projected = quote.text.replace(/\r\n?/gu, '\n').split('\n').map(line => `> ${line}`).join('\n');
            if (quote.length !== projected.length || text.slice(Number(quote.offset), Number(quote.offset) + Number(quote.length)) !== projected)
                return undefined;
        }
        let spanEnd = object(value.command) ? String(value.command.token).trimEnd().length : 0;
        for (const span of [...value.references, ...value.quotes].sort((a, b) => a.offset - b.offset)) {
            if (span.offset < spanEnd)
                return undefined;
            spanEnd = span.offset + span.length;
        }
    }
    return text;
}
/** Enumerate storage independently of session-list visibility; never writes or deletes. */
export function listDrafts(storage, boot) {
    requireVersion(boot); // Must precede every storage access, including length.
    const result = [];
    for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (!key?.startsWith(STORAGE_PREFIX) || key.length === STORAGE_PREFIX.length)
            continue;
        const raw = storage.getItem(key); // Storage permission errors are surfaced, not silently swallowed.
        if (raw === null)
            continue;
        let value;
        try {
            value = JSON.parse(raw);
        }
        catch {
            continue;
        }
        if (!object(value))
            continue;
        const text = draftText(value.draft);
        if (text?.trim())
            result.push({ sessionId: key.slice(STORAGE_PREFIX.length), text });
    }
    return result.sort((a, b) => a.sessionId.localeCompare(b.sessionId));
}
export function copyText(draft) { return draft.text; }
/** Append in detect coordinates (a reference chip counts as ONE character). */
export function prepareAppend(draft, input, currentSnapshot) {
    if (input.phase !== 'plain')
        throw new Error('当前输入框忙碌或处于命令模式，请回到普通输入后追加。');
    let quoteWidth = 0;
    if (currentSnapshot !== undefined) {
        if (!object(currentSnapshot) || draftText(currentSnapshot) !== input.draft)
            throw new Error('当前草稿快照与输入框不一致，请复制原文后粘贴。');
        quoteWidth = (currentSnapshot.quotes ?? []).reduce((sum, quote) => sum + quote.length - 1, 0);
    }
    const end = input.draft.length - quoteWidth - input.occurrences.reduce((sum, ref) => sum + ref.length - 1, 0);
    if (end < 0)
        throw new Error('输入框状态无效，请重试。');
    return {
        text: (input.draft ? '\n' : '') + copyText(draft),
        span: { start: end, end, draftRev: input.draftRev },
    };
}
