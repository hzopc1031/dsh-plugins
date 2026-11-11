import * as React from 'react';
export declare const name = "advisory-impact";
export declare const inject: string[];
export declare function Panel(): React.JSX.Element;
interface ClientContext {
    effect(effect: () => () => void): unknown;
    slots: {
        inject(name: string, effect: () => () => void): unknown;
        register(options: Record<string, unknown>, component: (props: {
            size?: number;
        }) => React.ReactNode): () => void;
    };
}
export declare function apply(ctx: ClientContext): void;
export {};
