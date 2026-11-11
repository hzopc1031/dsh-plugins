# dsh-apache-radar

帮助你了解本地 Apache 社区雷达的入口、默认关注项目与官方数据口径规则。

**开发中草稿，尚未发布；当前只提供帮助命令。** 数据工具、关注列表操作、周报和可选面板将在后续任务接入。

- 先明确项目范围：帮助中说明默认关注 Kafka / Hadoop / Flink。
- 先看清统计含义：帮助中要求多来源口径并列，每个数量附来源 URL 和抓取时间，退休口径也并列。
- 直接查看使用边界：与打开多个网站查动态相比，计划围绕本地关注列表整理；当前只展示帮助，无需模型调用。

输入 `/apache-radar help`，可见以下帮助节选：

```text
Apache 社区雷达：本地查看 Apache 官方口径与关注项目动态。
当前为脚手架，仅支持 /apache-radar 或 /apache-radar help。
默认关注 Kafka / Hadoop / Flink；数据工具与周报尚未接通。
不使用 reporter.apache.org，无需模型调用。
```

## 三步快速上手

1. **完全退出桌面 DSH。** 关闭所有窗口，并从系统托盘退出。
2. **在终端安装开发分支。** 本包尚未发布到 npm，也未合入 main；分支推送后可用以下地址安装。

   ```powershell
   dsh plugin --profile desktop add "github:hzopc1031/dsh-plugins#feat/apache-radar&path:/packages/dsh-apache-radar"
   ```

3. **重新打开 DSH，查看帮助。** 确认 Apache 社区雷达已启用，输入 `/apache-radar help`；无需填写配置，应看到上述范围说明。

## 补充说明

- 版本 `0.1.0`，声明 Node.js `>=22`、DSH `>=0.2.1-rc.5 <0.3.0`。接口对照 DSH `fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159`（`0.2.2-rc.1`）；声明范围不代表逐版本实测。
- 本阶段只有帮助命令。库内已提供 chooser、委员会、退休委员会、podlings、发布目录与 Attic 表格的读取器，尚未接入命令和本地缓存，不会在插件加载时抓取网络。
- 数量不能合成一个“Apache 项目总数”；每项需有来源 URL、抓取时间（Asia/Singapore，UTC+8）及来源自带时间。退休委员会与 Attic PMC／子项目口径要并列保留，差异不应被隐藏。
- GitHub Releases 不是默认权威来源；不使用 reporter.apache.org，不登录、不上传，不调用模型。
- `npm test` 只读包内记录快照，禁止网络连接。快照均为历史研究材料；其出处、原始抓取时间及裁剪说明见测试目录的 `provenance.json`。读取层采用标准库 JSON 与小型 `parse5` HTML 解析器。
- 本阶段未进行真实 DSH 加载或公开端点抓取；实际安装及界面验证留到最终任务。
- [绑定 MVP 决策](docs/decisions.md)记录完整产品边界。持久缓存、项目动态、周报与路径限制测试留待实现对应行为时补齐。
