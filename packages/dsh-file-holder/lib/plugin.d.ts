import type { Context } from '@deepseek-ai/cordis';
import { type Observation } from './query.js';
export declare const name = "file-holder";
export declare const inject: string[];
export declare function formatObservation(result: Observation, file: string): string;
export declare function apply(ctx: Context): void;
