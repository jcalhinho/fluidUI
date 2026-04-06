import { describe, expect, it } from "vitest";
import { computeBigNumberFontSize } from "../ui/bigNumberSizing";

describe("computeBigNumberFontSize", () => {
  it("keeps the previous size when geometry is temporarily invalid", () => {
    const next = computeBigNumberFontSize({
      availableWidth: 480,
      availableHeight: -4,
      previousFontSize: 72,
      measure: () => ({ width: 0, height: 0 }),
    });

    expect(next).toBe(72);
  });

  it("fits against both width and height constraints", () => {
    const next = computeBigNumberFontSize({
      availableWidth: 120,
      availableHeight: 100,
      previousFontSize: 72,
      measure: (size) => ({
        width: size * 2,
        height: size * 0.6,
      }),
    });

    expect(next).toBeCloseTo(60, 1);
  });

  it("returns the minimum when the value does not fit even at minimum size", () => {
    const next = computeBigNumberFontSize({
      availableWidth: 20,
      availableHeight: 200,
      previousFontSize: 72,
      measure: (size) => ({
        width: size * 2,
        height: size * 0.4,
      }),
    });

    expect(next).toBe(24);
  });
});
