import type { LayoutBox, PreparedNode } from "../../types";
import { clamp, coercePositiveNumber } from "../../utils";
import { getNodeHeight } from "../helpers";
import { DEFAULT_GAP, DEFAULT_PADDING, coerceNonNegativeNumber } from "../shared";

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

  // columnHeights[c] = Y where the NEXT item in column c would start
  const columnHeights = new Array<number>(resolvedColumns).fill(safePadding);
  const boxes: LayoutBox[] = [];

  for (const preparedNode of preparedNodes) {
    const targetColumn = indexOfShortestColumn(columnHeights);
    const height = getNodeHeight(preparedNode, columnWidth);

    const box: LayoutBox = {
      id: preparedNode.node.id,
      x: safePadding + targetColumn * (columnWidth + safeGap),
      y: columnHeights[targetColumn]!,
      width: columnWidth,
      height
    };

    boxes.push(box);
    columnHeights[targetColumn] = (columnHeights[targetColumn] ?? 0) + height + safeGap;
  }

  return boxes;
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
  if (columnHeights.length === 0) {
    throw new Error("columnHeights cannot be empty");
  }

  let shortestIndex = 0;
  let shortestHeight = columnHeights[0]!;

  for (let i = 1; i < columnHeights.length; i += 1) {
    const h = columnHeights[i]!;
    if (h < shortestHeight) {
      shortestHeight = h;
      shortestIndex = i;
    }
  }

  return shortestIndex;
}
