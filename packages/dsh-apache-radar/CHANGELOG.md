# Changelog

## 0.1.3

- 无显式代理时读取 Windows PAC / 静态系统代理；提供检测、禁用与脱敏诊断，失败沿用原访问路径。
- 请求默认超时改为 30 000 ms，新增 timeoutSeconds（10–120 秒）及诊断显示。
- 官方来源逐跳验证 HTTPS 白名单、最多 5 跳；更新 cwiki KIP/FLIP 地址与真实裁剪夹具。
- Windows 注册表 / PAC 采用模拟测试；仅在 Linux 验证，未宣称真实公司网络或 Windows Desktop 实测。

## 0.1.2 - 2026-11-12

- 合并内网代理 / CA 诊断改动与 main 的 DSH 0.2.2-rc.1 兼容修复（merge intranet proxy/CA diagnostics with main's 0.2.2-rc.1 compatibility）；保留本包两侧已有功能与验证边界。
- 保留代理与 CA 配置、面板网络诊断、最后成功缓存、快照导入导出、离线模式及 rc.1 Markdown HTML 限制。

## 0.1.1 - 2026-11-11

- 保留 DSH 0.2.2-rc.1 下界，仅将上界收紧为 `>=0.2.2-rc.1 <0.3.0-0`，排除 0.3.0 及其预发布版本；原范围在官方 includePrerelease 校验下已能通过 rc.1。
- 所有 DSH peer 同步为 `>=0.2.2-rc.1 <0.3.0-0`，保留对 rc.1 新增 `MarkdownText.omitHtml` 的依赖及原有 Markdown 渲染；开发依赖保持原版本。
- 同步锁文件自身版本、打包断言及当前版本标识；兼容性声明不等于逐版本功能验证。

## 0.1.1 (2026-11-11)

- 修复 DSH 0.2.2-rc.1 加载兼容声明；Linux 加载验证，Windows / Electron 功能未实测。
- 增加插件级 HTTP 代理、公司 CA、具名网络原因与中文排查提示；默认沿用宿主 fetch。
- 合并重复网络错误，支持网络诊断、缓存快照导入导出及离线模式。


## 0.1.0 — unreleased

- Merge official Kafka/Hadoop/Flink advisories into each project’s version-and-security strip, with project-local version input, three-way official-range verdicts, fixed wording, original links/times and unknown reasons. No default version or production-safety conclusion.
- Link security JIRA title CVEs to published advisory rows, add a watched-component security card to the existing overview, and include windowed “本周新公告” in the model-free brief using official publication dates or persisted, labelled first-seen times.
- Port MIT source from hzopc1031’s dsh-advisory-impact: advisory types/source identities, HTML/XML fetchers/parsers, numeric range/verdict matcher, OSV lookup parsing/range comparison and recorded fixtures with provenance. Keep suppressions separate; label Flink’s experimental coverage and OSV HTTP 404/disagreements. No runtime dependency on that plugin.
- Reuse the shared serial HTTP policy, TTL cache, refresh and transaction queue; retain last-good payload/time plus failure metadata across reloads. OSV requests are per-expanded-advisory; refresh updates previously requested records. Add bounded response decoding and persist OSV status without converting failures into empty inventories.
- Add cache-only `/apache-radar security [project]` and `apache_radar_security` summaries. Preserve existing commands/tools, path checks, host theme and responsive layout; ship updated real DSH replay screenshots.

- Add a native DSH sidebar dashboard with light/dark theme tokens, cited overview cards, parallel retired scopes, official category disclosures, watched-project controls, security badges, grouped/collapsible JIRA and original links.
- Add model-free local-directory selection and saved weekly brief reading cards, full Markdown copy and browser opening; retain slash commands and tools. Open from a blank Web profile without creating a chat.
- Read cached data on panel entry; explicit refresh bypasses TTL and surfaces last-good fallback and source errors. Separate the last collected feed window from the cache clock to avoid false stale states immediately after fetching.
- Use an optional authenticated local Fetch route (no Remote API), retain existing path confinement, and require DSH >=0.2.2-rc.1 for the MarkdownText.omitHtml contract. Ship real in-DSH screenshots labelled as historical replay.

- Compare official current-listing, PMC, committee and podling scopes with source URLs, fetch times and available source timestamps; preserve official multi-label categories.
- Show Whimsy/projects.apache.org retired committees and Attic PMC/subproject rows side by side, retaining identifier mismatches.
- Watch Kafka, Hadoop and Flink by default, with project-local list edits, official release records, anonymous scoped JIRA and linked Kafka KIP/Flink FLIP statuses. Unknown dates and incomplete JIRA pages stay explicit; no Hadoop HIP feed is invented.
- Generate and open local Chinese Markdown weekly briefs for a rolling seven-day Asia/Singapore window without model calls; look up collected linked items without network requests.
- Add `/apache-radar` subcommands and prefixed summary-first tools, local TTL caching with last-good fallback, scoped tool restrictions and guarded filesystem writes.
- Ship recorded-fixture tests, prebuilt JavaScript/types, English/Chinese metadata and verified package contents. Load tested on Linux with DSH 0.2.2-rc.1; not published to npm or merged to main.
