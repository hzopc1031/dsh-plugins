import type { Context } from '@deepseek-ai/cordis';
import { type Judgment, type Model, type Settings } from './types.js';
export declare const outputJsonSchema: {
    oneOf: ({
        type: string;
        required: string[];
        additionalProperties: boolean;
        properties: {
            kind: {
                const: string;
            };
            type: {
                enum: string[];
            };
            real: {
                enum: string[];
            };
            worth: {
                enum: string[];
            };
            impact: {
                type: string;
            };
            severity: {
                type: string;
            };
            cost: {
                type: string;
            };
            priority: {
                enum: string[];
            };
            reason: {
                type: string;
            };
            evidence: {
                type: string;
                minItems: number;
                items: {
                    type: string;
                };
            };
            verdict?: undefined;
            risk?: undefined;
            suspicious?: undefined;
        };
    } | {
        type: string;
        required: string[];
        additionalProperties: boolean;
        properties: {
            kind: {
                const: string;
            };
            verdict: {
                enum: string[];
            };
            risk: {
                enum: string[];
            };
            suspicious: {
                type: string;
            };
            priority: {
                enum: string[];
            };
            reason: {
                type: string;
            };
            evidence: {
                type: string;
                minItems: number;
                items: {
                    type: string;
                };
            };
            type?: undefined;
            real?: undefined;
            worth?: undefined;
            impact?: undefined;
            severity?: undefined;
            cost?: undefined;
        };
    })[];
};
export declare function parseJudgment(input: string, kind: Judgment['kind']): Judgment;
export declare function dshModel(ctx: Context, config: Settings): Model | undefined;
