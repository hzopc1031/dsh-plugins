import { type CaptureRunner } from './capture.js';
export declare const ORIGIN = "dsh-app://app";
export declare const TOKEN_TTL_MS = 600000;
export declare class ShotServer {
    private readonly options;
    private readonly server;
    private readonly pending;
    private readonly cleanups;
    private closed;
    private port;
    private readonly run;
    private readonly log;
    constructor(options?: {
        run?: CaptureRunner;
        directory?: string;
        ttlMs?: number;
        log?: (event: string) => void;
    });
    listen(): Promise<void>;
    start(): string;
    private retire;
    private respond;
    close(): Promise<void>;
}
