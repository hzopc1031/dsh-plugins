# Recorded public source fixtures

These are unchanged research captures from `/workspace/dsh-research/round19/evidence/`, collected on 2026-11-11 (Asia/Singapore, UTC+8). They are historical test input, never a live inventory. Runtime code does not read that research directory.

`provenance.json` records the source URL, original artifact filename, original capture-completion time and SHA-256 for each file. Capture-completion times preserve the research files' original mtimes; exact HTTP request start times were not recorded. This limitation is explicit in `timeBasis`, rather than inventing request timestamps. Replay fetch times are injected separately in tests.

The fixtures originate from the Apache Software Foundation's public Kafka, Hadoop, Flink and Apache Security sites and the `apache/kafka` repository. Original copyright and license notices are retained. The Kafka XML explicitly carries the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0); ASF website content is subject to the notices in the respective captured pages. Fixtures are kept only for offline parser tests and excluded from the npm tarball.

Tests assert actual advisory sections, not all CVE strings in a page: a CVE mentioned only in another advisory's prose is not a separate inventory entry. Verdict tests replay these dated inputs and do not claim current official conclusions.

`osv-cve-lookups.json` and `osv-queries.json` are unchanged recorded API summaries from the same research window. `osv-provenance.json` preserves their artifact hashes, endpoint, original capture-completion time and the limitation that full raw HTTP bodies were not retained. `test/osv-fixture-http.mjs` maps only captured fields into replay responses: lookup `osv_id` → `id`, `versions_sample` → sampled `versions`, and query id/summary/aliases tuples → `vulns`. The 404 status is replayed without an invented body. Missing fields or sampled versions are never evidence of non-impact.

Integration tests deliberately retain only selected unchanged Kafka sections to exercise the OSV-only grouping, and one explicitly marked fixed-field mutation exercises a conflict. These are controlled test cases, not new or current official inventories. Unrecorded OSV lookups/queries fail explicitly in the fixture transport rather than fabricating a 404 or a record.
