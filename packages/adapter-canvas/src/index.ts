import type { LayoutBox } from "@fluidui/core";

export interface CanvasRectStyle {
  strokeStyle?: string;
  fillStyle?: string;
  lineWidth?: number;
}

export interface CanvasRectCommand {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  style: Required<CanvasRectStyle>;
}

const DEFAULT_STYLE: Required<CanvasRectStyle> = {
  strokeStyle: "#2563eb",
  fillStyle: "rgba(37, 99, 235, 0.08)",
  lineWidth: 1
};

export function toCanvasRectCommands(
  boxes: ReadonlyArray<LayoutBox>,
  style: CanvasRectStyle = {}
): CanvasRectCommand[] {
  const mergedStyle: Required<CanvasRectStyle> = {
    strokeStyle: style.strokeStyle ?? DEFAULT_STYLE.strokeStyle,
    fillStyle: style.fillStyle ?? DEFAULT_STYLE.fillStyle,
    lineWidth: style.lineWidth ?? DEFAULT_STYLE.lineWidth
  };

  return boxes.map((box) => ({
    id: box.id,
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    style: mergedStyle
  }));
}

export function hitTestLayoutBox(
  boxes: ReadonlyArray<LayoutBox>,
  x: number,
  y: number
): LayoutBox | null {
  for (let index = boxes.length - 1; index >= 0; index -= 1) {
    const box = boxes[index];
    if (!box) continue;

    const inside = x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height;
    if (inside) return box;
  }

  return null;
}
