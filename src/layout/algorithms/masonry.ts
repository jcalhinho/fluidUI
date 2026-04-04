import type { LayoutBox, PreparedNode } from "../../types";
import { DEFAULT_GAP, DEFAULT_PADDING, clamp, coercePositiveNumber } from "../../utils";
import { getNodeHeight } from "../helpers";
import { coerceNonNegativeNumber } from "../shared";

const MAX_COLUMNS = 12;
const DEFAULT_MIN_COLUMN_WIDTH = 260;

export function computeMasonryLayout(
  preparedNodes: ReadonlyArray<PreparedNode>,
  containerWidth: number,
  gap?: number,
  padding?: number,
  columns?: number,
  minColumnWidth?: number
): LayoutBox[] {
  const safeGap = coerceNonNegativeNumber(gap, DEFAULT_GAP);
  const safePadding = coerceNonNegativeNumber(padding, DEFAULT_PADDING);
  const availableWidth = Math.max(1, containerWidth - safePadding * 2);

  const resolvedColumns = resolveColumnCount(
    availableWidth,
    safeGap,
    columns,
    minColumnWidth
  );

  const columnWidth =
    (availableWidth - safeGap * (resolvedColumns - 1)) / resolvedColumns;

  if (!Number.isFinite(columnWidth) || columnWidth <= 0) {
    throw new Error("Masonry layout cannot be computed with the provided options.");
  }

  const columnHeights = new Array<number>(resolvedColumns).fill(safePadding);

  return preparedNodes.map((preparedNode) => {
    const targetColumn = indexOfShortestColumn(columnHeights);
    const width = columnWidth;
    const height = getNodeHeight(preparedNode, width);

    const box: LayoutBox = {
      id: preparedNode.node.id,
      x: safePadding + targetColumn * (columnWidth + safeGap),
      y: columnHeights[targetColumn],
      width,
      height
    };

    columnHeights[targetColumn] += height + safeGap;
    return box;
  });
}

function resolveColumnCount(
  availableWidth: number,
  gap: number,
  columns?: number,
  minColumnWidth?: number
): number {
  if (typeof columns === "number" && Number.isFinite(columns) && columns > 0) {
    return clamp(Math.floor(columns), 1, MAX_COLUMNS);
  }

  const targetColumnWidth = coercePositiveNumber(minColumnWidth, DEFAULT_MIN_COLUMN_WIDTH);
  const derived = Math.floor((availableWidth + gap) / (targetColumnWidth + gap));

  return clamp(derived, 1, MAX_COLUMNS);
}

function indexOfShortestColumn(columnHeights: ReadonlyArray<number>): number {
  let shortestIndex = 0;
  let shortestHeight = columnHeights[0];

  for (let i = 1; i < columnHeights.length; i += 1) {
    if (columnHeights[i] < shortestHeight) {
      shortestHeight = columnHeights[i];
      shortestIndex = i;
    }
  }

  return shortestIndex;
}
