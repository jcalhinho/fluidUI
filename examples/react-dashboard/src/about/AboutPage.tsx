const BENCHMARK_REFERENCE = {
  environment: "Reference run: Node 20 / Apple Silicon",
  datasetSize: 320,
  widthCount: 18,
  prepareMsMedian: 3.12,
  predictiveLayoutManyMsMedian: 0.15,
  predictiveTotalMsMedian: 3.26,
  naiveTotalMsMedian: 62.0,
  speedupMedian: 19.03,
};

const ENGINE_HIGHLIGHTS = [
  "DOM-independent layout computation in the engine core",
  "Two-phase pipeline: prepare() then computeLayout()",
  "Deterministic placement for equal input and options",
  "Renderer-agnostic output: DOM, Canvas, SSR, custom renderers",
];

const USE_CASES = [
  "Realtime dashboard composition and responsive relayout",
  "Virtualized card walls with predictable height/position updates",
  "Canvas/Offscreen UI rendering where DOM measurement is unavailable",
  "Export workflows that need stable, repeatable layout snapshots",
];

export function AboutPage(): JSX.Element {
  return (
    <section className="about-page">
      <header className="about-hero">
        <p className="about-eyebrow">fluidUI layout engine</p>
        <h1>About / Inspiration / Benchmarks</h1>
        <p className="about-lead">
          fluidUI applies a Pretext-inspired architecture to UI block layout:
          move costly measurement out of hot render paths, then compute placement
          with deterministic, reusable data.
        </p>
      </header>

      <section className="about-section">
        <h2>About fluidUI</h2>
        <div className="about-grid">
          {ENGINE_HIGHLIGHTS.map((highlight) => (
            <article key={highlight} className="about-card">
              <p>{highlight}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="about-section">
        <h2>Inspiration</h2>
        <div className="about-grid about-grid--split">
          <article className="about-card">
            <h3>Pretext (text)</h3>
            <p>
              Decouple text measurement/layout from live DOM reads to avoid
              reflow-driven bottlenecks in dynamic interfaces.
            </p>
          </article>
          <article className="about-card">
            <h3>fluidUI (blocks/widgets)</h3>
            <p>
              Apply the same architecture to cards, widgets, and dashboard
              blocks through a pure layout engine pipeline.
            </p>
          </article>
        </div>
      </section>

      <section className="about-section">
        <h2>Benchmark Snapshot</h2>
        <p className="about-caption">{BENCHMARK_REFERENCE.environment}</p>
        <div className="about-kpi-grid">
          <article className="about-kpi">
            <span>Median speedup</span>
            <strong>{BENCHMARK_REFERENCE.speedupMedian.toFixed(2)}x</strong>
          </article>
          <article className="about-kpi">
            <span>Predictive total</span>
            <strong>{BENCHMARK_REFERENCE.predictiveTotalMsMedian.toFixed(2)} ms</strong>
          </article>
          <article className="about-kpi">
            <span>Naive total</span>
            <strong>{BENCHMARK_REFERENCE.naiveTotalMsMedian.toFixed(2)} ms</strong>
          </article>
        </div>
        <table className="about-table">
          <tbody>
            <tr>
              <th>Dataset size</th>
              <td>{BENCHMARK_REFERENCE.datasetSize}</td>
            </tr>
            <tr>
              <th>Width count</th>
              <td>{BENCHMARK_REFERENCE.widthCount}</td>
            </tr>
            <tr>
              <th>prepare() median</th>
              <td>{BENCHMARK_REFERENCE.prepareMsMedian.toFixed(2)} ms</td>
            </tr>
            <tr>
              <th>computeLayout() many widths median</th>
              <td>{BENCHMARK_REFERENCE.predictiveLayoutManyMsMedian.toFixed(2)} ms</td>
            </tr>
            <tr>
              <th>prepare+layout median</th>
              <td>{BENCHMARK_REFERENCE.predictiveTotalMsMedian.toFixed(2)} ms</td>
            </tr>
            <tr>
              <th>naive re-prepare median</th>
              <td>{BENCHMARK_REFERENCE.naiveTotalMsMedian.toFixed(2)} ms</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="about-section">
        <h2>Where this architecture helps most</h2>
        <ul className="about-list">
          {USE_CASES.map((useCase) => (
            <li key={useCase}>{useCase}</li>
          ))}
        </ul>
      </section>

      <section className="about-section">
        <h2>Reproduce locally</h2>
        <pre className="about-code">
{`# from examples/react-dashboard
npm run test
npm run bench
npm run bench:ci`}
        </pre>
      </section>
    </section>
  );
}
