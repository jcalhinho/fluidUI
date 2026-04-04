import test from "node:test";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { computeLayout, prepare, type LayoutBox, type LayoutType, type Node } from "../src";

type DashboardWidgetKind = "kpi" | "compare" | "trend" | "table" | "summary";

interface DashboardWidgetSpec {
  id: string;
  kind: DashboardWidgetKind;
  title: string;
  payload: unknown;
}

interface DashboardSpec {
  widgets: ReadonlyArray<DashboardWidgetSpec>;
  layout: {
    width: number;
    type: LayoutType;
    gap?: number;
    padding?: number;
    columns?: number;
    minColumnWidth?: number;
  };
}

function buildStressNodes(count: number): Node[] {
  return Array.from({ length: count }, (_, index) => {
    if (index % 9 === 0) {
      return {
        id: `text-${index}`,
        type: "text",
        content:
          `Insight block ${index}: ` +
          "Revenue, activation, retention, margin, cohort and conversion context. ".repeat(3)
      } satisfies Node;
    }

    if (index % 4 === 0) {
      return {
        id: `chart-${index}`,
        type: "chart",
        content: { title: `Trend ${index}`, points: [3, 8, 5, 9, 11, 10] }
      } satisfies Node;
    }

    return {
      id: `card-${index}`,
      type: "card",
      content: {
        title: `Metric ${index}`,
        body: "Card payload for stress and cache reuse validation.".repeat((index % 5) + 1)
      }
    } satisfies Node;
  });
}

function widgetSpecToNode(spec: DashboardWidgetSpec): Node {
  switch (spec.kind) {
    case "kpi":
    case "compare":
      return {
        id: spec.id,
        type: "card",
        intrinsicSize: { width: 320, height: 180 },
        content: spec
      };
    case "trend":
      return {
        id: spec.id,
        type: "chart",
        intrinsicSize: { width: 640, height: 280 },
        content: spec
      };
    case "table":
      return {
        id: spec.id,
        type: "custom",
        intrinsicSize: { width: 760, height: 320 },
        content: spec
      };
    case "summary":
      return {
        id: spec.id,
        type: "text",
        intrinsicSize: { width: 820, height: 120 },
        content: spec
      };
    default:
      return assertNever(spec.kind);
  }
}

function assertBoxesWithinBounds(
  boxes: ReadonlyArray<LayoutBox>,
  width: number,
  padding = 0,
): void {
  for (const box of boxes) {
    assert.ok(Number.isFinite(box.x), `x must be finite for ${box.id}`);
    assert.ok(Number.isFinite(box.y), `y must be finite for ${box.id}`);
    assert.ok(Number.isFinite(box.width), `width must be finite for ${box.id}`);
    assert.ok(Number.isFinite(box.height), `height must be finite for ${box.id}`);
    assert.ok(box.width > 0, `width must be > 0 for ${box.id}`);
    assert.ok(box.height > 0, `height must be > 0 for ${box.id}`);
    assert.ok(box.x >= padding - 1e-6, `x must honor padding for ${box.id}`);
    assert.ok(box.x + box.width <= width - padding + 1e-6, `box overflows width for ${box.id}`);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}

test("json dashboard spec can be rendered through the predictive pipeline", () => {
  const spec: DashboardSpec = {
    widgets: [
      {
        id: "kpi-mrr",
        kind: "kpi",
        title: "MRR",
        payload: { value: "€148k", delta: "+8.4%" }
      },
      {
        id: "cmp-plan-a-vs-b",
        kind: "compare",
        title: "Plan A vs Plan B",
        payload: { a: 0.19, b: 0.24, metric: "conversion" }
      },
      {
        id: "trend-conversion",
        kind: "trend",
        title: "Conversion Trend",
        payload: { points: [12, 14, 15, 17, 16, 19, 21] }
      },
      {
        id: "table-top-pages",
        kind: "table",
        title: "Top Pages",
        payload: [{ page: "/pricing", sessions: 9420 }]
      },
      {
        id: "summary-exec",
        kind: "summary",
        title: "Executive Summary",
        payload: "Revenue grew while conversion variance narrowed."
      }
    ],
    layout: {
      width: 1280,
      type: "masonry",
      gap: 12,
      padding: 16,
      minColumnWidth: 260
    }
  };

  const nodes = spec.widgets.map(widgetSpecToNode);
  const prepared = prepare(nodes);
  const boxes = computeLayout(prepared, spec.layout);

  assert.equal(boxes.length, spec.widgets.length);
  assert.equal(new Set(boxes.map((box) => box.id)).size, boxes.length);
  assertBoxesWithinBounds(boxes, spec.layout.width, spec.layout.padding);
});

test("real-time responsive loop is deterministic and stable across width changes", () => {
  const nodes = buildStressNodes(320);
  const prepared = prepare(nodes);
  const widths = [420, 560, 720, 980, 1240, 1480];

  for (const width of widths) {
    const options = {
      width,
      type: "masonry" as const,
      gap: 10,
      padding: 12,
      minColumnWidth: 180
    };
    const passA = computeLayout(prepared, options);
    const passB = computeLayout(prepared, options);

    assert.equal(passA.length, nodes.length);
    assert.deepEqual(passA, passB);
    assertBoxesWithinBounds(passA, width, options.padding);
  }
});

test("shared prepare cache prevents re-measurement growth on repeated passes", () => {
  const nodes = buildStressNodes(220);
  const cache = new Map<string, { width: number; height: number }>();
  const options = { cache, widthBuckets: [200, 320, 520, 760] };

  const first = prepare(nodes, options);
  const firstCacheSize = cache.size;
  const second = prepare(nodes, options);
  const secondCacheSize = cache.size;

  assert.ok(firstCacheSize > 0);
  assert.equal(secondCacheSize, firstCacheSize);
  assert.deepEqual(first, second);
});

test("prepare-once + layout-many is faster than naive re-prepare-each-frame", () => {
  const nodes = buildStressNodes(280);
  const widths = Array.from({ length: 16 }, (_, index) => 560 + index * 48);

  const predictiveStart = performance.now();
  const prepared = prepare(nodes);
  for (const width of widths) {
    computeLayout(prepared, {
      width,
      type: "masonry",
      gap: 10,
      padding: 12,
      minColumnWidth: 220
    });
  }
  const predictiveDuration = performance.now() - predictiveStart;

  const naiveStart = performance.now();
  for (const width of widths) {
    const naivePrepared = prepare(nodes);
    computeLayout(naivePrepared, {
      width,
      type: "masonry",
      gap: 10,
      padding: 12,
      minColumnWidth: 220
    });
  }
  const naiveDuration = performance.now() - naiveStart;

  assert.ok(
    naiveDuration > predictiveDuration * 1.2,
    `expected predictive pipeline to be faster (predictive=${predictiveDuration.toFixed(2)}ms, naive=${naiveDuration.toFixed(2)}ms)`,
  );
});
