# dsh-advisory-impact

为核对运行版本整理 Kafka、Hadoop、Flink 官方安全公告及原始依据。

**开发中草稿，尚未发布。** 当前包提供帮助命令和抓取库；运行版本配置、三态判定、OSV、缓存、报告与 DSH 原生界面将在后续任务完成，暂不能用于实际影响判定。

- 少做页面摘录：抓取库保留官方受影响版本、修复版本与适用条件原文。
- 核对时有据可查：公告条目附原始链接、抓取时间和页面自带时间（如有）。
- 分清来源用途：官方公告、Kafka suppressions、Flink 来源指引和 ASF 依赖问题说明分别整理。

当前入口示例（帮助文本节选，无 CVE 判定）：

```text
/advisory-impact
默认关注 Kafka / Hadoop / Flink；没有默认运行版本，必须自行填写。
未填写运行版本，无法判断。
版本判定、OSV、缓存、报告与 DSH 原生面板将在后续任务接入。
```

1. **完全退出桌面 DSH。** 关闭所有窗口，并从系统托盘退出。
2. **安装开发分支。** 当前仅提供 Git 分支安装，没有 npm 发布包：

   ```sh
   dsh plugin --profile desktop add "github:hzopc1031/dsh-plugins#feat/advisory-impact&path:/packages/dsh-advisory-impact"
   ```

3. **重开 DSH，输入 `/advisory-impact`。** 当前会看到用途、来源及开发状态说明，无需模型 API key。后续核对功能要求你填写实际运行版本；不会提供默认版本。

补充说明：

- 目标兼容 DSH `>=0.2.1-rc.5 <0.3.0`、Node.js `>=22`；本阶段对照 DSH `0.2.2-rc.1` 源码并完成离线构建测试，真实 DSH 加载与界面验收留在最终任务。
- 官方页面是后续判定的依据：[Kafka](https://kafka.apache.org/community/cve-list/)、[Hadoop](https://hadoop.apache.org/cve_list.html)、[ASF Flink](https://security.apache.org/projects/flink/)。Kafka 页说明不列出依赖库公告；[Flink 项目安全页](https://flink.apache.org/what-is-flink/security/) 仅作指引。ASF Flink 页标注为实验性，说明覆盖 2023 年以来的公告，可能滞后官方 CVE 发布。
- [Kafka 官方 suppressions 文件](https://raw.githubusercontent.com/apache/kafka/trunk/gradle/resources/dependencycheck-suppressions.xml) 将在「扫描器报了，但官方说明不适用」区域单列，旁附 [ASF 依赖问题说明](https://security.apache.org/report-dependency/)。不会虚构 Hadoop 或 Flink suppressions 文件。
- OSV 尚未接入；后续仅作第二来源，HTTP 404 会明确显示为未收录。官方与 OSV 不一致时保留双方信息，OSV 独有条目单列。
- 后续 MVP 必须提供遵循 DSH 明暗主题的原生面板，不依赖聊天或模型调用。固定决策见 [decisions.md](docs/decisions.md)，接口核对与界面接入位置见 [dsh-api.md](docs/dsh-api.md)。
- 这是本地官方公告影响核对项目，范围不含 lockfile 扫描、可达性分析或自动升级。
- 测试使用带采集来源的历史快照，不代表当前实时数据。HTML 使用 `node-html-parser`，XML 使用 `saxes` 严格检查；公开 HTTP 客户端有超时、串行请求及有限 429 重试，本阶段未发起实时数据请求。
