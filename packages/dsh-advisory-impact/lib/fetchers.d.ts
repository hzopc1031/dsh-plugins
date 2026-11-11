import type { AdvisoryPage, HttpClient, ProjectId, ReferencePage, SourceDocument, SuppressionPage } from './types.js';
export declare const FLINK_NOTICE = "ASF Flink \u516C\u544A\u9875\u4E3A\u5B9E\u9A8C\u6027\uFF0C\u8BF4\u660E\u8986\u76D6 2023 \u5E74\u4EE5\u6765\u7684\u516C\u544A\uFF0C\u53EF\u80FD\u6EDE\u540E\u5B98\u65B9 CVE \u53D1\u5E03\u3002";
export declare const KAFKA_NOTICE = "Kafka \u5B98\u65B9 CVE \u9875\u4E0D\u5217\u51FA Kafka \u4F9D\u8D56\u5E93\u7684\u5B89\u5168\u516C\u544A\uFF1B\u5B98\u65B9 suppressions \u4E0E ASF \u4F9D\u8D56\u95EE\u9898\u8BF4\u660E\u5355\u72EC\u5217\u51FA\u3002";
export declare function parseAdvisories(project: ProjectId, doc: SourceDocument): AdvisoryPage;
export declare function fetchAdvisories(project: ProjectId, http: HttpClient): Promise<AdvisoryPage>;
export declare function parseSuppressions(doc: SourceDocument): SuppressionPage;
export declare function fetchSuppressions(http: HttpClient): Promise<SuppressionPage>;
export declare function fetchFlinkPointer(http: HttpClient): Promise<ReferencePage>;
export declare function fetchDependencyGuidance(http: HttpClient): Promise<ReferencePage>;
