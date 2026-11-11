# dsh-apache-radar

把你关注的 Apache 项目动态整理成一份带原文链接的中文周报，同时看清“项目数量”在不同官方来源中的含义。

- **少翻多个页面：** 默认集中查看 Kafka / Hadoop / Flink 的发布、JIRA 工单和 Kafka KIP / Flink FLIP 提案，也能增删关注项目。
- **看清数字为何不同：** 当前列示、项目管理委员会（PMC）、全部委员会和孵化项目分行展示；退休委员会与 Attic 的 PMC／子项目并列，保留名单差异。
- **随时复制和追问：** 生成本地中文 Markdown 周报，再按版本号、工单号或关键词查已采集的原文；数量、来源状态和链接一起保留。
- **失败时仍有依据：** 一小时内复用本地缓存；刷新失败时显示错误和上次成功时间，无需模型 API key。

例如输入 `/apache-radar watch`，默认结果为：

```text
关注项目：kafka、hadoop、flink
```

再输入 `/apache-radar brief` 和 `/apache-radar open`。以下为**结构示意，省略实际数量**；运行结果中每个数量都会带来源 URL 和抓取时间：

```text
Apache 社区周报
窗口：滚动最近 7 天，Asia/Singapore（UTC+8）
官方数量口径：当前列示（TLP + 当前 podlings）、PMC、全部委员会……
退休口径：Whimsy 退休委员会 / projects.apache.org 退休委员会 / Attic PMC / Attic 子项目
关注动态：发布版本与日期 / JIRA 状态与原文 / KIP、FLIP 状态与原文
来源状态：成功、缓存、刷新失败沿用旧缓存，或无可用来源
```

## 三步快速上手

1. **完全退出桌面 DSH。** 关闭所有窗口，并从系统托盘退出 DSH，确认已完全关闭后再安装或更新。需要 Node.js 22 及以上；DSH 版本范围见文末。
2. **在终端安装开发分支。** `0.1.0` 尚未发布到 npm，也未合入 main；包内已有编译文件，无需允许安装脚本。

   ```powershell
   dsh plugin --profile desktop add "github:hzopc1031/dsh-plugins#feat/apache-radar&path:/packages/dsh-apache-radar"
   ```

   若独立 CLI 提示 desktop 只能由桌面应用管理，改用桌面版自带的 CLI，参数和 Git 地址不变：

   ```powershell
   & "$env:LOCALAPPDATA\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop add "github:hzopc1031/dsh-plugins#feat/apache-radar&path:/packages/dsh-apache-radar"
   ```

3. **重开 DSH，在项目会话中生成第一份周报。** 确认“Apache 社区雷达”已启用，选择本地项目目录，在已有会话输入 `/apache-radar help`，然后运行 `/apache-radar brief`。看到带来源状态和保存路径的结果后，用 `/apache-radar open` 查看、复制全文。插件无需填写账号、令牌或模型配置；首次采集需要访问公开 ASF 网站。DSH 新会话入口与模型选择的限制见文末。

## 日常使用

| 你要做什么 | 命令 |
| --- | --- |
| 查看官方数量、退休差异和多标签分类 | `/apache-radar counts` |
| 查看关注列表 | `/apache-radar watch` |
| 添加或移除项目 | `/apache-radar watch add spark`、`/apache-radar watch remove spark` |
| 按缓存有效期采集，不写周报 | `/apache-radar refresh` |
| 生成／读取最新中文周报 | `/apache-radar brief`、`/apache-radar open` |
| 按版本、工单号、提案号或关键词查已采集条目 | `/apache-radar lookup KIP-1356` |

插件设置的 `watchList` 默认为 `["kafka", "hadoop", "flink"]`。命令编辑后，当前项目的覆盖列表优先于插件设置；其他项目各自保存。可添加其他官方项目 id，它们能匹配发布目录；JIRA 适配目前限于 Kafka、Hadoop（含 HDFS / MAPREDUCE / YARN）和 Flink，提案适配限于 Kafka KIP、Flink FLIP。Hadoop 没有已验证的通用 HIP 索引。

聊天工具为 `apache_radar_counts`、`apache_radar_watch`、`apache_radar_refresh`、`apache_radar_brief`、`apache_radar_open`、`apache_radar_lookup`。默认只返回摘要、状态、路径和链接，`open` 工具只有显式设置 `includeMarkdown: true` 才返回全文。`lookup` 不请求网络，最多返回二十项，并提示是否还有匹配项。自然语言聊天若由宿主模型调度工具，仍受宿主自身的模型配置约束；斜杠命令和周报生成本身不调用模型。

## English

Keep a linked Chinese weekly brief for your watched Apache projects, and compare official count scopes without treating them as one universal total. Kafka, Hadoop and Flink are watched by default. Releases, JIRA issues and KIP/FLIP proposals retain their original links and source statuses.

This is **unreleased, Git-branch installation only**. Fully quit DSH Desktop, install using the quoted `feat/apache-radar` command above, reopen DSH and run `/apache-radar help` in a project session, then `brief` and `open`. No model key or model call is required by the plugin. English metadata is shipped; command output and briefs are Chinese.

Every displayed count includes its source URL and fetch time in Asia/Singapore (UTC+8), plus a source timestamp when available. Retired committees and Attic PMC/subproject scopes stay side by side, including mismatches. GitHub Releases is not the release authority. reporter.apache.org is never used. Nothing is uploaded or automatically published.

The one-hour cache preserves the last good response on failure. JIRA is a capped first page per watched project, not a complete shipped-feature list; fixVersion and accepted proposals do not prove release. Hadoop has no verified general HIP feed. There is no production-upgrade verdict, foundation-wide daily sweep, automatic schedule or dedicated dashboard.

## 补充说明

### 版本与验证范围

版本 `0.1.0`（未发布），Node.js `>=22`，声明 DSH `>=0.2.1-rc.5 <0.3.0`。接口对照只读源码 `fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159`；本机实际加载验证版本为 **DSH 0.2.2-rc.1**。声明范围不代表逐版本测试，也不代表已验证 Electron 桌面安装。

Linux 烟测在隔离 profile 启动 Web 服务，通过实际宿主命令注册表回放记录夹具；公开计数源与三个默认项目的匿名 JIRA 请求也单独验证成功。Web 空白新会话提交未通过，未声称完成桌面界面验收。测试夹具保留原 URL、抓取时间、完整性摘要和裁剪说明。历史快照不表示当前官方数量。

### 来源、时间与边界

- 数量读取 [chooser.json](https://projects.apache.org/json/foundation/chooser.json)、[committee-info.json](https://whimsy.apache.org/public/committee-info.json)、[podlings.json](https://projects.apache.org/json/foundation/podlings.json)、[public_podlings.json](https://whimsy.apache.org/public/public_podlings.json)。当前列示解释为 chooser 中当前 TLP 加当前孵化项目，不与 PMC／全部委员会混用；分类沿用 chooser 官方领域标签，一个项目可有多个标签，不能把分类数量相加当总数。
- 退休口径读取 [Whimsy 退休委员会](https://whimsy.apache.org/public/committee-retired.json)、[projects.apache.org 退休委员会](https://projects.apache.org/json/foundation/committees-retired.json)及 [Attic 项目表](https://attic.apache.org/projects.html)。名单不同会明确列出，不猜测如何统一。当前未接入 Attic 年度统计、Release Catalog、DOAP、LDAP、Incubator XML／Clutch 或首页营销数字。
- 发布以 [官方发布目录](https://projects.apache.org/json/foundation/releases.json)为依据，Kafka 还匹配官方下载安装页中的版本说明链接；Hadoop／Flink 没有自动提取版本说明全文。GitHub Releases 不作为权威来源，不使用 reporter.apache.org，不登录或绕过限流。
- 默认窗口为 **Asia/Singapore（UTC+8）滚动最近 7 天**，不是自然周。目录仅有日期时按该时区零点筛选。JIRA 使用最后更新时间，本地再筛选时间边界；每项目只取首个最多 100 条的响应页，有更多结果就提示采集不完整。
- 提案保留讨论、接受、实现、发布等来源状态和限制用语；日期未知的条目单列为参考，不能称为本周新增。JIRA `New Feature`、`fixVersion` 和已接受提案均不证明已经发布；安全公告单独标注。输出不作兼容性或“可安全上生产”的判断。
- 本插件通过宿主命令注册表直接执行，不发起模型请求。DSH 0.2.2-rc.1 的空白新会话界面在未配置模型时可能无法提交命令；应在已有项目会话使用。烟测用宿主配置创建空闲项目会话验证，没有配置密钥或发起模型调用。
- 无专用面板、自动周报定时器、全基金会每日功能扫描、自动上传、发帖或发布。完整边界见[绑定 MVP 决策](docs/decisions.md)。

### 本地文件与缓存

会话当前项目目录保存 `.apache-radar-feed-cache.json`（URL、抓取时间、响应及来源时间）、`.apache-radar-state.json`（关注覆盖值／采集时间）和 `.apache-radar-brief.md`（最新周报）。文件不自动加入 Git；可自行加入项目忽略规则。只保留最新周报，重复生成会替换它；需要留档时先复制。

缓存有效期一小时；`refresh` 和 `brief` 在有效期内复用，过期才抓取。失败保留上次成功数据和时间，并显示错误；没有成功缓存时显示失败，不写成“本周零更新”。公开请求串行执行，带插件 User-Agent、超时和 429 退避。路径必须是本地绝对目录，拒绝 `..` 逃逸和符号链接。

### 开发验证

在包目录运行 `npm ci --ignore-scripts`，然后 `npm test && npm run verify-pack`。测试只使用记录夹具和注入故障，阻断实时 HTTP 与 socket；周报无需模型。`lib/` 已提交，打包检查排除夹具、测试及 `node_modules`，无安装生命周期脚本。
