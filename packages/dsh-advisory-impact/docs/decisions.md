# dsh-advisory-impact MVP decisions

Recorded: 2026-11-11, Asia/Singapore (UTC+8).
These choices fill gaps the research left open, always preferring the **smallest reasonable MVP**. Sources: `/workspace/dsh-research/round19/next-candidates.md` (section 1), `our-analysis.md`, `codex-astra-round19-final.md`, and `/workspace/dsh-research/round19/evidence/`.
**CVE counts, OSV results, suppression rows, and package-name checks in the research are snapshots from that query window (about 12:51–13:01 Asia/Singapore on 2026-11-11). They are not live values.** The plugin must fetch or, in tests, read recorded fixtures, and must always show **source URL + fetch time** next to every verdict and every listed item. Never copy research snapshot counts or CVE inventories into README, UI, or samples as if they were current, unless the text clearly labels them as a dated research snapshot.
Codex must follow this file. If a choice is unworkable, do not silently expand scope; record the problem in the task summary and pick the next-smallest fallback.

## Name and placement

- Package name: **`dsh-advisory-impact`**. Checked 2026-11-11 12:57:39–12:59:43 Asia/Singapore: `GET https://registry.npmjs.org/dsh-advisory-impact` returned HTTP 404. The same check also returned 404 for `dsh-advisory-watch` and `dsh-cve-impact`. A 404 only means the name was unpublished at that moment; it does not guarantee the name can be registered. Do not publish.
- Cordis plugin id: **`advisory-impact`**. Branch: **`feat/advisory-impact`**. Worktree: `/workspace/dev/dsh-plugins-advisory-impact`.
- This is a **separate plugin** from `dsh-apache-radar`. Do not fold it into `/apache-radar`, do not edit the apache-radar package or worktree, and do not claim they are the same product. apache-radar deliberately gives no security or upgrade verdicts; this plugin is the official-advisory counterpart.
- Nearby names that are **not** this package and must not be taken or claimed as compatible by default:
  - DSH lockfile/OSV scanners: `SARTHAK2511/dsh-cve-audit`, `988hj7tczd-oss/dsh-dep-vuln-scan`, `STARDUSTLC666/dsh-code-security`
  - Generic scanners and MCP: `google/osv-scanner`, `aquasecurity/trivy`, `anchore/grype`, `StacklokLabs/osv-mcp`, `cyanheads/osv-advisory-mcp-server`
- Do not vendor or copy source from those projects. Implement our own official-page fetchers, version matcher, and OSV second-source client. Ideas may be reused at the rule level only (local cache, fixture HTTP layer, official source first).

## Product role

- This is a **local official-advisory impact check** for a big-data engineer who maintains and modifies Kafka and Hadoop (Flink is also in the default watch list). It answers: against the running versions the user has pinned, does this official advisory affect me (affected / not affected / unknown); what is the official fixed version; and which items a scanner may report even though the official project says they are not applicable.
- It is **not** a foundation-wide CVE dashboard, **not** a lockfile/OSV workspace scanner, **not** a reachability/SCA engine, and **not** an auto-upgrade or “safe to go to production” advisor.
- The MVP is fully usable **without any model call**. This box has **no model API key**. Do not make live model calls. A model must never invent a verdict, a version range, or a CVE inventory.
- **Native in-DSH visual surface is part of the MVP**, not an optional extra. Research noted that a sidebar was not required for a first slice; that is **overridden**. After apache-radar shipped command text plus plain HTML reader pages, the user said the interface was ugly and asked us to learn from `bowenliang123/dsh-context` and other well-designed DSH plugins. Do not ship this plugin with only slash-command text or standalone HTML pages as the main UI.

## Data sources (public, no login)

Use public, no-login endpoints only. Be polite: a clear User-Agent that names this plugin and the GitHub repo (`dsh-advisory-impact (https://github.com/hzopc1031/dsh-plugins)` is fine), timeouts, limited concurrency, and backoff if a server returns 429. Cache responses. Do not scrape logged-in pages, do not simulate login, and do not bypass rate limits.

**Official advisories (first-class, in):**

- Kafka: [kafka.apache.org/community/cve-list](https://kafka.apache.org/community/cve-list/). Research snapshot (not live): page `article:modified_time` `2026-11-08T22:10:19+05:30` (2026-11-09 00:40:19 Asia/Singapore). The page itself says it does **not** list security advisories for dependencies of Kafka.
- Hadoop: [hadoop.apache.org/cve_list.html](https://hadoop.apache.org/cve_list.html).
- Flink: the project page [flink.apache.org/what-is-flink/security](https://flink.apache.org/what-is-flink/security/) does **not** maintain its own CVE list; it points at [security.apache.org/projects/flink](https://security.apache.org/projects/flink/). Use the ASF Flink advisories page as the Flink official list, and **always label** that the ASF page calls itself experimental, covers advisories since 2023, and may lag official CVE publications. Keep the project security page as a cited pointer, not as a second inventory to merge into one total.

**Official suppressions and scanner-guidance (in, separate section):**

- Kafka official suppressions file: human link [dependencycheck-suppressions.xml on apache/kafka trunk](https://github.com/apache/kafka/blob/trunk/gradle/resources/dependencycheck-suppressions.xml). Fetch the anonymous raw file `https://raw.githubusercontent.com/apache/kafka/trunk/gradle/resources/dependencycheck-suppressions.xml` (do not log into GitHub; prefer raw over scraping the blob HTML). Research snapshot (not live): at 13:00:33 Asia/Singapore the file contained only `CVE-2023-35116` and `CVE-2023-36479`, with official notes. Always parse whatever the fixture or live file actually contains.
- ASF guidance: [Reporting security issues in dependencies](https://security.apache.org/report-dependency/). Cite this next to the suppressions section so “scanner reports it” has an official place to look.

**OSV (second source only, in):**

- No API key. `GET https://api.osv.dev/v1/vulns/<CVE-or-GHSA-id>` and, when the user has also pinned a Maven coordinate, optional `POST https://api.osv.dev/v1/query`.
- If OSV returns HTTP 404 (research snapshot examples, not live claims: official Kafka page IDs `CVE-2026-114349`, `CVE-2026-112375`, `CVE-2026-111115` were 404 on this API at 12:58:40 while `CVE-2024-31141` was 200), say so plainly. Do not invent an OSV record. A web page on osv.dev that only shows a downstream alias is not a substitute for a successful API record.
- OSV must never silently override an official verdict.

**Out of MVP as data sources:** NVD or other APIs that need a key, authenticated GitHub APIs, lockfile crawling of the user’s workspace as the primary input, commercial SCA, reporter.apache.org, logged-in JIRA/Confluence, foundation-wide ASF security dumps as a “complete CVE total”.

If Hadoop or Flink later publish an official suppressions file with a documented public URL, it may be added the same way as Kafka’s. Do not invent a suppressions table for a project that has no official file.

## Pinned running versions

- Configurable. Default **watch list**: **Kafka, Hadoop, Flink**. There is **no default running version**. The user must enter the product versions they actually run. Never treat “latest”, a research snapshot, or a fixture’s example pin as the user’s cluster version in live or README copy presented as current.
- Stored in plugin config and/or a project-local file. Adding/removing a watched project or changing a pin must not require a code change.
- Smallest pin: one product version string per watched project (for example Kafka `3.7.1`). Optionally allow a short list of pins and optional component or Maven-coordinate pins (for example `kafka-clients` or `org.apache.kafka:kafka-clients@3.7.0`). Optional pins improve OSV queries and component matching; they are not required to get an official-page verdict against the product version.
- If a project is watched but has no pin, list official advisories for that project with verdict **unknown** and the reason “未填写运行版本，无法判断”. Do not skip the list, and do not invent a version.

## Verdicts

Three user-facing official verdicts only: **受影响 (affected)** / **不受影响 (not affected)** / **无法判断 (unknown)**. Every official verdict must sit next to the **official source URL** (deep link to the advisory on the official page when possible) and the **fetch time** (display timezone **Asia/Singapore**, UTC+8), plus the source page’s own timestamp when the file has one.

Matching rules (honest, smallest):

- Parse the official affected and fixed version text as written. Research fixtures show several phrasings, all of which must be handled when present: `from X before Y`, `from X to Y`, `X to Y`, `X - Y`, `X through Y`, and comma-separated or multi-branch ranges such as `3.2.0 through 4.1.2, 4.2.0 through 4.2.1` with a list of fixed versions such as `4.2.2, 4.3.2, 4.4.0`.
- Compare the user’s pinned version to those ranges. Use Maven-like dotted numeric versions. Honour inclusive/exclusive bounds as the source states (`before` is exclusive of the upper bound; `through` / `to` / `-` in Kafka/Hadoop list wording should be treated as inclusive unless the same advisory also says `before`).
- A pin clearly inside an affected range, and not in the official fixed list, is **affected**.
- A pin that is an official fixed version, or that is clearly newer than every affected range on that advisory (same major/minor branch when the source is branch-shaped, or newer than the last affected bound when the source is a single range), is **not affected**.
- If the range text cannot be parsed, the pin is a pre-release / RC / SNAPSHOT the official text does not clearly place, branches are ambiguous, or the advisory is for a **different component or product** than the pin (for example Apache Flink Kubernetes Operator vs a pin of Apache Flink only; Kafka Clients vs a pin that cannot be honestly applied), the verdict is **unknown** with a short reason. Do not guess.
- Preserve limiting language from the official text (component-only, “clusters with no authorizer are not affected in practice”, configuration preconditions, and similar) as notes next to the verdict. Notes do not replace the three-way verdict.
- **Official page is the authority** for affected / not affected / unknown. When OSV disagrees, keep both visible: official verdict stays, OSV is a second-source chip or column (found / not indexed HTTP 404 / different range). Never hide the disagreement and never average the two.
- Items that appear only in OSV (including Maven-query hits whose CVE is not on the official page) go in a separate **「仅见 OSV，未见官方公告」** section. They must not be promoted to an official affected/not-affected verdict.
- Official suppressions go in a separate **「扫描器报了，但官方说明不适用」** section, with the CVE id, the official notes, the suppressions-file URL, fetch time, and a link to the ASF report-dependency page. A suppressed CVE must **never** be listed as “officially affects Kafka” (or Hadoop/Flink). If the same id also appears on the official CVE page, still show the suppression note; do not drop either fact.
- Source failure is not “zero advisories” and not “not affected”. Show the error, serve the last successful cache (with its time) if any, and do not pretend the fetch succeeded.

## DSH surface

- Prefixed tools (exact names up to Codex) for refresh, pinned versions / watch list, official report, lookup of one CVE, and opening the saved report. Confine any project-local paths with `ctx.tools.restrict` and `ctx.tools.guard` (restrict needs a scoped `agent.ctx`, not the plugin root `ctx`).
- Slash command `/advisory-impact` (help / pin / watch / refresh / report / open / lookup as appropriate). Help must explain: official pages are first, OSV is second, suppressions are separate, no pin means unknown, no model key is required, and this is not a lockfile scanner.
- **Required native in-DSH visual surface** (panel / sidebar / page / card — whatever DSH 0.2.2-rc.1 actually supports; verify against `/workspace/dev/deepseek-harness` at `fcc0ad46` and against the read-only references). It must follow DSH’s own light and dark theme. Minimum content:
  - Overview cards for counts of affected / not affected / unknown / suppressions / OSV-only, each honest and sourced.
  - Per-project tabs (Kafka / Hadoop / Flink, plus user-added ids).
  - Verdict cards with clear semantic colors for affected / not affected / unknown; source + fetch-time chips; original-link affordance; official fixed versions; notes.
  - A distinct suppressions section (“扫描器报了，但官方说明不适用”).
  - A distinct OSV-only / disagreement area.
  - Refresh with visible loading, last-good-cache fallback, error and stale-data states.
  - Chinese-first copy; works without a model key and without needing a chat turn (apache-radar’s blank new Web session did not show slash-command output when no model was configured). Keep the slash commands working as well.
- Keep it tasteful: clear hierarchy, generous spacing, consistent radius and shadows, no rainbow colors; one accent color plus semantic status colors. Primary UI reference already cloned read-only at `/workspace/dev/ref/dsh-context`; also `/workspace/dev/ref/dsh-context-effort` and `/workspace/dev/ref/dsh-media-desk` (and the installed copy under the web profile). Reuse those clones; do not modify them; do not commit them. Borrow patterns, not wholesale source, unless the license allows it and you keep the notice.
- Default outbound network is only the documented public endpoints, through the cache layer. No auto-posting, no directory submission, no telemetry of user pins or reports to third parties. No Remote API.

## Local cache

- There is **no** first-class `ctx.cache` in DSH. Use `ctx.storageDomain` and/or a plugin-owned cache directory.
- Cache the raw or normalised payload, the request URL, fetch time, and source timestamp when present. Honour a TTL (official HTML can be hours; do not hammer OSV or GitHub raw).
- Reads in unit tests must use recorded fixtures and must not touch the network. A test helper may inject a fixture HTTP layer.
- Live network calls are allowed only in the final smoke test, and only to public no-login endpoints, politely.

## Samples, tests, and copy

- Unit and integration tests use **recorded fixtures**. Research snapshots under `/workspace/dsh-research/round19/evidence/` may be copied into the package and must keep their provenance (URL + original fetch time). Do not depend on the research path at runtime. Do not hit the network in `npm test`.
- Required fixture behaviours include: a known official advisory + a pin inside the affected range is affected; a pin at or beyond the official fixed version is not affected; a missing pin or unparseable range is unknown; Kafka suppression CVEs are not official-affected; an OSV 404 is reported as not indexed, not as an invented record; official vs OSV disagreement stays visible; a failed fetch is not “zero” or “not affected”.
- Live DSH load and a polite live fetch belong in the final task. Final screenshots must be **real in-DSH UI** (light and dark), not standalone HTML pages, saved under `/workspace/dev/advisory-impact-shots/`. If a live endpoint cannot be used, say so; do not fake it. Do not invent CVE lists or verdict counts in README, CHANGELOG, UI copy, or sample reports presented as current official data.
- README must state compatible DSH version, that official pages are the authority, that OSV is a second source and may 404, that suppressions are listed separately, that the user must pin running versions, that the default watch list is Kafka / Hadoop / Flink, that Flink’s ASF list is experimental and may lag, that no model key is required, and that the plugin is unreleased (git-branch install only).
- Do not claim a plugin market, user counts, star counts, or accuracy rates. Research’s “10–14 working days” is an estimate, not a product promise.

## Later (not this branch's required MVP)

- Foundation-wide ASF scanning, reachability analysis, auto-upgrade, rewriting production config, a second lockfile OSV scanner, merging this plugin into apache-radar.
- Logged-in scraping, authenticated GitHub APIs, NVD-key APIs.
- Merge to main, npm publish, and directory submission stay blocked until the user says so.
