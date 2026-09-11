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

interface TimingStats {
  lastMs: number;
  medianMs: number;
  samples: number;
}

const SAMPLE_WINDOW = 120;
const LAYOUT_GAP = 12;
const LAYOUT_PADDING = 16;
const MIN_WIDTH = 480;
const MAX_WIDTH = 1400;
const TICK_MS = 33;

const EMPTY_STATS: TimingStats = { lastMs: 0, medianMs: 0, samples: 0 };

function medianOf(buffer: ReadonlyArray<number>): number {
  if (buffer.length === 0) return 0;
  const sorted = [...buffer].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

function recordSample(buffer: number[], value: number): TimingStats {
  buffer.push(value);
  if (buffer.length > SAMPLE_WINDOW) buffer.shift();
  return {
    lastMs: value,
    medianMs: medianOf(buffer),
    samples: buffer.length
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
        body: "Benchmark payload with a few lines of representative content."
      },
      intrinsicSize: { width, height }
    });
  }

  return nodes;
}

interface PaneProps {
  title: string;
  subtitle: string;
  accent: string;
  stats: TimingStats;
  boxes: ReadonlyArray<LayoutBox>;
  canvasWidth: number;
  canvasHeight: number;
}

function BoxPane({ title, subtitle, accent, stats, boxes, canvasWidth, canvasHeight }: PaneProps): JSX.Element {
  return (
    <section className="bench-pane">
      <header className="bench-pane-header">
        <div>
          <h3 className="bench-pane-title" style={{ color: accent }}>{title}</h3>
          <p className="bench-pane-subtitle">{subtitle}</p>
        </div>
        <div className="bench-pane-stats">
          <span className="bench-stat">
            <span className="bench-stat-label">last</span>
            <span className="bench-stat-value">{stats.lastMs.toFixed(2)} ms</span>
          </span>
          <span className="bench-stat">
            <span className="bench-stat-label">median</span>
            <span className="bench-stat-value">{stats.medianMs.toFixed(2)} ms</span>
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
    </section>
  );
}

export function BenchmarkPage(): JSX.Element {
  const [nodeCount, setNodeCount] = useState<number>(120);
  const [layoutType, setLayoutType] = useState<LayoutType>("masonry");
  const [mode, setMode] = useState<BenchMode>("play");

  const nodes = useMemo(() => makeNodes(nodeCount, 20260911), [nodeCount]);

  // fluidUI pipeline: prepare ONCE, then layout many times.
  const preparedOnce = useMemo<PreparedNode[]>(() => prepare(nodes), [nodes]);

  const [width, setWidth] = useState<number>(960);
  const [naiveStats, setNaiveStats] = useState<TimingStats>(EMPTY_STATS);
  const [predictiveStats, setPredictiveStats] = useState<TimingStats>(EMPTY_STATS);

  const naiveBufferRef = useRef<number[]>([]);
  const predictiveBufferRef = useRef<number[]>([]);
  const naiveBoxesRef = useRef<LayoutBox[]>([]);
  const predictiveBoxesRef = useRef<LayoutBox[]>([]);
  const [naiveBoxes, setNaiveBoxes] = useState<LayoutBox[]>([]);
  const [predictiveBoxes, setPredictiveBoxes] = useState<LayoutBox[]>([]);

  // Reset stats when the dataset or layout changes.
  useEffect(() => {
    naiveBufferRef.current = [];
    predictiveBufferRef.current = [];
    setNaiveStats(EMPTY_STATS);
    setPredictiveStats(EMPTY_STATS);
  }, [nodes, layoutType]);

  useEffect(() => {
    if (mode === "pause") return undefined;

    let rafId = 0;
    let lastTick = 0;
    let phase = 0;

    const tick = (now: number): void => {
      rafId = requestAnimationFrame(tick);
      if (now - lastTick < TICK_MS) return;
      lastTick = now;

      phase += 0.045;
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

      // Naive flow: re-measure (prepare) on EVERY width change, like a
      // DOM-coupled pipeline re-reading geometry each frame.
      const naiveStart = performance.now();
      const naivePrepared = prepare(nodes);
      const naiveLayout = computeLayout(naivePrepared, options);
      const naiveMs = performance.now() - naiveStart;
      naiveBoxesRef.current = naiveLayout;
      setNaiveStats(recordSample(naiveBufferRef.current, naiveMs));

      // Predictive flow: layout only, on already-prepared nodes.
      const predictiveStart = performance.now();
      const predictiveLayout = computeLayout(preparedOnce, options);
      const predictiveMs = performance.now() - predictiveStart;
      predictiveBoxesRef.current = predictiveLayout;
      setPredictiveStats(recordSample(predictiveBufferRef.current, predictiveMs));

      setNaiveBoxes(naiveBoxesRef.current);
      setPredictiveBoxes(predictiveBoxesRef.current);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [mode, nodes, preparedOnce, layoutType]);

  const speedup =
    predictiveStats.medianMs > 0.001
      ? naiveStats.medianMs / predictiveStats.medianMs
      : 0;

  const canvasHeight = useMemo(() => {
    const bottom = predictiveBoxes.reduce(
      (max, box) => Math.max(max, box.y + box.height),
      LAYOUT_PADDING
    );
    return bottom + LAYOUT_PADDING;
  }, [predictiveBoxes]);

  return (
    <section className="bench-page">
      <header className="bench-toolbar">
        <div className="bench-toolbar-group">
          <span className="bench-toolbar-label">Widgets</span>
          {([60, 120, 240] as const).map((count) => (
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
        <div className="bench-speedup" role="status">
          <span className="bench-speedup-label">speedup</span>
          <span className="bench-speedup-value">{speedup > 0 ? `${speedup.toFixed(1)}x` : "—"}</span>
        </div>
      </header>

      <p className="bench-explainer">
        The container width animates continuously. The left pane replays the
        DOM-coupled flow (measure + layout on every width change); the right
        pane uses the predictive pipeline (<code>prepare()</code> once,{" "}
        <code>computeLayout()</code> on every width change). Same dataset, same
        options — only the pipeline differs.
      </p>

      <div className="bench-panes">
        <BoxPane
          title="Naive"
          subtitle="prepare() + computeLayout() on every width change"
          accent="#f87171"
          stats={naiveStats}
          boxes={naiveBoxes}
          canvasWidth={width}
          canvasHeight={canvasHeight}
        />
        <BoxPane
          title="fluidUI"
          subtitle="prepare() once, computeLayout() on every width change"
          accent="#60a5fa"
          stats={predictiveStats}
          boxes={predictiveBoxes}
          canvasWidth={width}
          canvasHeight={canvasHeight}
        />
      </div>
    </section>
  );
}
