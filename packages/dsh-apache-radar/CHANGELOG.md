# Changelog

## 0.1.0 — unreleased

- Compare official current-listing, PMC, committee and podling scopes with source URLs, fetch times and available source timestamps; preserve official multi-label categories.
- Show Whimsy/projects.apache.org retired committees and Attic PMC/subproject rows side by side, retaining identifier mismatches.
- Watch Kafka, Hadoop and Flink by default, with project-local list edits, official release records, anonymous scoped JIRA and linked Kafka KIP/Flink FLIP statuses. Unknown dates and incomplete JIRA pages stay explicit; no Hadoop HIP feed is invented.
- Generate and open local Chinese Markdown weekly briefs for a rolling seven-day Asia/Singapore window without model calls; look up collected linked items without network requests.
- Add `/apache-radar` subcommands and six prefixed summary-first tools, local TTL caching with last-good fallback, scoped tool restrictions and guarded filesystem writes.
- Ship recorded-fixture tests, prebuilt JavaScript/types, English/Chinese metadata and verified package contents. Load tested on Linux with DSH 0.2.2-rc.1; not published to npm or merged to main.
