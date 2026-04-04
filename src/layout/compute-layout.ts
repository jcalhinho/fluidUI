import { computeGridLayout } from "./algorithms/grid";
import { computeMasonryLayout } from "./algorithms/masonry";
import { computeVerticalLayout } from "./algorithms/vertical";
import type { LayoutBox, LayoutOptions, PreparedNode } from "../types";

export function computeLayout(
  preparedNodes: ReadonlyArray<PreparedNode>,
  options: LayoutOptions
): LayoutBox[] {
  const width = coerceLayoutWidth(options.width);

  switch (options.type) {
    case "vertical":
      return computeVerticalLayout(preparedNodes, width, options.gap, options.padding);
    case "grid":
      return computeGridLayout(preparedNodes, width, options.gap, options.padding);
    case "masonry":
      return computeMasonryLayout(
        preparedNodes,
        width,
        options.gap,
        options.padding,
        options.columns,
        options.minColumnWidth
      );
    default:
      return assertNever(options.type);
  }
}

function coerceLayoutWidth(width: number): number {
  if (!Number.isFinite(width) || width <= 0) {
    throw new Error("Layout width must be a positive number.");
  }

  return width;
}

function assertNever(value: never): never {
  throw new Error(`Unsupported layout type: ${String(value)}`);
}
