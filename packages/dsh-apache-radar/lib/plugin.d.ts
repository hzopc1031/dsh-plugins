import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
export declare const name = "apache-radar";
export declare const inject: string[];
export interface Config {
}
export declare const Config: z<Config>;
export declare const HELP = "Apache \u793E\u533A\u96F7\u8FBE\uFF1A\u672C\u5730\u67E5\u770B Apache \u5B98\u65B9\u53E3\u5F84\u4E0E\u5173\u6CE8\u9879\u76EE\u52A8\u6001\u3002\n\u5F53\u524D\u4E3A\u811A\u624B\u67B6\uFF0C\u4EC5\u652F\u6301 /apache-radar \u6216 /apache-radar help\u3002\n\u9879\u76EE\u6570\u91CF\u5FC5\u987B\u5E76\u5217\u5C55\u793A\u591A\u6765\u6E90\u53E3\u5F84\uFF0C\u6BCF\u9879\u9644\u6765\u6E90 URL + \u6293\u53D6\u65F6\u95F4\uFF08Asia/Singapore\uFF0CUTC+8\uFF09\uFF1B\u9000\u4F11\u53E3\u5F84\u4E5F\u987B\u5E76\u5217\u3002\n\u9ED8\u8BA4\u5173\u6CE8 Kafka / Hadoop / Flink\uFF1B\u6570\u636E\u5DE5\u5177\u4E0E\u5468\u62A5\u5C1A\u672A\u63A5\u901A\u3002\n\u4E0D\u4F7F\u7528 reporter.apache.org\uFF0C\u65E0\u9700\u6A21\u578B\u8C03\u7528\u3002";
export declare function apply(ctx: Context, _config?: Config): void;
