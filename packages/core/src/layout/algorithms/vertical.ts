import type { LayoutBox, PreparedNode } from "../../types";
import { DEFAULT_GAP, DEFAULT_PADDING, coerceNonNegativeNumber } from "../shared";
import { getNodeHeight, getNodeWidth } from "../helpers";

export function computeVerticalLayout(
  preparedNodes: ReadonlyArray<PreparedNode>,
  containerWidth: number,
  gap?: number,
  padding?: number
): LayoutBox[] {
  const safeGap = coerceNonNegativeNumber(gap, DEFAULT_GAP);
  const safePadding = coerceNonNegativeNumber(padding, DEFAULT_PADDING);
  const availableWidth = Math.max(1, containerWidth - safePadding * 2);

  let cursorY = safePadding;

  return preparedNodes.map((preparedNode) => {
    const width = getNodeWidth(preparedNode, availableWidth);
    const height = getNodeHeight(preparedNode, width);

    const box: LayoutBox = {
      id: preparedNode.node.id,
      x: safePadding,
      y: cursorY,
      width,
      height
    };

    cursorY += height + safeGap;
    return box;
  });
}
