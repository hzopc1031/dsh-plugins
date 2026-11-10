export interface NotifyCommand {
    command: string;
    args: string[];
}
/** Pure: which program to run on a platform; undefined when unsupported. */
export declare function notifyCommand(platform: NodeJS.Platform): NotifyCommand | undefined;
/** Fire and forget; every failure is swallowed and reported through `onError`. */
export declare function systemNotify(title: string, body: string, onError: (message: string) => void, platform?: NodeJS.Platform): void;
