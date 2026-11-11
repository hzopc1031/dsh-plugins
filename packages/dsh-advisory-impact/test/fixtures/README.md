# Recorded public source fixtures

These are unchanged research captures from `/workspace/dsh-research/round19/evidence/`, collected on 2026-11-11 (Asia/Singapore, UTC+8). They are historical test input, never a live inventory. Runtime code does not read that research directory.

`provenance.json` records the source URL, original artifact filename, original capture-completion time and SHA-256 for each file. Capture-completion times preserve the research files' original mtimes; exact HTTP request start times were not recorded. This limitation is explicit in `timeBasis`, rather than inventing request timestamps. Replay fetch times are injected separately in tests.

The fixtures originate from the Apache Software Foundation's public Kafka, Hadoop, Flink and Apache Security sites and the `apache/kafka` repository. Original copyright and license notices are retained. The Kafka XML explicitly carries the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0); ASF website content is subject to the notices in the respective captured pages. Fixtures are kept only for offline parser tests and excluded from the npm tarball.

Tests assert actual advisory sections, not all CVE strings in a page: a CVE mentioned only in another advisory's prose is not a separate inventory entry. Tests derive no security verdicts in this task.
