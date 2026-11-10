import { spawn } from 'node:child_process';
import { rm, appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
export function exitResult(code) {
    return code === 0 ? 'success' : code === 2 ? 'cancelled' : code === 6 ? 'save-failed' : 'failed';
}
// Do not log capabilities, file contents, user paths, or subprocess output.
export function logError(event) {
    void appendFile(join(tmpdir(), 'dsh-screenshot.log'), `${new Date().toISOString()} dsh-snip-attach: ${event}\n`).catch(() => { });
}
export function capture(file, options = {}) {
    const launch = options.spawn ?? spawn;
    const log = options.log ?? logError;
    let child;
    let settled = false;
    let cancelled = false;
    let timer;
    let finish;
    const done = new Promise(resolve => { finish = resolve; });
    const settle = (result) => {
        if (settled)
            return;
        settled = true;
        clearTimeout(timer);
        if (result !== 'success' && result !== 'cancelled')
            log(`capture ${result}`);
        finish(result);
    };
    const cancel = () => {
        cancelled = true;
        try {
            child?.kill();
        }
        catch {
            log('capture kill failed');
        }
        settle('timeout');
    };
    try {
        child = launch('powershell.exe', [
            '-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-File',
            fileURLToPath(new URL('../capture.ps1', import.meta.url)), '-OutFile', file,
        ], { windowsHide: true, stdio: 'ignore', shell: false });
        child.once('error', () => { settle('failed'); });
        child.once('close', code => {
            settle(exitResult(code));
            // A killed child may have completed a save just before exiting.
            if (cancelled)
                void rm(file, { force: true }).catch(() => { log('late file cleanup failed'); });
        });
        timer = setTimeout(cancel, options.timeoutMs ?? 150_000);
        timer.unref();
    }
    catch {
        settle('failed');
    }
    return { done, cancel };
}
