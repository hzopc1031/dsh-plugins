import type { Context } from '@deepseek-ai/cordis';
import { type Reply, type RouteName } from './ui-contract.js';
/** Local structural face, verified against both official tags; no new package. */
export interface ConnectionFace {
    fetch?: {
        register(route: {
            path: string;
            methods: readonly ['POST'];
            requestBody: 'buffered';
            fetch: (request: Request) => Promise<Response>;
        }): () => Promise<void> | void;
    };
}
type Service = (input: unknown) => Promise<Reply>;
export declare function routeHandler(name: RouteName, service: Service): (request: Request) => Promise<Response>;
export declare function mountRoutes(ctx: Context, service: Service): void;
export {};
