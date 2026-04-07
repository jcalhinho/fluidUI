import { computeLayout, prepare, type LayoutBox, type LayoutType, type Node } from "@fluidui/core";
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
const ORB_MARGIN = 34;
const ORB_CLEARANCE = 50;
const ORB_VISUAL_MARGIN = 8;

interface ViewportSnapshot {
  width: number;
  height: number;
  scrollLeft: number;
  scrollTop: number;
}

interface Orb {
  x: number;
  y: number;
  radius: number;
}

interface HorizontalBounds {
  left: number;
  right: number;
}

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

function intersectsBox(a: LayoutBox, b: LayoutBox): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function intersectsOrb(box: LayoutBox, orb: Orb, clearance = 0): boolean {
  const safeRadius = orb.radius + clearance + ORB_VISUAL_MARGIN;
  const closestX = clamp(orb.x, box.x, box.x + box.width);
  const closestY = clamp(orb.y, box.y, box.y + box.height);
  const dx = orb.x - closestX;
  const dy = orb.y - closestY;
  return dx * dx + dy * dy < safeRadius * safeRadius;
}

function clampBoxX(box: LayoutBox, bounds: HorizontalBounds): LayoutBox {
  const maxX = Math.max(bounds.left, bounds.right - box.width);
  return {
    ...box,
    x: clamp(box.x, bounds.left, maxX),
  };
}

function candidateAvoidancePosition(
  source: LayoutBox,
  orb: Orb,
  bounds: HorizontalBounds,
  gap: number,
  clearance: number
): LayoutBox {
  const effectiveClearance = orb.radius + clearance;
  const maxX = Math.max(bounds.left, bounds.right - source.width);

  const candidates: LayoutBox[] = [
    source,
    { ...source, x: clamp(orb.x - effectiveClearance - source.width - gap, bounds.left, maxX) },
    { ...source, x: clamp(orb.x + effectiveClearance + gap, bounds.left, maxX) },
    { ...source, y: Math.max(0, orb.y - effectiveClearance - source.height - gap) },
    { ...source, y: Math.max(0, orb.y + effectiveClearance + gap) },
  ];

  let best = source;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    const stillIntersecting = intersectsOrb(candidate, orb, clearance);
    const centerDx =
      candidate.x + candidate.width / 2 - (source.x + source.width / 2);
    const centerDy =
      candidate.y + candidate.height / 2 - (source.y + source.height / 2);
    const moveScore = Math.sqrt(centerDx * centerDx + centerDy * centerDy);
    const score = moveScore + (stillIntersecting ? 1_000_000 : 0);
    if (score < bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return clampBoxX(best, bounds);
}

function resizeForAvoidance(source: LayoutBox, orb: Orb, bounds: HorizontalBounds): LayoutBox {
  const centerX = source.x + source.width / 2;
  const centerY = source.y + source.height / 2;
  const dx = centerX - orb.x;
  const dy = centerY - orb.y;
  const horizontalEscape = Math.abs(dx) >= Math.abs(dy);

  const minWidth = Math.max(200, Math.round(source.width * 0.74));
  const minHeight = Math.max(120, Math.round(source.height * 0.8));

  const next = horizontalEscape
    ? (() => {
    const width = Math.max(minWidth, Math.round(source.width * 0.88));
    const deltaWidth = source.width - width;
    const shiftedX = dx >= 0 ? source.x + deltaWidth : source.x;
    return { ...source, width, x: shiftedX };
  })()
    : (() => {
    const height = Math.max(minHeight, Math.round(source.height * 0.9));
    const deltaHeight = source.height - height;
    const shiftedY = dy >= 0 ? source.y + deltaHeight : source.y;
    return { ...source, height, y: shiftedY };
  })();

  return clampBoxX(next, bounds);
}

function forceClearFromOrb(
  source: LayoutBox,
  orb: Orb,
  bounds: HorizontalBounds,
  gap: number,
  clearance: number
): LayoutBox {
  let next = clampBoxX(source, bounds);
  let verticalDirection = next.y + next.height / 2 >= orb.y ? 1 : -1;
  const step = Math.max(12, Math.round(gap));

  for (let guard = 0; guard < 260; guard += 1) {
    if (!intersectsOrb(next, orb, clearance)) break;

    const centerX = next.x + next.width / 2;
    const dx = centerX - orb.x;
    if (Math.abs(dx) < orb.radius + next.width / 2 + clearance) {
      const shiftX = dx >= 0 ? step : -step;
      next = clampBoxX({ ...next, x: next.x + shiftX }, bounds);
    }

    const nextY = next.y + verticalDirection * step;
    if (nextY < 0) {
      verticalDirection = 1;
      next = { ...next, y: next.y + step };
    } else {
      next = { ...next, y: nextY };
    }
  }

  if (intersectsOrb(next, orb, clearance)) {
    if (verticalDirection > 0) {
      next = {
        ...next,
        y: Math.max(next.y, orb.y + orb.radius + clearance + gap),
      };
    } else {
      next = {
        ...next,
        y: Math.max(0, orb.y - (orb.radius + clearance + gap + next.height)),
      };
    }
  }

  return clampBoxX(next, bounds);
}

function resolveOverlaps(boxes: LayoutBox[], gap: number): LayoutBox[] {
  const resolved = boxes.map((box) => ({ ...box }));

  for (let pass = 0; pass < 4; pass += 1) {
    let changed = false;
    for (let i = 0; i < resolved.length; i += 1) {
      for (let j = i + 1; j < resolved.length; j += 1) {
        const first = resolved[i]!;
        const second = resolved[j]!;
        if (!intersectsBox(first, second)) continue;

        const firstBelowSecond = first.y > second.y;
        const upper = firstBelowSecond ? second : first;
        const lower = firstBelowSecond ? first : second;
        const overlapY = upper.y + upper.height - lower.y;
        if (overlapY <= 0) continue;

        lower.y += overlapY + gap;
        changed = true;
      }
    }
    if (!changed) break;
  }

  return resolved;
}

function applyOrbAvoidance(
  boxes: ReadonlyArray<LayoutBox>,
  orb: Orb | null,
  bounds: HorizontalBounds,
  gap: number
): LayoutBox[] {
  if (!orb) return boxes.map((box) => ({ ...box }));

  let working = boxes.map((box) => ({ ...box }));
  const overlapGap = Math.max(4, gap * 0.58);

  for (let pass = 0; pass < 6; pass += 1) {
    let changed = false;

    for (let index = 0; index < working.length; index += 1) {
      const current = working[index]!;
      if (!intersectsOrb(current, orb, ORB_CLEARANCE)) continue;
      const resized = resizeForAvoidance(current, orb, bounds);
      const moved = candidateAvoidancePosition(
        resized,
        orb,
        bounds,
        gap + pass,
        ORB_CLEARANCE
      );
      const cleared = forceClearFromOrb(
        moved,
        orb,
        bounds,
        gap + pass,
        ORB_CLEARANCE
      );
      working[index] = cleared;
      changed = true;
    }

    working = resolveOverlaps(working, overlapGap).map((box) => clampBoxX(box, bounds));
    working = working.map((box) =>
      forceClearFromOrb(box, orb, bounds, gap + pass, ORB_CLEARANCE)
    );

    const hasAnyCollision = working.some((box) =>
      intersectsOrb(box, orb, ORB_CLEARANCE)
    );
    if (!changed && !hasAnyCollision) break;
    if (!hasAnyCollision) break;
  }

  return working.map((box) => clampBoxX(box, bounds));
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

export function DashboardCanvas({ nodes, layoutType = "grid" }: DashboardCanvasProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerWidth = useContainerWidth(containerRef, 1200);
  const [viewport, setViewport] = useState<ViewportSnapshot>({
    width: 0,
    height: 0,
    scrollLeft: 0,
    scrollTop: 0,
  });
  const [orbEnabled, setOrbEnabled] = useState<boolean>(false);
  const [orbClock, setOrbClock] = useState<number>(() => performance.now());
  const effectiveWidth = Math.max(360, containerWidth);
  const columns = resolveColumns(effectiveWidth);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    let rafId: number | null = null;
    const syncViewport = (): void => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        setViewport({
          width: wrapper.clientWidth,
          height: wrapper.clientHeight,
          scrollLeft: wrapper.scrollLeft,
          scrollTop: wrapper.scrollTop,
        });
      });
    };

    syncViewport();
    wrapper.addEventListener("scroll", syncViewport, { passive: true });
    const resizeObserver = new ResizeObserver(syncViewport);
    resizeObserver.observe(wrapper);

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      wrapper.removeEventListener("scroll", syncViewport);
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!orbEnabled) return undefined;

    let rafId = 0;
    let lastCommit = 0;
    const tick = (now: number): void => {
      if (now - lastCommit >= 16) {
        setOrbClock(now);
        lastCommit = now;
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [orbEnabled]);

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

  const staticDisplayBoxes = useMemo(() => {
    const byId = new Map<string, LayoutBox>();
    if (headerBox) byId.set(headerBox.id, headerBox);
    if (menuBox) byId.set(menuBox.id, menuBox);
    for (const box of baseBoxesGlobal) byId.set(box.id, box);

    return orderedNodes.flatMap((node) => {
      const box = byId.get(node.id);
      return box ? [box] : [];
    });
  }, [headerBox, menuBox, baseBoxesGlobal, orderedNodes]);

  const rawOrb = useMemo<Orb | null>(() => {
    if (!orbEnabled) return null;
    if (viewport.width <= 0 || viewport.height <= 0) return null;

    const radius = clamp(Math.min(viewport.width, viewport.height) * 0.046, 12, 24);
    const margin = Math.max(ORB_MARGIN, radius + 12);
    const travelWidth = Math.max(1, viewport.width - margin * 2);
    const travelHeight = Math.max(1, viewport.height - margin * 2);
    const seconds = orbClock / 1000;

    const normalizedX = 0.5 + 0.5 * Math.sin(seconds * 0.36);
    const normalizedY = 0.5 + 0.5 * Math.sin(seconds * 0.5 + 1.17);
    const wobbleX = Math.sin(seconds * 0.92 + 0.25) * Math.min(6, travelWidth * 0.025);
    const wobbleY = Math.cos(seconds * 0.84 + 0.6) * Math.min(5, travelHeight * 0.025);
    const xInViewport = clamp(normalizedX * travelWidth + wobbleX, 0, travelWidth);
    const yInViewport = clamp(normalizedY * travelHeight + wobbleY, 0, travelHeight);

    return {
      x: viewport.scrollLeft + margin + xInViewport,
      y: viewport.scrollTop + margin + yInViewport,
      radius,
    };
  }, [orbClock, orbEnabled, viewport.height, viewport.scrollLeft, viewport.scrollTop, viewport.width]);

  const displayBoxes = useMemo(() => {
    return applyOrbAvoidance(
      staticDisplayBoxes,
      rawOrb,
      {
        left: LAYOUT_PADDING,
        right: Math.max(LAYOUT_PADDING + 1, effectiveWidth - LAYOUT_PADDING),
      },
      LAYOUT_GAP,
    );
  }, [staticDisplayBoxes, rawOrb, effectiveWidth]);

  // ── Drag state ─────────────────────────────────────────────────────────────
  const [drag, setDrag] = useState<DragState | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const dragEnabled = true;

  const [animatedBoxes, setAnimatedBoxes] = useState<LayoutBox[]>(displayBoxes);
  const animationTargetsRef = useRef<ReadonlyArray<LayoutBox>>(displayBoxes);

  useEffect(() => {
    animationTargetsRef.current = displayBoxes;
    setAnimatedBoxes((previous) => {
      const previousById = new Map(previous.map((box) => [box.id, box]));
      return displayBoxes.map((target) => {
        const current = previousById.get(target.id);
        return current ? { ...current } : { ...target };
      });
    });
  }, [displayBoxes]);

  useEffect(() => {
    let rafId = 0;
    const tick = (): void => {
      if (!drag) {
        const targets = animationTargetsRef.current;
        setAnimatedBoxes((previous) => {
          if (previous.length !== targets.length) {
            return targets.map((box) => ({ ...box }));
          }

          const previousById = new Map(previous.map((box) => [box.id, box]));
          let changed = false;
          const next = targets.map((target) => {
            const current = previousById.get(target.id);
            if (!current) {
              changed = true;
              return { ...target };
            }

            const posAlpha = 0.32;
            const sizeAlpha = 0.26;
            let x = current.x + (target.x - current.x) * posAlpha;
            let y = current.y + (target.y - current.y) * posAlpha;
            let width = current.width + (target.width - current.width) * sizeAlpha;
            let height = current.height + (target.height - current.height) * sizeAlpha;

            if (Math.abs(target.x - x) < 0.4) x = target.x;
            if (Math.abs(target.y - y) < 0.4) y = target.y;
            if (Math.abs(target.width - width) < 0.35) width = target.width;
            if (Math.abs(target.height - height) < 0.35) height = target.height;

            let candidate: LayoutBox = { ...target, x, y, width, height };
            if (rawOrb && intersectsOrb(candidate, rawOrb, ORB_CLEARANCE)) {
              candidate = { ...target };
            }

            if (
              Math.abs(candidate.x - current.x) > 0.01 ||
              Math.abs(candidate.y - current.y) > 0.01 ||
              Math.abs(candidate.width - current.width) > 0.01 ||
              Math.abs(candidate.height - current.height) > 0.01
            ) {
              changed = true;
            }
            return candidate;
          });

          return changed ? next : previous;
        });
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [drag, rawOrb]);

  const renderBoxes = drag ? displayBoxes : animatedBoxes;

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

  const orbTogglePosition = useMemo(() => {
    const toggleWidth = viewport.width < 480 ? 128 : 150;
    const left = viewport.scrollLeft + Math.max(8, viewport.width - toggleWidth - 10);
    const top = viewport.scrollTop + 10;
    return { left, top };
  }, [viewport.scrollLeft, viewport.scrollTop, viewport.width]);

  const boxById = useMemo(() => new Map(renderBoxes.map((b) => [b.id, b])), [renderBoxes]);

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
          className={`dashboard-canvas-wrapper ${orbEnabled ? "orb-mode-active" : ""}`}
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
              {renderBoxes.map((box) => {
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
          {rawOrb && (
            <div
              className="orb-demo-sphere"
              style={{
                left: rawOrb.x - rawOrb.radius,
                top: rawOrb.y - rawOrb.radius,
                width: rawOrb.radius * 2,
                height: rawOrb.radius * 2,
              }}
              aria-hidden="true"
            />
          )}
          <button
            type="button"
            className={`orb-demo-toggle ${orbEnabled ? "is-active" : ""}`}
            style={orbTogglePosition}
            onClick={() => setOrbEnabled((enabled) => !enabled)}
            aria-pressed={orbEnabled}
          >
            <span className="orb-demo-toggle-dot" aria-hidden="true" />
            <span>{orbEnabled ? "Orb Demo On" : "Orb Demo Off"}</span>
          </button>
        </div>
      </div>
    </section>
  );
}
