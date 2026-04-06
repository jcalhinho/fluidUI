# Use Case Validation Plan

Goal: prove the engine is strong enough for open-source adoption in real UI workloads, not only synthetic examples.

## Scope

1. Predictive pipeline reliability (`prepare()` then `computeLayout()`).
2. Real-time layout stability under frequent width changes.
3. Caching effectiveness in repeated runs.
4. JSON-driven dashboard rendering flow (LLM/RAG friendly contract).

## Acceptance Criteria

1. Determinism:
   same input + same options must produce exactly the same `LayoutBox[]`.
2. Boundary safety:
   every box stays inside container bounds and has finite dimensions.
3. Cache stability:
   repeated `prepare()` with shared cache must not grow cache size.
4. Predictive advantage:
   `prepare once + layout many` must be faster than re-prepare each frame.

## Automated Suite

The following tests implement the validation matrix:

- `test/use-cases.test.ts`
  - `json dashboard spec can be rendered through the predictive pipeline`
  - `real-time responsive loop is deterministic and stable across width changes`
  - `shared prepare cache prevents re-measurement growth on repeated passes`
  - `prepare-once + layout-many is faster than naive re-prepare-each-frame`

## Run

```bash
npm run lint
npm run typecheck
npm run test
npm run bench
```

For CI threshold checks:

```bash
npm run bench:ci
```

Benchmark thresholds live in:

- `bench/baseline.json`

## Next Expansion

1. Add CI benchmark snapshots with historical trend tracking.
2. Add fixture packs for SaaS, ecommerce, observability, and BI dashboards.
3. Add optional provider tests for LLM-generated `DashboardSpec` JSON contracts.
