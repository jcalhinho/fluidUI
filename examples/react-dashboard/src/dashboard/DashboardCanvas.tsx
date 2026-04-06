import { computeLayout, prepare, type LayoutBox, type LayoutType, type Node } from "@engine";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useContainerWidth } from "../layout/useContainerWidth";
import { isWidgetPayload } from "./types";
import { DashboardWidget } from "./DashboardWidget";

interface DashboardCanvasProps {
  nodes: ReadonlyArray<Node>;
  layoutType?: LayoutType;
}

const LAYOUT_GAP = 16;
const LAYOUT_PADDING = 20;

function resolveColumns(width: number): number {
  if (width < 760) return 1;
  if (width < 1180) return 2;
  return 3;
}

interface StructuredNodes {
  headerNode: Node | null;
  menuNode: Node | null;
  freeNodes: Node[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function isWidgetKind(node: Node, widget: string): boolean {
  return isWidgetPayload(node.content) && node.content.widget === widget;
}

function splitStructuredNodes(nodes: readonly Node[]): StructuredNodes {
  let headerNode: Node | null = null;
  let menuNode: Node | null = null;
  const freeNodes: Node[] = [];

  for (const node of nodes) {
    if (isWidgetKind(node, "header") && headerNode === null) {
      headerNode = node;
      continue;
    }
    if (isWidgetKind(node, "menu") && menuNode === null) {
      menuNode = node;
      continue;
    }
    freeNodes.push(node);
  }

  return { headerNode, menuNode, freeNodes };
}

function estimateScaledHeight(node: Node, width: number, fallbackHeight: number): number {
  const intrinsicWidth = node.intrinsicSize?.width;
  const intrinsicHeight = node.intrinsicSize?.height;
  if (!intrinsicWidth || !intrinsicHeight) return fallbackHeight;
  const ratio = intrinsicHeight / Math.max(1, intrinsicWidth);
  return Math.round(width * ratio);
}

/** Return the id of the box whose center is closest to (px, py),
 *  excluding the ignored id. Returns null when no box is under the pointer. */
function findDropTarget(
  boxes: LayoutBox[],
  px: number,
  py: number,
  excludeId: string
): string | null {
  let best: string | null = null;
  let bestDist = Infinity;

  for (const box of boxes) {
    if (box.id === excludeId) continue;
    // Point dans le box ?
    if (
      px >= box.x &&
      px <= box.x + box.width &&
      py >= box.y &&
      py <= box.y + box.height
    ) {
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      const dist = (px - cx) ** 2 + (py - cy) ** 2;
      if (dist < bestDist) {
        bestDist = dist;
        best = box.id;
      }
    }
  }
  return best;
}

/** Swap two items in an array immutably. */
function swapIds(order: string[], idA: string, idB: string): string[] {
  const next = [...order];
  const ia = next.indexOf(idA);
  const ib = next.indexOf(idB);
  if (ia === -1 || ib === -1) return next;
  [next[ia], next[ib]] = [next[ib]!, next[ia]!];
  return next;
}

// ── State du drag ────────────────────────────────────────────────────────────

interface DragState {
  nodeId: string;
  // Pointer position in canvas coordinates (relative to the wrapper)
  pointerX: number;
  pointerY: number;
  // Offset between widget top-left corner and pointer at drag start
  offsetX: number;
  offsetY: number;
}

// ── Composant ────────────────────────────────────────────────────────────────

export function DashboardCanvas({ nodes, layoutType = "masonry" }: DashboardCanvasProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerWidth = useContainerWidth(containerRef, 1200);
  const effectiveWidth = Math.max(360, containerWidth);
  const columns = resolveColumns(effectiveWidth);

  // Ordre courant des nodes (permet le swap sans toucher aux nodes d'origine)
  const [nodeOrder, setNodeOrder] = useState<string[]>(() => nodes.map((n) => n.id));
  // Sync state if incoming nodes change (new dashboard generated)
  useEffect(() => {
    setNodeOrder(nodes.map((n) => n.id));
  }, [nodes]);

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  // Nodes dans l'ordre courant
  const orderedNodes = useMemo<Node[]>(() => {
    return nodeOrder.flatMap((id) => {
      const n = nodeById.get(id);
      return n ? [n] : [];
    });
  }, [nodeOrder, nodeById]);

  const structuredNodes = useMemo(() => splitStructuredNodes(orderedNodes), [orderedNodes]);
  const structuredIds = useMemo(
    () =>
      new Set(
        [structuredNodes.headerNode?.id, structuredNodes.menuNode?.id].filter(
          (id): id is string => typeof id === "string"
        )
      ),
    [structuredNodes]
  );
  const draggableIds = useMemo(
    () => new Set(structuredNodes.freeNodes.map((node) => node.id)),
    [structuredNodes.freeNodes]
  );

  const hasHeader = structuredNodes.headerNode !== null;
  const hasMenu = structuredNodes.menuNode !== null;
  const headerWidth = Math.max(320, effectiveWidth - LAYOUT_PADDING * 2);
  const sidebarWidth = hasMenu
    ? clamp(Math.round(effectiveWidth * 0.22), 200, 320)
    : 0;
  const contentWidth = Math.max(
    320,
    effectiveWidth -
      (hasMenu
        ? sidebarWidth + LAYOUT_GAP
        : 0)
  );
  const headerHeight = hasHeader
    ? clamp(
        estimateScaledHeight(structuredNodes.headerNode!, headerWidth, 64),
        52,
        76
      )
    : 0;

  const contentOriginX =
    LAYOUT_PADDING + (hasMenu ? sidebarWidth + LAYOUT_GAP : 0);
  const contentOriginY =
    hasHeader ? headerHeight + LAYOUT_GAP : LAYOUT_PADDING;

  const prepared = useMemo(
    () => prepare(structuredNodes.freeNodes),
    [structuredNodes.freeNodes]
  );

  const baseBoxesLocal = useMemo(() => {
    return computeLayout(prepared, {
      width: contentWidth,
      type: layoutType,
      gap: LAYOUT_GAP,
      padding: LAYOUT_PADDING,
      columns,
      minColumnWidth: 280,
    });
  }, [prepared, contentWidth, layoutType, columns]);

  const baseBoxesGlobal = useMemo(
    () =>
      baseBoxesLocal.map((box) => ({
        ...box,
        x: contentOriginX + (box.x - LAYOUT_PADDING),
        y: contentOriginY + (box.y - LAYOUT_PADDING),
      })),
    [baseBoxesLocal, contentOriginX, contentOriginY]
  );

  const headerBox = useMemo<LayoutBox | null>(() => {
    if (!structuredNodes.headerNode) return null;
    return {
      id: structuredNodes.headerNode.id,
      x: LAYOUT_PADDING,
      y: 0,
      width: headerWidth,
      height: headerHeight,
    };
  }, [structuredNodes.headerNode, headerWidth, headerHeight]);

  const menuBox = useMemo<LayoutBox | null>(() => {
    if (!structuredNodes.menuNode) return null;
    const contentBottom = baseBoxesGlobal.reduce(
      (max, box) => Math.max(max, box.y + box.height),
      contentOriginY
    );
    const scaledMenuHeight = estimateScaledHeight(structuredNodes.menuNode, sidebarWidth, 260);
    const height = Math.max(190, scaledMenuHeight, contentBottom - contentOriginY);

    return {
      id: structuredNodes.menuNode.id,
      x: LAYOUT_PADDING,
      y: contentOriginY,
      width: sidebarWidth,
      height,
    };
  }, [structuredNodes.menuNode, baseBoxesGlobal, contentOriginY, sidebarWidth]);

  const displayBoxes = useMemo(() => {
    const byId = new Map<string, LayoutBox>();
    if (headerBox) byId.set(headerBox.id, headerBox);
    if (menuBox) byId.set(menuBox.id, menuBox);
    for (const box of baseBoxesGlobal) byId.set(box.id, box);

    return orderedNodes.flatMap((node) => {
      const box = byId.get(node.id);
      return box ? [box] : [];
    });
  }, [headerBox, menuBox, baseBoxesGlobal, orderedNodes]);

  const draggableBoxes = useMemo(
    () => displayBoxes.filter((box) => draggableIds.has(box.id)),
    [displayBoxes, draggableIds]
  );

  const canvasHeight = useMemo(() => {
    const boxesBottom = displayBoxes.reduce(
      (max, box) => Math.max(max, box.y + box.height),
      LAYOUT_PADDING
    );
    return boxesBottom + LAYOUT_PADDING;
  }, [displayBoxes]);

  // ── Drag state ─────────────────────────────────────────────────────────────
  const [drag, setDrag] = useState<DragState | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const dragEnabled = true;

  const boxById = useMemo(() => new Map(displayBoxes.map((b) => [b.id, b])), [displayBoxes]);

  // Dragged box position follows the pointer
  const dragBox = useMemo<LayoutBox | null>(() => {
    if (!drag) return null;
    const orig = boxById.get(drag.nodeId);
    if (!orig) return null;
    return {
      ...orig,
      x: drag.pointerX - drag.offsetX,
      y: drag.pointerY - drag.offsetY,
    };
  }, [drag, boxById]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const getCanvasCoords = useCallback((clientX: number, clientY: number): { x: number; y: number } => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return { x: clientX, y: clientY };
    return {
      x: clientX - rect.left + (wrapperRef.current?.scrollLeft ?? 0),
      y: clientY - rect.top + (wrapperRef.current?.scrollTop ?? 0),
    };
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent, nodeId: string) => {
      if (!dragEnabled) return;
      if (!draggableIds.has(nodeId)) return;
      const target = e.target as HTMLElement;
      const isHandle =
        target.classList.contains("widget-drag-handle") ||
        target.closest(".widget-header") !== null;
      if (!isHandle) return;

      e.currentTarget.setPointerCapture(e.pointerId);
      e.preventDefault();

      const box = boxById.get(nodeId);
      if (!box) return;

      const { x: px, y: py } = getCanvasCoords(e.clientX, e.clientY);

      setDrag({
        nodeId,
        pointerX: px,
        pointerY: py,
        offsetX: px - box.x,
        offsetY: py - box.y,
      });
      setHoverId(null);
    },
    [dragEnabled, draggableIds, boxById, getCanvasCoords]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragEnabled) return;
      if (!drag) return;
      const { x: px, y: py } = getCanvasCoords(e.clientX, e.clientY);

      // Current center point of the dragged widget
      const orig = boxById.get(drag.nodeId);
      const halfW = (orig?.width ?? 0) / 2;
      const halfH = (orig?.height ?? 0) / 2;
      const centerX = px - drag.offsetX + halfW;
      const centerY = py - drag.offsetY + halfH;

      setDrag((d) => (d ? { ...d, pointerX: px, pointerY: py } : null));
      setHoverId(findDropTarget(draggableBoxes, centerX, centerY, drag.nodeId));
    },
    [dragEnabled, drag, draggableBoxes, boxById, getCanvasCoords]
  );

  const onPointerUp = useCallback(() => {
    if (drag && hoverId && hoverId !== drag.nodeId) {
      setNodeOrder((prev) => swapIds(prev, drag.nodeId, hoverId));
    }
    setDrag(null);
    setHoverId(null);
  }, [drag, hoverId]);

  const resetLayout = useCallback(() => {
    setNodeOrder(nodes.map((n) => n.id));
  }, [nodes]);

  const hasReordered = useMemo(
    () => nodeOrder.some((id, i) => id !== nodes[i]?.id),
    [nodeOrder, nodes]
  );
  const showReset = hasReordered;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <section className="dashboard-root">
      {showReset && (
        <div className="dashboard-controls">
          <button type="button" className="dashboard-reset-btn" onClick={resetLayout}>
            ↺ Reset layout
          </button>
        </div>
      )}

      <div ref={containerRef} className="dashboard-host">
        <div
          ref={wrapperRef}
          className="dashboard-canvas-wrapper"
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          {nodes.length === 0 ? (
            <div className="dashboard-empty">
              <span className="dashboard-empty-icon">✦</span>
              <p>Select components in the builder panel.</p>
            </div>
          ) : (
            <div className="dashboard-canvas" style={{ height: canvasHeight }}>
              {displayBoxes.map((box) => {
                const node = nodeById.get(box.id);
                if (!node) return null;

                const isDragging = drag?.nodeId === box.id;
                const isDropTarget = hoverId === box.id;
                const isLocked = structuredIds.has(box.id);

                return (
                  <div
                    key={box.id}
                    className={[
                      "dashboard-box",
                      isLocked ? "is-locked" : "",
                      isDragging ? "is-drag-source" : "",
                      isDropTarget ? "is-drop-target" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    style={{
                      left: box.x,
                      top: box.y,
                      width: box.width,
                      height: box.height,
                      zIndex: isDragging ? 0 : isDropTarget ? 4 : isLocked ? 6 : 1,
                    }}
                    onPointerDown={isLocked ? undefined : (e) => onPointerDown(e, box.id)}
                  >
                    <DashboardWidget node={node} isDragging={false} isLocked={isLocked} />

                    {/* Drop indicator */}
                    {isDropTarget && (
                      <div className="drop-indicator" aria-hidden="true">
                        <span>Swap here</span>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Ghost element following the pointer during drag */}
              {drag && dragBox && (() => {
                const node = nodeById.get(drag.nodeId);
                if (!node) return null;
                return (
                  <div
                    className="dashboard-box is-dragging"
                    style={{
                      left: dragBox.x,
                      top: dragBox.y,
                      width: dragBox.width,
                      height: dragBox.height,
                      zIndex: 200,
                      pointerEvents: "none",
                    }}
                    >
                      <DashboardWidget node={node} isDragging isLocked={false} />
                    </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
