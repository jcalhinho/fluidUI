import { computeLayout, prepare, type LayoutBox, type LayoutType, type Node } from "@engine";
import { useMemo, useRef } from "react";
import { useContainerWidth } from "../layout/useContainerWidth";
import { DashboardWidget } from "./DashboardWidget";

interface DashboardCanvasProps {
  nodes: ReadonlyArray<Node>;
  layoutType?: LayoutType;
}

function estimateCanvasHeight(boxes: readonly LayoutBox[]): number {
  let max = 0;
  for (const box of boxes) {
    max = Math.max(max, box.y + box.height);
  }
  return Math.ceil(max);
}

function resolveColumns(width: number): number {
  if (width < 760) {
    return 1;
  }
  if (width < 1180) {
    return 2;
  }
  return 3;
}

export function DashboardCanvas({ nodes, layoutType = "masonry" }: DashboardCanvasProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const containerWidth = useContainerWidth(containerRef, 1200);
  const effectiveWidth = Math.max(360, containerWidth);

  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const prepared = useMemo(() => prepare(nodes), [nodes]);
  const columns = resolveColumns(effectiveWidth);

  const boxes = useMemo(() => {
    return computeLayout(prepared, {
      width: effectiveWidth,
      type: layoutType,
      gap: 12,
      padding: 16,
      columns,
      minColumnWidth: 280
    });
  }, [prepared, effectiveWidth, layoutType, columns]);

  const height = estimateCanvasHeight(boxes);

  return (
    <section className="dashboard-root">
      <div ref={containerRef} className="dashboard-host">
        <div className="dashboard-canvas-wrapper">
          {nodes.length === 0 ? (
            <div className="dashboard-empty">En attente d&apos;une demande chatbot...</div>
          ) : (
            <div className="dashboard-canvas" style={{ height }}>
              {boxes.map((box) => {
                const node = nodeById.get(box.id);
                if (!node) {
                  return null;
                }

                return (
                  <div
                    key={box.id}
                    className="dashboard-box"
                    style={{
                      left: box.x,
                      top: box.y,
                      width: box.width,
                      height: box.height
                    }}
                  >
                    <DashboardWidget node={node} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
