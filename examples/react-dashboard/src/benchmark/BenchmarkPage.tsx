import {
  computeLayout,
  prepare,
  type LayoutBox,
  type LayoutType,
  type Node,
  type PreparedNode
} from "@fluidui/core";
import { useEffect, useMemo, useRef, useState } from "react";

type BenchMode = "play" | "pause";

interface PaneStats {
  lastMs: number;
  medianMs: number;
  overBudget: number;
  history: number[];
}

const HISTORY_LENGTH = 90;
const FRAME_BUDGET_MS = 16.7;
const BAR_SCALE_MS = 80;
const LAYOUT_GAP = 12;
const LAYOUT_PADDING = 16;
const MIN_WIDTH = 480;
const MAX_WIDTH = 1400;

const EMPTY_STATS: PaneStats = {
  lastMs: 0,
  medianMs: 0,
  overBudget: 0,
  history: []
};

function medianOf(buffer: ReadonlyArray<number>): number {
  if (buffer.length === 0) return 0;
  const sorted = [...buffer].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

function recordSample(previous: PaneStats, value: number): PaneStats {
  const history = [...previous.history, value];
  if (history.length > HISTORY_LENGTH) history.shift();
  return {
    lastMs: value,
    medianMs: medianOf(history),
    overBudget: previous.overBudget + (value > FRAME_BUDGET_MS ? 1 : 0),
    history
  };
}

/** Deterministic PRNG so both panes always render the exact same dataset. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeNodes(count: number, seed: number): Node[] {
  const random = mulberry32(seed);
  const kinds: Node["type"][] = ["card", "text", "chart", "custom"];
  const nodes: Node[] = [];

  for (let index = 0; index < count; index += 1) {
    const kind = kinds[Math.floor(random() * kinds.length)]!;
    const width = 180 + Math.round(random() * 320);
    const height = 90 + Math.round(random() * 220);
    nodes.push({
      id: `bench-${index}`,
      type: kind,
      content: {
        title: `Widget ${index + 1}`,
        body: "Representative widget content that must be re-measured by the browser whenever the container width changes."
      },
      intrinsicSize: { width, height }
    });
  }

  return nodes;
}

function LatencyBars({ history, accent }: { history: number[]; accent: string }): JSX.Element {
  return (
    <div className="bench-bars" aria-hidden="true">
      {Array.from({ length: HISTORY_LENGTH }, (_, index) => {
        const value = history[index];
        const heightPercent = value === undefined ? 0 : Math.min(100, (value / BAR_SCALE_MS) * 100);
        const overBudget = value !== undefined && value > FRAME_BUDGET_MS;
        return (
          <span
            key={index}
            className={`bench-bar ${overBudget ? "is-over" : ""}`}
            style={{
              height: `${heightPercent}%`,
              backgroundColor: overBudget ? undefined : accent
            }}
          />
        );
      })}
      <span className="bench-bars-budget" style={{ bottom: `${(FRAME_BUDGET_MS / BAR_SCALE_MS) * 100}%` }} />
    </div>
  );
}

interface PaneProps {
  title: string;
  subtitle: string;
  accent: string;
  stats: PaneStats;
  boxes: ReadonlyArray<LayoutBox>;
  canvasWidth: number;
  canvasHeight: number;
}

function BoxPane({ title, subtitle, accent, stats, boxes, canvasWidth, canvasHeight }: PaneProps): JSX.Element {
  const janked = stats.overBudget > 0;

  return (
    <section className={`bench-pane ${janked ? "is-janked" : ""}`}>
      <header className="bench-pane-header">
        <div className="bench-pane-heading">
          <h3 className="bench-pane-title" style={{ color: accent }}>{title}</h3>
          <p className="bench-pane-subtitle">{subtitle}</p>
        </div>
        <div className="bench-pane-stats">
          <span className="bench-stat">
            <span className="bench-stat-label">median</span>
            <span className="bench-stat-value">{stats.medianMs.toFixed(2)} ms</span>
          </span>
          <span className="bench-stat">
            <span className="bench-stat-label">over budget</span>
            <span className={`bench-stat-value ${janked ? "is-over" : ""}`}>{stats.overBudget}</span>
          </span>
        </div>
      </header>
      <div className="bench-canvas-outer">
        <div className="bench-canvas" style={{ width: canvasWidth, height: canvasHeight }}>
          {boxes.map((box) => (
            <div
              key={box.id}
              className="bench-box"
              style={{
                left: box.x,
                top: box.y,
                width: box.width,
                height: box.height,
                borderColor: accent
              }}
            />
          ))}
        </div>
      </div>
      <footer className="bench-pane-footer">
        <LatencyBars history={stats.history} accent={accent} />
        <span className="bench-bars-caption">
          layout cost per width change · red line = {FRAME_BUDGET_MS} ms frame budget
        </span>
      </footer>
    </section>
  );
}

export function BenchmarkPage(): JSX.Element {
  const [nodeCount, setNodeCount] = useState<number>(1000);
  const [layoutType, setLayoutType] = useState<LayoutType>("masonry");
  const [mode, setMode] = useState<BenchMode>("play");

  const nodes = useMemo(() => makeNodes(nodeCount, 20260911), [nodeCount]);

  // fluidUI pipeline: prepare ONCE, then layout many times.
  const preparedOnce = useMemo<PreparedNode[]>(() => prepare(nodes), [nodes]);

  // Hidden DOM layer used by the naive pane to perform REAL geometry reads
  // (offsetHeight), exactly like a DOM-coupled dashboard would every frame.
  const measureLayerRef = useRef<HTMLDivElement>(null);

  const [width, setWidth] = useState<number>(960);
  const [naiveStats, setNaiveStats] = useState<PaneStats>(EMPTY_STATS);
  const [predictiveStats, setPredictiveStats] = useState<PaneStats>(EMPTY_STATS);

  const naiveBoxesRef = useRef<LayoutBox[]>([]);
  const predictiveBoxesRef = useRef<LayoutBox[]>([]);
  const [naiveBoxes, setNaiveBoxes] = useState<LayoutBox[]>([]);
  const [predictiveBoxes, setPredictiveBoxes] = useState<LayoutBox[]>([]);

  // Reset stats when the dataset or layout changes.
  useEffect(() => {
    setNaiveStats(EMPTY_STATS);
    setPredictiveStats(EMPTY_STATS);
    setNaiveBoxes([]);
    setPredictiveBoxes([]);
  }, [nodes, layoutType]);

  useEffect(() => {
    if (mode === "pause") return undefined;

    let rafId = 0;
    let lastTick = 0;
    let phase = 0;

    const tick = (now: number): void => {
      rafId = requestAnimationFrame(tick);
      if (now - lastTick < 16) return;
      lastTick = now;

      phase += 0.05;
      const nextWidth = Math.round(
        MIN_WIDTH + (MAX_WIDTH - MIN_WIDTH) * (0.5 + 0.5 * Math.sin(phase))
      );
      setWidth(nextWidth);

      const options = {
        width: nextWidth,
        type: layoutType,
        gap: LAYOUT_GAP,
        padding: LAYOUT_PADDING,
        minColumnWidth: 260
      };

      // ── Naive flow (DOM-coupled, like a real dashboard) ──────────────────
      // 1. Resize the live DOM container to the new width.
      // 2. Read real geometry (offsetHeight) → forces a synchronous reflow
      //    of every widget, exactly what DOM-coupled layouts pay each frame.
      // 3. Compute the layout from the fresh measurements.
      const layer = measureLayerRef.current;
      const naiveStart = performance.now();
      if (layer) {
        layer.style.width = `${nextWidth}px`;
        const children = layer.children;
        for (let index = 0; index < children.length; index += 1) {
          void (children[index] as HTMLElement).offsetHeight;
        }
      }
      const naivePrepared = prepare(nodes);
      const naiveLayout = computeLayout(naivePrepared, options);
      const naiveMs = performance.now() - naiveStart;
      naiveBoxesRef.current = naiveLayout;
      setNaiveStats((previous) => recordSample(previous, naiveMs));

      // ── Predictive flow: layout only, on already-prepared nodes. ─────────
      const predictiveStart = performance.now();
      const predictiveLayout = computeLayout(preparedOnce, options);
      const predictiveMs = performance.now() - predictiveStart;
      predictiveBoxesRef.current = predictiveLayout;
      setPredictiveStats((previous) => recordSample(previous, predictiveMs));

      setNaiveBoxes(naiveBoxesRef.current);
      setPredictiveBoxes(predictiveBoxesRef.current);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [mode, nodes, preparedOnce, layoutType]);

  // performance.now() resolution can read 0 for sub-5µs layouts; floor the
  // denominator so the ratio stays meaningful when fluidUI is too fast.
  const speedup =
    naiveStats.medianMs > 0
      ? naiveStats.medianMs / Math.max(predictiveStats.medianMs, 0.005)
      : 0;
  const speedupLabel =
    speedup >= 1000 ? "1000x+" : speedup > 0 ? `${speedup.toFixed(1)}x` : "—";

  const canvasHeight = useMemo(() => {
    const bottom = predictiveBoxes.reduce(
      (max, box) => Math.max(max, box.y + box.height),
      LAYOUT_PADDING
    );
    return bottom + LAYOUT_PADDING;
  }, [predictiveBoxes]);

  return (
    <section className="bench-page">
      <div className="bench-hero" role="status">
        <span className="bench-speedup-label">fluidUI is</span>
        <span className="bench-speedup-value">{speedupLabel}</span>
        <span className="bench-speedup-label">faster per relayout</span>
      </div>

      <header className="bench-toolbar">
        <div className="bench-toolbar-group">
          <span className="bench-toolbar-label">Widgets</span>
          {([120, 400, 1000] as const).map((count) => (
            <button
              key={count}
              type="button"
              className={`bench-chip ${nodeCount === count ? "is-active" : ""}`}
              onClick={() => setNodeCount(count)}
            >
              {count}
            </button>
          ))}
        </div>
        <div className="bench-toolbar-group">
          <span className="bench-toolbar-label">Layout</span>
          {(["masonry", "grid", "vertical"] as const).map((option) => (
            <button
              key={option}
              type="button"
              className={`bench-chip ${layoutType === option ? "is-active" : ""}`}
              onClick={() => setLayoutType(option)}
            >
              {option}
            </button>
          ))}
        </div>
        <div className="bench-toolbar-group">
          <button
            type="button"
            className={`bench-chip bench-chip-run ${mode === "play" ? "is-active" : ""}`}
            onClick={() => setMode((current) => (current === "play" ? "pause" : "play"))}
          >
            {mode === "play" ? "⏸ Pause" : "▶ Run"}
          </button>
        </div>
      </header>

      <p className="bench-explainer">
        The container width animates continuously. The left pane replays the
        DOM-coupled flow: it resizes a live container and reads real geometry
        (<code>offsetHeight</code>) on every widget — a forced synchronous
        reflow — before computing the layout. The right pane uses the
        predictive pipeline (<code>prepare()</code> once,{" "}
        <code>computeLayout()</code> on every width change) and never touches
        the DOM for measurements. Same dataset, same options — only the
        pipeline differs.
      </p>

      <div className="bench-panes">
        <BoxPane
          title="Naive · DOM measurement"
          subtitle="offsetHeight reflow + layout on every width change"
          accent="#f87171"
          stats={naiveStats}
          boxes={naiveBoxes}
          canvasWidth={width}
          canvasHeight={canvasHeight}
        />
        <BoxPane
          title="fluidUI · predictive"
          subtitle="prepare() once, computeLayout() on every width change"
          accent="#60a5fa"
          stats={predictiveStats}
          boxes={predictiveBoxes}
          canvasWidth={width}
          canvasHeight={canvasHeight}
        />
      </div>

      {/* Hidden live container the naive pane measures every frame.
          Each item mirrors the DOM complexity of a real dashboard widget. */}
      <div ref={measureLayerRef} className="bench-measure-layer" aria-hidden="true">
        {nodes.map((node) => {
          const title =
            node.content && typeof node.content === "object" && "title" in node.content
              ? String(node.content.title)
              : "";
          const body =
            node.content && typeof node.content === "object" && "body" in node.content
              ? String(node.content.body)
              : "";
          return (
            <div key={node.id} className="bench-measure-item">
              <div className="bench-measure-head">
                <strong>{title}</strong>
                <em>live</em>
              </div>
              <div className="bench-measure-kpis">
                <div><i>KPI 1</i><b>42 000</b></div>
                <div><i>KPI 2</i><b>+6.2%</b></div>
                <div><i>KPI 3</i><b>98.1</b></div>
              </div>
              <p>{body}</p>
              <div className="bench-measure-chart">
                <span /><span /><span /><span /><span /><span />
              </div>
              <div className="bench-measure-foot">
                <span>updated 2 min ago</span>
                <span>source: pipeline</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
