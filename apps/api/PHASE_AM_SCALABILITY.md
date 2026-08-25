# PHASE AM — Scalability

## Contract
- 1 Holding → 10 → 100 Subsidiaries → 1,000+ Organizations → 100,000+ People → Millions of Interactions.
- No full graph/table materialization in Network, Requirement Matching, Search or Reporting.
- Network graph is bounded and cursor-paginated.
- Requirement matching uses bounded candidate generation and a 2-hop local frontier.
- Search uses bounded PostgreSQL FTS candidate IDs and bounded entity fetches.
- Reporting uses bounded result windows; large exports must use explicit export/queue architecture rather than unbounded controller responses.
- Existing architecture is retained; no graph database rewrite is introduced.

## Runtime verification
Run `node tests/load/scalability-benchmark.mjs` against a populated staging environment.
