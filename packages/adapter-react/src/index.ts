import type { LayoutBox } from "@fluidui/core";

export type ReactStyleObject = Record<string, number | string>;

export interface AbsoluteStyleOptions {
  roundToInteger?: boolean;
  zIndex?: number;
  includePointerEventsNone?: boolean;
}

export interface LayoutRenderItem<TNode extends { id: string }> {
  id: string;
  node: TNode;
  box: LayoutBox;
}

export function layoutBoxToAbsoluteStyle(
  box: LayoutBox,
  options: AbsoluteStyleOptions = {}
): ReactStyleObject {
  const round = options.roundToInteger !== false;
  const x = round ? Math.round(box.x) : box.x;
  const y = round ? Math.round(box.y) : box.y;
  const width = round ? Math.round(box.width) : box.width;
  const height = round ? Math.round(box.height) : box.height;

  const style: ReactStyleObject = {
    position: "absolute",
    left: x,
    top: y,
    width,
    height
  };

  if (typeof options.zIndex === "number") {
    style.zIndex = options.zIndex;
  }

  if (options.includePointerEventsNone) {
    style.pointerEvents = "none";
  }

  return style;
}

export function bindNodesToLayout<TNode extends { id: string }>(
  nodes: ReadonlyArray<TNode>,
  boxes: ReadonlyArray<LayoutBox>
): LayoutRenderItem<TNode>[] {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  return boxes.flatMap((box) => {
    const node = nodeById.get(box.id);
    if (!node) return [];

    return [
      {
        id: box.id,
        node,
        box
      }
    ];
  });
}

export function buildContainerStyle(width: number, height: number): ReactStyleObject {
  return {
    position: "relative",
    width,
    height
  };
}
