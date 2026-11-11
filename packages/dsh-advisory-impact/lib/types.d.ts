export type ProjectId = 'kafka' | 'hadoop' | 'flink';
export interface SourceMetadata {
    url: string;
    fetchedAt: string;
    sourceTimestamp?: string;
}
export interface SourceDocument extends SourceMetadata {
    payload: string;
}
export type HttpClient = (url: string) => Promise<SourceDocument>;
export interface Advisory extends SourceMetadata {
    id: string;
    project: ProjectId;
    title: string;
    products: string[];
    affectedText: string | null;
    fixedText: string | null;
    announcedAt?: string;
    notes: string[];
}
export interface AdvisoryPage extends SourceMetadata {
    project: ProjectId;
    advisories: Advisory[];
    notices: string[];
}
export interface Suppression extends SourceMetadata {
    id: string;
    notes: string;
}
export interface SuppressionPage extends SourceMetadata {
    suppressions: Suppression[];
    guidanceUrl: string;
}
export interface ReferencePage extends SourceMetadata {
    kind: 'pointer' | 'guidance';
    title: string;
    text: string;
    links: string[];
}
export type Verdict = 'affected' | 'not_affected' | 'unknown';
export interface VersionPin {
    version: string;
    component?: string;
    maven?: string;
}
export interface VersionRange {
    product: string;
    lower: string;
    lowerInclusive: boolean;
    upper: string;
    upperInclusive: boolean;
}
export interface PinVerdict {
    pin: VersionPin;
    verdict: Verdict;
    reason: string;
}
export interface OfficialVerdict extends Advisory {
    verdict: Verdict;
    reason: string;
    ranges: VersionRange[] | null;
    fixedVersions: string[] | null;
    pins: PinVerdict[];
    suppressions: Suppression[];
}
export interface SuppressionSection extends SuppressionPage {
    title: '扫描器报了，但官方说明不适用';
    project: 'kafka';
}
export interface ProjectVerdicts extends SourceMetadata {
    project: ProjectId;
    notices: string[];
    advisories: OfficialVerdict[];
    suppressions: SuppressionSection | null;
}
