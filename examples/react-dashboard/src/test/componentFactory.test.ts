import { describe, expect, it } from "vitest";
import { buildDemoNodes } from "../dashboard/componentFactory";

describe("componentFactory bignumber sizing", () => {
  it("keeps bignumber cards tall enough in stress density", () => {
    const nodes = buildDemoNodes({
      counts: { bignumber: 1 },
      density: "stress",
      seed: 42,
    });

    const bignumberNodes = nodes.filter((node) => node.id.startsWith("bignumber-"));

    expect(bignumberNodes.length).toBeGreaterThan(0);
    for (const node of bignumberNodes) {
      expect(node.intrinsicSize?.height ?? 0).toBeGreaterThanOrEqual(190);
      expect(node.intrinsicSize?.width ?? 0).toBeGreaterThanOrEqual(220);
    }
  });

  it("preserves showcase bignumber baseline size", () => {
    const nodes = buildDemoNodes({
      counts: { bignumber: 1 },
      density: "showcase",
      seed: 7,
    });

    const first = nodes.find((node) => node.id.startsWith("bignumber-"));
    expect(first?.intrinsicSize?.height).toBe(220);
    expect(first?.intrinsicSize?.width).toBe(360);
  });
});
