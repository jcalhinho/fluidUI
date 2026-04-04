import test from "node:test";
import assert from "node:assert/strict";
import { prepare, type Node } from "../src";

test("prepare returns normalized prepared nodes with cached measurements", () => {
  const nodes: Node[] = [
    {
      id: "t1",
      type: "text",
      content: "hello world",
      constraints: { minWidth: 120, maxWidth: 600 }
    }
  ];

  const prepared = prepare(nodes, { widthBuckets: [200, 400] });
  assert.equal(prepared.length, 1);

  const first = prepared[0];
  assert.equal(first.node.id, "t1");
  assert.equal(first.cachedMeasurements.length, 2);
  assert.deepEqual(
    first.cachedMeasurements.map((m) => m.width),
    [200, 400]
  );
  assert.ok(first.intrinsicSize.height > 0);
  assert.equal(first.constraints.minWidth, 120);
  assert.equal(first.constraints.maxWidth, 600);
});

test("prepare can reuse provided cache for duplicate nodes", () => {
  const sharedCache = new Map<string, { width: number; height: number }>();
  const repeatedNode: Node = {
    id: "same",
    type: "card",
    content: { title: "A", body: "B" }
  };

  const prepared = prepare([repeatedNode, repeatedNode], {
    widthBuckets: [220, 440],
    cache: sharedCache
  });

  assert.equal(prepared.length, 2);
  assert.equal(sharedCache.size, 2);
});

test("prepare is deterministic for the same input", () => {
  const nodes: Node[] = [
    { id: "a", type: "text", content: "one two three" },
    { id: "b", type: "chart", content: { points: [1, 2, 3] } }
  ];

  const resultA = prepare(nodes);
  const resultB = prepare(nodes);

  assert.deepEqual(resultA, resultB);
});
