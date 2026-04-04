import test from "node:test";
import assert from "node:assert/strict";
import { computeLayout, prepare, type Node } from "../src";

const nodes: Node[] = [
  { id: "n1", type: "card", content: { title: "A", body: "small" } },
  {
    id: "n2",
    type: "card",
    content: { title: "B", body: "This is a much larger card body with more text." }
  },
  { id: "n3", type: "chart", content: { kind: "bar" } },
  { id: "n4", type: "text", content: "Simple text block for testing layout." }
];

test("vertical layout stacks boxes from top to bottom", () => {
  const prepared = prepare(nodes);
  const boxes = computeLayout(prepared, { width: 960, type: "vertical", gap: 8, padding: 16 });

  assert.equal(boxes.length, nodes.length);

  for (let i = 1; i < boxes.length; i += 1) {
    assert.ok(boxes[i].y > boxes[i - 1].y);
  }
});

test("grid layout keeps boxes inside 12-column container", () => {
  const prepared = prepare(nodes);
  const containerWidth = 1200;
  const boxes = computeLayout(prepared, {
    width: containerWidth,
    type: "grid",
    gap: 12,
    padding: 24
  });

  assert.equal(boxes.length, nodes.length);

  for (const box of boxes) {
    assert.ok(box.x >= 24);
    assert.ok(box.x + box.width <= containerWidth - 24 + 1e-6);
  }
});

test("masonry layout places each box into one of the columns", () => {
  const prepared = prepare(nodes);
  const boxes = computeLayout(prepared, {
    width: 1100,
    type: "masonry",
    columns: 3,
    gap: 10,
    padding: 20
  });

  assert.equal(boxes.length, nodes.length);

  const distinctX = new Set(boxes.map((box) => Math.round(box.x)));
  assert.equal(distinctX.size, 3);
});

test("computeLayout is deterministic", () => {
  const prepared = prepare(nodes);
  const options = { width: 1000, type: "masonry" as const, gap: 10, padding: 10 };

  const first = computeLayout(prepared, options);
  const second = computeLayout(prepared, options);

  assert.deepEqual(first, second);
});

test("layout handles large datasets", () => {
  const manyNodes: Node[] = Array.from({ length: 1000 }, (_, index) => ({
    id: `node-${index}`,
    type: index % 5 === 0 ? "chart" : "card",
    content: { index, text: "payload".repeat((index % 7) + 1) }
  }));

  const prepared = prepare(manyNodes);
  const boxes = computeLayout(prepared, { width: 1440, type: "masonry", minColumnWidth: 220 });

  assert.equal(boxes.length, manyNodes.length);
});
