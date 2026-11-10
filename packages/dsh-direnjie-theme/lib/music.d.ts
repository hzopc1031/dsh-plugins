import type { IncomingMessage, ServerResponse } from 'node:http';
export declare const MAX_AUDIO_BYTES: number;
/** No URL parameters are used to select the file. */
export declare function serveMusic(path: string, req: IncomingMessage, res: ServerResponse): Promise<void>;
