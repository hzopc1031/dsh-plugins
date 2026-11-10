/** rc.5 official bash foreground canonical DTO only; output text is untrusted. */
export declare function bashFailure(name: string, value: unknown): string | undefined;
export declare function callStatus(name: string, result: {
    isError?: boolean;
    value?: unknown;
}): 'success' | 'failure' | 'pending' | 'unknown';
