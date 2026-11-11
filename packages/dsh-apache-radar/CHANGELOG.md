# Changelog

## 0.1.0 — unreleased

- Add a native DSH sidebar dashboard with light/dark theme tokens, cited overview cards, parallel retired scopes, official category disclosures, watched-project controls, security badges, grouped/collapsible JIRA and original links.
- Add model-free local-directory selection and saved weekly brief reading cards, full Markdown copy and browser opening; retain slash commands and tools. Open from a blank Web profile without creating a chat.
- Read cached data on panel entry; explicit refresh bypasses TTL and surfaces last-good fallback and source errors. Separate the last collected feed window from the cache clock to avoid false stale states immediately after fetching.
- Use an optional authenticated local Fetch route (no Remote API), retain existing path confinement, and require DSH >=0.2.2-rc.1 for the MarkdownText.omitHtml contract. Ship real in-DSH screenshots labelled as historical replay.

- Compare official current-listing, PMC, committee and podling scopes with source URLs, fetch times and available source timestamps; preserve official multi-label categories.
- Show Whimsy/projects.apache.org retired committees and Attic PMC/subproject rows side by side, retaining identifier mismatches.
- Watch Kafka, Hadoop and Flink by default, with project-local list edits, official release records, anonymous scoped JIRA and linked Kafka KIP/Flink FLIP statuses. Unknown dates and incomplete JIRA pages stay explicit; no Hadoop HIP feed is invented.
- Generate and open local Chinese Markdown weekly briefs for a rolling seven-day Asia/Singapore window without model calls; look up collected linked items without network requests.
- Add `/apache-radar` subcommands and six prefixed summary-first tools, local TTL caching with last-good fallback, scoped tool restrictions and guarded filesystem writes.
- Ship recorded-fixture tests, prebuilt JavaScript/types, English/Chinese metadata and verified package contents. Load tested on Linux with DSH 0.2.2-rc.1; not published to npm or merged to main.
