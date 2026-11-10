export interface Options {
    enabled: boolean;
    musicPath: string;
    volume: number;
    loop: boolean;
    autoplay: boolean;
}
export declare const defaults: Readonly<Options>;
export interface Boot extends Omit<Options, 'musicPath'> {
    musicUrl: string;
}
export declare function bootScript(value: Boot): string;
export declare function byteRange(header: string | undefined, size: number): [number, number] | null;
