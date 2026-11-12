import { type EvaluateOptions } from './evaluate.js';
import { type AdvisoryViewModel } from './view-model.js';
export declare const HELP = "\u5B98\u65B9\u516C\u544A\u5F71\u54CD\u6838\u5BF9\n\u9488\u5BF9\u4F60\u81EA\u884C\u586B\u5199\u7684\u8FD0\u884C\u7248\u672C\uFF0C\u5728\u672C\u5730\u6838\u5BF9\u5B98\u65B9\u5B89\u5168\u516C\u544A\u3002\n\u5B98\u65B9\u9875\u9762\u4E3A\u5224\u5B9A\u4F9D\u636E\uFF1BOSV \u4EC5\u4F5C\u7B2C\u4E8C\u6765\u6E90\uFF0C\u53EF\u80FD\u8FD4\u56DE\u672A\u6536\u5F55\uFF08HTTP 404\uFF09\uFF0C\u5206\u6B67\u5E76\u5217\u4FDD\u7559\u3002\n\u5B98\u65B9 suppressions \u5355\u5217\u4E3A\u300C\u626B\u63CF\u5668\u62A5\u4E86\uFF0C\u4F46\u5B98\u65B9\u8BF4\u660E\u4E0D\u9002\u7528\u300D\uFF0C\u5E76\u5F15\u7528 ASF \u4F9D\u8D56\u6F0F\u6D1E\u8BF4\u660E\u3002\n\u9ED8\u8BA4\u5173\u6CE8 Kafka / Hadoop / Flink\uFF1B\u6CA1\u6709\u9ED8\u8BA4\u8FD0\u884C\u7248\u672C\uFF0C\u5FC5\u987B\u81EA\u884C\u586B\u5199\u3002\n\u672A\u586B\u5199\u8FD0\u884C\u7248\u672C\uFF0C\u65E0\u6CD5\u5224\u65AD\u3002\nFlink \u7684 ASF \u5217\u8868\u4E3A\u5B9E\u9A8C\u6027\uFF0C\u8986\u76D6 2023 \u5E74\u4EE5\u6765\u7684\u516C\u544A\uFF0C\u53EF\u80FD\u6EDE\u540E\u5B98\u65B9 CVE \u53D1\u5E03\u3002\n\u5168\u8FC7\u7A0B\u65E0\u9700\u6A21\u578B\u8C03\u7528\u6216\u6A21\u578B API key\uFF1B\u8FD9\u4E0D\u662F lockfile \u626B\u63CF\u5668\u3002\n\n/advisory-impact diagnose \u2014 \u7F51\u7EDC\u8BCA\u65AD\uFF08DNS / TCP / TLS / \u4EE3\u7406\u6765\u6E90\uFF09\n/advisory-impact snapshot-export \u2014 \u5BFC\u51FA\u5B98\u65B9\u7F13\u5B58\u5230\u9879\u76EE\u5185 .advisory-impact-snapshot.json\n/advisory-impact snapshot-import \u2014 \u5BFC\u5165\u8BE5\u56FA\u5B9A\u6587\u4EF6\u4E2D\u7684\u672C\u5730\u5FEB\u7167\n/advisory-impact help \u2014 \u67E5\u770B\u5E2E\u52A9\n/advisory-impact pin \u2014 \u67E5\u770B\u5F53\u524D\u8FD0\u884C\u7248\u672C\n/advisory-impact pin <project> <version> [component=<name>] [maven=<groupId:artifactId>] \u2014 \u4FDD\u5B58\u8FD0\u884C\u7248\u672C\n/advisory-impact pin remove <project> \u2014 \u79FB\u9664\u8BE5\u9879\u76EE pin\n/advisory-impact watch \u2014 \u67E5\u770B\u5173\u6CE8\u5217\u8868\n/advisory-impact watch kafka,hadoop,flink \u2014 \u66FF\u6362\u5173\u6CE8\u5217\u8868\uFF1Bnone \u6E05\u7A7A\n/advisory-impact refresh \u2014 \u5F3A\u5236\u5237\u65B0\u6765\u6E90\uFF0C\u5931\u8D25\u663E\u793A\u6700\u540E\u6210\u529F\u7F13\u5B58\u53CA\u9519\u8BEF\n/advisory-impact report \u2014 \u8F93\u51FA\u53EF\u590D\u5236\u7684\u4E2D\u6587 Markdown\n/advisory-impact report save \u2014 \u4FDD\u5B58\u5230\u5F53\u524D\u9879\u76EE advisory-impact-report.md\n/advisory-impact open \u2014 \u5728\u547D\u4EE4\u8F93\u51FA\u4E2D\u6253\u5F00\u5DF2\u4FDD\u5B58\u7684 Markdown\uFF08\u4E0D\u542F\u52A8\u5916\u90E8\u6D4F\u89C8\u5668\uFF09\n/advisory-impact lookup <CVE-id> \u2014 \u6838\u5BF9\u5355\u6761\u5B98\u65B9\u7ED3\u8BBA\u3001\u6765\u6E90\u65F6\u95F4\u3001OSV \u548C suppression\n\npin/watch \u5199\u5165\u5F53\u524D\u9879\u76EE .advisory-impact.json\uFF1B\u4FEE\u6539 pin \u4E0D\u4F1A\u81EA\u52A8\u52A0\u5165\u5173\u6CE8\u5217\u8868\u3002\n\u5DE5\u5177 advisory_impact_pin/watch/refresh/report/open/lookup \u9ED8\u8BA4\u8FD4\u56DE\u6458\u8981\uFF0C\u6E05\u5355\u6700\u591A 20 \u6761\u5E76\u6807\u660E\u622A\u65AD\uFF1Breport \u5DE5\u5177\u4FDD\u5B58\u62A5\u544A\uFF0Copen \u5DE5\u5177\u8FD4\u56DE\u5DF2\u6821\u9A8C\u8DEF\u5F84\u548C\u5927\u5C0F\u3002\n\u6240\u6709\u9879\u76EE\u6587\u4EF6\u4F7F\u7528\u56FA\u5B9A\u6587\u4EF6\u540D\uFF1B\u7F13\u5B58\u4F4D\u4E8E\u63D2\u4EF6\u81EA\u6709 ~/.cache/dsh-advisory-impact\uFF0C\u5B98\u65B9\u5224\u5B9A\u65C1\u4FDD\u7559\u6765\u6E90\u4E0E UTC+8 \u6293\u53D6\u65F6\u95F4\u3002\n\u547D\u4EE4\u53EF\u76F4\u63A5\u8FD0\u884C\uFF0C\u65E0\u9700\u804A\u5929\u6A21\u578B\uFF1B\u4E5F\u53EF\u4ECE DSH \u4FA7\u680F\u6253\u5F00\u300C\u516C\u544A\u5F71\u54CD\u300D\u539F\u751F\u9762\u677F\uFF0C\u9009\u62E9\u672C\u5730\u9879\u76EE\u540E\u586B\u5199\u7248\u672C\u5E76\u6838\u5BF9\u3002";
export type Action = 'help' | 'pin' | 'watch' | 'refresh' | 'report' | 'open' | 'lookup' | 'view';
export interface ActionArgs {
    project?: string;
    version?: string;
    component?: string;
    maven?: string;
    remove?: boolean;
    watch?: string[];
    save?: boolean;
    id?: string;
}
export interface SurfaceResult {
    text: string;
    summary: unknown;
    view?: AdvisoryViewModel;
}
export declare function parseInput(input: string): {
    action: Action;
    args: ActionArgs;
};
/** The command, tools and native UI share this model-free service. */
export declare class AdvisoryService {
    private readonly options;
    private chain;
    constructor(options: Omit<EvaluateOptions, 'projectDirectory' | 'force'>);
    exportSnapshot(): Promise<string>;
    importSnapshot(text: string): Promise<void>;
    execute(directory: string | undefined, action: Action, args: ActionArgs, signal: AbortSignal): Promise<SurfaceResult>;
    private perform;
}
