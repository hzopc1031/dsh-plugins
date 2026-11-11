# dsh-apache-radar MVP decisions

Recorded: 2026-11-11, Asia/Singapore (UTC+8).
These choices fill gaps the research left open, always preferring the **smallest reasonable MVP**. Sources: `/workspace/dsh-research/round18/apache-radar-report.md`, `our-analysis.md`, `evidence/` (including `verified-counts.json` and `chooser-areas.md`), and `/workspace/dsh-research/codex-astra-round18-final.md`.
**Counts, dates, and package-name checks in the research are snapshots from that query window (about 10:48–11:05 Asia/Singapore on 2026-11-11). They are not live values.** The plugin must fetch or, in tests, read recorded fixtures, and must always show **source URL + fetch time** next to every number. Never copy research snapshot numbers into README, UI, or samples as if they were current, unless the text clearly labels them as a dated research snapshot.
Codex must follow this file. If a choice is unworkable, do not silently expand scope; record the problem in the task summary and pick the next-smallest fallback.

## Name and placement

- Package name: **`dsh-apache-radar`**. Checked 2026-11-11 10:50:49 Asia/Singapore: `GET https://registry.npmjs.org/dsh-apache-radar` returned HTTP 404 and `{"error":"Not found"}`. The same check also returned 404 for `dsh-apache-community`, `dsh-asf-radar`, `dsh-apache-watch`, `dsh-apache-news`, `dsh-bigdata-radar`, and `dsh-apache-projects`. A 404 only means the name was unpublished at that moment; it does not guarantee the name can be registered. Do not publish.
- Cordis plugin id: **`apache-radar`**. Branch: **`feat/apache-radar`**. Worktree: `/workspace/dev/dsh-plugins-apache-radar`.
- Nearby names that are **not** this package and must not be taken or claimed as compatible by default:
  - GitHub `863683348/dsh-trend-radar` (DSH plugin-ecosystem radar, not Apache projects)
  - Generic RSS/news brief plugins such as `c-ling/dsh-plugin-newsboard`, `STARDUSTLC666/dsh-rss`, `JohnXu22786/rss-digest`, `hgl011091/dsh-rss-monitor`
  - Official ComDev `apache-projects-mcp` (read for ideas only; do not vendor or copy its source)
- Do not vendor or copy source from those projects, from OmniGet, or from any third-party downloader. Implement our own fetchers and brief layer. Ideas may be reused at the rule level (local feed cache, official JSON sources, watch list + weekly brief).

## Product role

- This is a **local Apache community radar for a big-data engineer** who maintains and modifies Kafka and Hadoop (Flink is also in the default watch list). It answers: official counts and categories with explicit source口径; what happened recently on watched projects (releases, JIRA items, KIPs or other proposals), each with a link to the original; and a weekly Chinese brief plus follow-up questions in chat.
- It is **not** a foundation-wide “new features today for every project” dashboard, **not** a rebuild of [projects.apache.org/metrics](https://projects.apache.org/metrics/), and **not** unsourced trend charts or “technology leadership” scores.
- The MVP is fully usable **without any model call**. This box has **no model API key**. Do not make live model calls. A model may later be used only to rephrase already-cited facts; it must never invent counts, performance numbers, version promises, or compatibility conclusions.

## Data sources (public, no login)

Use public, no-login endpoints only. Be polite: a clear User-Agent that names this plugin and the GitHub repo, timeouts, limited concurrency, and backoff if a server returns 429. Cache responses. Do not scrape logged-in pages, do not simulate login, and do not bypass rate limits.

**Directory, counts, and categories (in):**

- [projects.apache.org JSON](https://projects.apache.org/json/foundation/): at least `chooser.json`, `committees.json`, `committees-retired.json`, `podlings.json`, `releases.json`. `projects.json` (DOAP) may be used only with a clear warning that it counts submodules, not TLPs.
- [Whimsy public JSON](https://whimsy.apache.org/public/): at least `committee-info.json`, `committee-retired.json`, `public_podlings.json`. `public_ldap_projects.json` is optional supporting evidence, not the headline total.
- [Attic projects](https://attic.apache.org/projects.html) and [Attic stats](https://attic.apache.org/stats.html).
- [Incubator podlings.xml](https://incubator.apache.org/podlings.xml) and/or [Clutch](https://incubator.apache.org/clutch/index.html) for current/graduated/retired podling status.
- [Release Catalog](https://release-catalog.apache.org/) as **its own**口径 (catalog item count and its “retired TLPs” wording), never as a substitute for Whimsy or Attic.
- [www.apache.org](https://www.apache.org/) marketing line (“290+” in the research snapshot) only when labelled as marketing copy, not as a precise count.

**Forbidden source:** [reporter.apache.org](https://reporter.apache.org/). Research got HTTP 401. Do not call it, do not log in, and do not scrape it.

**Watch-list feeds (in):**

- Official `releases.json` for version + date across projects, then the watched project's own release notes, download page, or announcement when a fixture or live page is available.
- ASF JIRA anonymous API (`https://issues.apache.org/jira/`), only for configured watch-list projects, with caching. Do not unthrottled-scan the whole foundation. If 429, wait and record the failure; do not invent a numeric quota (research could not verify one).
- Proposal indexes where they actually exist: Kafka KIP index, Flink FLIP index (Confluence). **Hadoop has no general HIP index** — research got HTTP 404 for the obvious Hadoop HIP URL. Do not invent a HIP table. Other projects may have their own proposal process; add one only when a real URL is documented and tested with a fixture.
- Optional: public `announce@apache.org` mbox for watched-project announcements. CVE/security notices must be labelled as security, not as “new features”.
- **Do not** use GitHub Releases as the default authority (research: `apache/kafka` releases API was empty). A GitHub tag or atom feed may be a last-resort pointer only, clearly labelled as unofficial, and must respect the anonymous 60 requests/hour cap — preferably not used at all in MVP.

Out of MVP as data sources: OpenDigger / OpenRank as “trend” or “leadership”, OSS Insight, LFX, CHAOSS/Augur dashboards, InfoQ or other media as primary evidence, FY2026 annual-report totals as if they were current.

## Counts and categories

- **Never answer “how many Apache projects are there?” with a single number.** Show the official口径 side by side, each with source URL and fetch time (display timezone **Asia/Singapore**, UTC+8), plus the source's own timestamp when the file has one.
- Headline “currently listed” count, when shown, should be explained as current TLPs + current podlings from `chooser.json` (research method: 216 PMCs minus Incubator and Attic, plus current podlings). PMC count, all-committees count, incubating count, DOAP entry count, LDAP object count, and the homepage marketing line are separate rows.
- **Retired counts must be shown side by side**, never reduced to one number. At minimum:
  1. Whimsy / projects.apache.org retired committees
  2. Attic PMC rows and Attic subprojects (and Attic yearly-stats sum if parsed)
  3. Release Catalog's own retired-TLP wording, if that page is fetched
- Known discrepancies must remain visible rather than “fixed”. Research examples (dated snapshots, not live claims): XMLBeans is listed as retired in Attic/Whimsy but later maintained again under POI; some Whimsy retired names do not map 1:1 onto the Attic PMC table (Flume, Fluo, Logo Development, Zest were noted and not fully classified). If a live fetch still shows a mismatch, report it; do not invent a reconciliation.
- Categories use **official chooser domain tags** (a project may belong to more than one). Do not treat DOAP `retired` as a technology category. An optional “work view” grouping (storage/batch, messaging, stream compute, and so on) may be display-only and must be labelled as unofficial.
- Source failure is **not** “zero projects” or “zero updates”. Show the error, the last successful cache (with its time) if any, and do not pretend the fetch succeeded.

## Watch list

- Configurable. Default: **Kafka, Hadoop, Flink**.
- Stored in plugin config and/or a project-local file. Adding/removing a project must not require a code change.
- Depth in MVP: official releases in a stated time window; JIRA items for watched projects; proposal index items for Kafka (KIP) and Flink (FLIP). Hadoop has releases + JIRA only unless a real proposal source is later added.
- Time windows must state the timezone (**Asia/Singapore**) and whether they are a rolling number of days or a calendar period. Default brief window: **rolling last 7 days**. Daily “every project’s new features” is out of scope and must not be the default.

## Releases, JIRA, and proposals

- Every item shown in a brief, tool result, or UI list **must have a link to the original**. If there is no link, do not write “the new feature is …”.
- Keep kinds distinct: catalogued **release** (version + date + notes link) vs **JIRA issue** vs **proposal** (KIP/FLIP/other).
- For proposals, distinguish discussion / accepted / implemented / released when the source actually has that status. Do not collapse “accepted KIP” into “already shipped”.
- JIRA `type=New Feature` or `fixVersion` is incomplete and may include planned-but-unfinished work. Label JIRA items as JIRA, not as a complete feature list. Do not treat a target fix version as proof of release.
- Preserve limiting language from the source when summarising: Preview, default-off, applies only to one component, breaking change, and similar.
- A failed source must be listed as failed, not as an empty week.

## Weekly brief and chat

- Default delivery: a **weekly**, copyable **Chinese Markdown** brief for the watch list (plus a JSON sidecar if useful). Optional `ctx.schedule` weekly job if that API is verified in DSH source at fcc0ad46; the host must be running, and a successful schedule hook is not the same thing as a finished brief.
- Chat tools and the `/apache-radar` command can refresh counts, show or edit the watch list, generate or open the latest brief, and answer follow-ups such as “what changed in this Kafka version?” by pointing at already-collected, linked items. They must not invent an upgrade-to-production verdict.
- Default tool results returned toward the model context are **summaries**: counts, ids, status, file paths, and links — not a full dump of every JIRA body. A documented verbose opt-in may exist and must default off.
- Brief generation must work with **zero model calls**. Rule-based Chinese text from titles, dates, statuses, and links is enough. If a later optional model-rewrite path is stubbed, it stays off and is unusable on this box.

## Local cache

- There is **no** first-class `ctx.cache` in DSH (verified in research against source). Use `ctx.storageDomain` and/or a plugin-owned cache directory (newsboard's `feed-cache.json` is a precedent, not a source to copy).
- Cache the raw or normalised payload, the request URL, fetch time, and source timestamp when present. Honour a TTL (directory JSON can be hours; JIRA/proposal pages should not be hammered).
- Reads in unit tests must use recorded fixtures and must not touch the network. A test helper may inject a fixture HTTP layer.
- Live network calls are allowed only in the final smoke test, and only to public no-login endpoints, politely.

## DSH surface

- Prefixed tools (exact names up to Codex) for counts/categories, watch-list, refresh, brief, and follow-up lookup. Confine any project-local paths with `ctx.tools.restrict` and `ctx.tools.guard` (restrict needs a scoped `agent.ctx`, not the plugin root `ctx`).
- Slash command `/apache-radar` (help / counts / watch / brief / refresh as appropriate).
- Optional thin `ctx.slots` panel listing the watch list, last successful fetch time, and a link to the latest brief. **No Remote API.** Do not rebuild the official metrics dashboard.
- Default outbound network is only the documented public ASF endpoints, through the cache layer. No auto-posting, no directory submission, no telemetry of user questions to third parties.

## Samples, tests, and copy

- Unit and integration tests use **recorded fixtures**. Research snapshots under `/workspace/dsh-research/round18/evidence/` may be copied into the package and must keep their provenance (URL + original fetch time). Do not hit the network in `npm test`.
- Live DSH load and a polite live fetch belong in the final task. If a live endpoint cannot be used, say so; do not fake it. Do not invent numbers in README, CHANGELOG, UI copy, or sample briefs presented as current official counts.
- README must state compatible DSH version, that every count has a source and time, that retired口径 are shown side by side, that the default watch list is Kafka / Hadoop / Flink, that GitHub Releases is not the authority, that reporter.apache.org is not used, and that the plugin is unreleased (git-branch install only).
- Do not claim a plugin market, user counts, star counts, or accuracy rates. Research's “8–12 working days” is an estimate, not a product promise.

## Later (not this branch's required MVP)

- A sidebar dashboard of each project's newest features, unsourced trend charts, OpenDigger overlays, foundation-wide daily feature sweep, auto “safe to upgrade” advice.
- Logged-in scraping, reporter.apache.org, mailing-list private archives, GitHub authenticated APIs.
- Merge to main, npm publish, and directory submission stay blocked until the user says so.
