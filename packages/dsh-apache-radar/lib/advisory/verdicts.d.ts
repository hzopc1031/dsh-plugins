import type { Advisory, AdvisoryPage, ProjectVerdicts, SuppressionPage, VersionPin, VersionRange } from './types.js';
export declare function parseAffectedRanges(advisory: Advisory): VersionRange[] | null;
/** Pure, offline evaluation. Missing suppression data is null, never a fabricated empty official section. */
export declare function evaluateProject(page: AdvisoryPage, pins?: readonly VersionPin[], suppressionPage?: SuppressionPage): ProjectVerdicts;
