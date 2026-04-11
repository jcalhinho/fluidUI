import type { LayoutBox, PreparedNode } from "../../types";
import { DEFAULT_GAP, DEFAULT_PADDING, coerceNonNegativeNumber } from "../shared";
import { getNodeHeight } from "../helpers";
import { clamp } from "../../utils";

const GRID_COLUMNS = 12;

export function computeGridLayout(
  preparedNodes: ReadonlyArray<PreparedNode>,
  containerWidth: number,
  gap?: number,
  padding?: number
): LayoutBox[] {
  const safeGap = coerceNonNegativeNumber(gap, DEFAULT_GAP);
  const safePadding = coerceNonNegativeNumber(padding, DEFAULT_PADDING);
  const availableWidth = Math.max(1, containerWidth - safePadding * 2);

  const columnWidth =
    (availableWidth - safeGap * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

  if (!Number.isFinite(columnWidth) || columnWidth <= 0) {
    throw new Error("Grid layout cannot be computed with the provided width and gap.");
  }

  const boxes: LayoutBox[] = [];

  let currentColumn = 0;
  let currentRowY = safePadding;
  let currentRowHeight = 0;
  let rowStart = 0; // index into boxes[] where current row starts

  for (const preparedNode of preparedNodes) {
    const span = computeSpan(preparedNode, columnWidth, safeGap);

    if (currentColumn + span > GRID_COLUMNS) {
      // Commit current row: equalize heights
      finalizeRow(boxes, rowStart, boxes.length, currentRowHeight);
      currentRowY += currentRowHeight + safeGap;
      currentColumn = 0;
      currentRowHeight = 0;
      rowStart = boxes.length;
    }

    const width = span * columnWidth + (span - 1) * safeGap;
    const height = getNodeHeight(preparedNode, width);

    boxes.push({
      id: preparedNode.node.id,
      x: safePadding + currentColumn * (columnWidth + safeGap),
      y: currentRowY,
      width,
      height
    });

    currentColumn += span;
    currentRowHeight = Math.max(currentRowHeight, height);
  }

  // Finalize last row
  if (boxes.length > rowStart) {
    finalizeRow(boxes, rowStart, boxes.length, currentRowHeight);
  }

  return boxes;
}

/**
 * Equalize all heights to the row max height (no item shorter than its neighbours).
 */
function finalizeRow(
  boxes: LayoutBox[],
  rowStart: number,
  rowEnd: number,
  rowHeight: number
): void {
  if (rowStart >= rowEnd) return;

  for (let i = rowStart; i < rowEnd; i++) {
    boxes[i]!.height = rowHeight;
  }
}

function computeSpan(preparedNode: PreparedNode, columnWidth: number, gap: number): number {
  const preferredWidth = clamp(
    preparedNode.intrinsicSize.width,
    preparedNode.constraints.minWidth,
    preparedNode.constraints.maxWidth
  );

  const rawSpan = Math.ceil((preferredWidth + gap) / (columnWidth + gap));
  return clamp(rawSpan, 1, GRID_COLUMNS);
}
