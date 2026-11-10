import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
export declare const name = "instruction-conflicts";
export declare const inject: string[];
export declare const Config: z<Schemastery.ObjectS<{}>, Schemastery.ObjectT<{}>, "plain">;
export declare const HELP = "/instruction-conflicts [history|json|history-json]\n\u65E0\u53C2\u6570\uFF1A\u5F53\u524D\u6B63\u6587\u4E0E\u7591\u4F3C\u51B2\u7A81\u6458\u8981\uFF08\u6709\u9650\u663E\u793A\uFF09\uFF1Bhistory\uFF1A\u5B8C\u6574\u5386\u53F2\u6B63\u6587\u548C\u660E\u786E\u6807\u8BB0\u7684\u5386\u53F2\u5BF9\u7167\uFF1Bjson/history-json\uFF1A\u8FD4\u56DE\u5B8C\u6574\u7ED3\u6784\u3002\n\u8BFB\u53D6\u5F53\u524D\u4F1A\u8BDD\uFF0C\u4E0D\u53D1\u8D77\u6A21\u578B\u8BF7\u6C42\uFF0C\u4E0D\u4FEE\u6539\u6307\u4EE4\u6587\u4EF6\u3002";
export declare function apply(ctx: Context): void;
