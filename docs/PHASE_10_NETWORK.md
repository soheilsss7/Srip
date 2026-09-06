# Phase 10 — Network

Source-aligned implementation scope: graph visualization, node/edge filters, shortest path, best path, connector ranking, and authorization-aware network queries.

## Implemented in this increment
- PostgreSQL relationship graph remains the source of truth.
- Organization, person, and project nodes are exposed.
- Relationship, membership, and project edges are exposed.
- Search query and relationship-status filters are supported.
- Shortest-path and weighted best-path endpoints are available.
- Connector ranking is available for visible person nodes.
- Organization-scope authorization is enforced before graph/path access.
- Web network workspace now calls the API and renders visible graph data.

## Runtime gates still required
- [ ] PostgreSQL migration/runtime verification
- [ ] API integration tests
- [ ] IDOR/cross-tenant graph tests
- [ ] Browser E2E for graph/search/path
- [ ] Real graph visualization benchmark (React Flow/Cytoscape) before adopting a library
- [ ] Zoom/pan/focus-node interaction
- [x] Person-level relationship edges from first-class `PersonRelationship` data
- [ ] Centrality, bridge-person, bottleneck, and single-point-of-failure analytics

## Completed in reconciliation increment
- Focus-node neighborhood filtering with authorization-aware visibility.
- Centrality endpoint based on visible graph degree.
- Bridge-person ranking based on cross-organization relationship reach.
- Bottleneck ranking using connectivity and risky-edge exposure.
- Single-point-of-failure fragmentation analysis.
- Web SVG graph visualization with filters, focus selection, path mode and analysis controls.
- Mobile Network workspace and analysis controls.
- Unit coverage for component/fragmentation primitives.

## Explicitly not claimed as runtime complete
- PostgreSQL/API integration, browser E2E, mobile device E2E, load benchmarks and production deployment still require a runnable environment.
- Person-level relationship edges are not invented because the current domain schema has no first-class person-to-person relationship entity; membership edges remain the source-aligned representation.


## Contract-complete capability matrix
- [x] Graph retrieval with organization scope
- [x] Node type filter: organization/person/project
- [x] Relationship status filter
- [x] Free-text query
- [x] Focus node neighborhood
- [x] Shortest path
- [x] Weighted best path
- [x] Connector ranking
- [x] Centrality
- [x] Bridge-person ranking
- [x] Bottleneck ranking
- [x] Single-point-of-failure analysis
- [x] Web graph workspace
- [x] Mobile network workspace
- [x] Authorization-aware queries
- [x] Fail-closed cross-tenant access
- [x] Deterministic analysis primitives

## Resolved domain boundary
The organization-to-organization `Relationship` entity remains canonical for organization relationships. Phase 31 adds a separate first-class `PersonRelationship` entity for person-to-person edges. Membership edges remain membership edges and are no longer used as a substitute for a person-to-person relationship.
