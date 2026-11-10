export const FILE_SELECTOR = 'input[type="file"][hidden][multiple]';
export const FALLBACK = '图片已在剪贴板，可按 Ctrl+V';
/** Bound a remote call even if its transport never settles after unmount/timeout. */
export function abortable(work, signal) {
    return new Promise((resolve, reject) => {
        const abort = () => { reject(new Error('截图等待已结束。')); };
        const finish = (action) => { signal.removeEventListener('abort', abort); action(); };
        signal.addEventListener('abort', abort, { once: true });
        if (signal.aborted)
            abort();
        work.then(value => { finish(() => { resolve(value); }); }, error => { finish(() => { reject(error); }); });
    });
}
export function requireDesktop(boot, location) {
    const version = boot?.release?.version;
    if (version !== '0.2.1-rc.5' || location.protocol !== 'dsh-app:' || location.hostname !== 'app') {
        throw new Error('仅支持 DSH 0.2.1-rc.5 桌面页面。');
    }
}
export function shotUrl(text) {
    const match = /^截图就绪 (http:\/\/127\.0\.0\.1:(\d{1,5})\/shot\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/.exec(text ?? '');
    if (!match || Number(match[2]) < 1 || Number(match[2]) > 65535)
        throw new Error('截图服务返回了无效地址。');
    return match[1];
}
export function fileInputFor(button) {
    const card = button.closest('[data-composer-card]');
    const inputs = card?.querySelectorAll(FILE_SELECTOR);
    if (!button.isConnected || inputs?.length !== 1 || inputs[0].disabled)
        throw new Error(FALLBACK);
    return inputs[0];
}
export function injectFile(input, file) {
    if (!input.isConnected || input.disabled)
        throw new Error(FALLBACK);
    const owner = input.ownerDocument.defaultView;
    if (!owner)
        throw new Error(FALLBACK);
    const transfer = new owner.DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    input.dispatchEvent(new owner.Event('change', { bubbles: true }));
}
