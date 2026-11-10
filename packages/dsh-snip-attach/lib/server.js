import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { capture, logError } from './capture.js';
export const ORIGIN = 'dsh-app://app';
export const TOKEN_TTL_MS = 600_000;
const TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export class ShotServer {
    options;
    server;
    pending = new Map();
    cleanups = new Set();
    closed = false;
    port = 0;
    run;
    log;
    constructor(options = {}) {
        this.options = options;
        this.run = options.run ?? capture;
        this.log = options.log ?? logError;
        this.server = createServer((req, res) => {
            void this.respond(req, res).catch(() => {
                this.log('HTTP response failed');
                if (!res.headersSent)
                    res.writeHead(500);
                res.end();
            });
        });
        this.server.on('error', () => { this.log('loopback server failed'); });
    }
    async listen() {
        if (this.closed)
            throw new Error('Screenshot server closed');
        await new Promise((resolve, reject) => {
            this.server.once('error', reject);
            this.server.listen(0, '127.0.0.1', () => {
                this.server.off('error', reject);
                if (this.closed) {
                    this.server.close();
                    reject(new Error('Screenshot server closed'));
                    return;
                }
                const address = this.server.address();
                if (!address || typeof address === 'string') {
                    reject(new Error('No loopback port'));
                    return;
                }
                this.port = address.port;
                resolve();
            });
        });
    }
    start() {
        if (this.closed || !this.port)
            throw new Error('截图服务尚未就绪。');
        if ([...this.pending.values()].some(row => !row.completed))
            throw new Error('已有截图正在等待，请完成或取消后重试。');
        const token = randomUUID();
        const file = join(this.options.directory ?? tmpdir(), `dsh-shot-${token}.png`);
        const job = this.run(file);
        const timer = setTimeout(() => { this.retire(token); }, this.options.ttlMs ?? TOKEN_TTL_MS);
        timer.unref();
        const row = { file, job, timer, claimed: false, completed: false };
        this.pending.set(token, row);
        void job.done.then(() => { row.completed = true; });
        return `http://127.0.0.1:${this.port}/shot/${token}`;
    }
    retire(token) {
        const row = this.pending.get(token);
        if (!row)
            return;
        this.pending.delete(token);
        clearTimeout(row.timer);
        if (!row.completed)
            row.job.cancel();
        const cleanup = rm(row.file, { force: true }).catch(() => { this.log('temporary file cleanup failed'); });
        this.cleanups.add(cleanup);
        void cleanup.finally(() => { this.cleanups.delete(cleanup); });
    }
    async respond(req, res) {
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Vary', 'Origin');
        // Origin is checked before lookup: foreign requests cannot burn a token.
        if (req.headers.origin !== ORIGIN) {
            res.writeHead(403).end();
            return;
        }
        res.setHeader('Access-Control-Allow-Origin', ORIGIN);
        const match = /^\/shot\/([^/?]+)$/.exec(req.url ?? '');
        const token = match?.[1] ?? '';
        if (!TOKEN.test(token) || !this.pending.has(token)) {
            res.writeHead(404).end();
            return;
        }
        if (req.method === 'OPTIONS') {
            res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
            res.writeHead(204).end();
            return;
        }
        if (req.method !== 'GET') {
            res.setHeader('Allow', 'GET, OPTIONS');
            res.writeHead(405).end();
            return;
        }
        const row = this.pending.get(token);
        if (row.claimed) {
            res.writeHead(404).end();
            return;
        }
        row.claimed = true; // Reserve before the first await; concurrent GETs cannot replay.
        const onClose = () => { this.retire(token); };
        res.once('close', onClose);
        try {
            const result = await row.job.done;
            if (res.destroyed)
                return;
            if (result !== 'success' || !this.pending.has(token)) {
                res.writeHead(204).end();
                return;
            }
            let bytes;
            try {
                bytes = await readFile(row.file);
                if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
                    throw new Error('Invalid PNG');
            }
            catch {
                this.log('capture file read failed');
                res.writeHead(204).end();
                return;
            }
            if (!res.destroyed)
                res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': bytes.length }).end(bytes);
        }
        finally {
            res.off('close', onClose);
            this.retire(token);
        }
    }
    async close() {
        this.closed = true;
        for (const token of this.pending.keys())
            this.retire(token);
        this.server.closeAllConnections();
        await new Promise(resolve => { this.server.close(() => { resolve(); }); });
        await Promise.all([...this.cleanups]);
    }
}
