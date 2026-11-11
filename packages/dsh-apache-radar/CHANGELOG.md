# Changelog

## 0.1.1 - 2026-11-11

- 保留 DSH 0.2.2-rc.1 下界，仅将上界收紧为 `>=0.2.2-rc.1 <0.3.0-0`，排除 0.3.0 及其预发布版本；原范围在官方 includePrerelease 校验下已能通过 rc.1。
- 所有 DSH peer 同步为 `>=0.2.2-rc.1 <0.3.0-0`，保留对 rc.1 新增 `MarkdownText.omitHtml` 的依赖及原有 Markdown 渲染；开发依赖保持原版本。
- 同步锁文件自身版本、打包断言及当前版本标识；兼容性声明不等于逐版本功能验证。

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
