export declare const SOURCES: {
    readonly kafka: "https://kafka.apache.org/community/cve-list/";
    readonly hadoop: "https://hadoop.apache.org/cve_list.html";
    readonly flink: "https://security.apache.org/projects/flink/";
    readonly flinkPointer: "https://flink.apache.org/what-is-flink/security/";
    readonly suppressions: "https://raw.githubusercontent.com/apache/kafka/trunk/gradle/resources/dependencycheck-suppressions.xml";
    readonly guidance: "https://security.apache.org/report-dependency/";
};
export declare class SourceError extends Error {
    readonly url: string;
    constructor(url: string, message: string, options?: ErrorOptions);
}
export declare function assertSourceUrl(url: string): void;
export declare const OSV_ID: RegExp;
export declare function osvUrl(id: string): string;
