/** All public/persistent/model-bound strings pass this boundary. No raw exception text. */
export declare class SafeText {
    #private;
    constructor(env?: NodeJS.ProcessEnv);
    add(value?: string): void;
    text(input: string): string;
    value<T>(value: T): T;
}
export declare function md(text: string): string;
