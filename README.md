# fluidUI Layout Engine

A DOM-independent, renderer-agnostic UI layout engine for dynamic dashboards and data-heavy interfaces.

`fluidui-layout-engine` separates expensive measurement from fast layout computation so you can reliably render complex UI structures in real time across browser and Node.js runtimes.

## Why fluidUI

- DOM-independent core logic in layout computation.
- Predictive pipeline: measure once, layout many times.
- Deterministic output for the same input and options.
- Strict TypeScript contracts for nodes, constraints, and layout options.
- Multiple layout strategies out of the box: `vertical`, `grid`, `masonry`.
- Optional high-quality text measurement via Pretext with automatic heuristic fallback.
- Renderer-agnostic: usable with DOM, Canvas, SSR, or custom renderers.
- Virtualization-friendly and export-friendly by design.

## Inspiration: Pretext -> fluidUI

fluidUI is explicitly inspired by the same architectural idea behind Pretext:
decouple measurement/layout from the DOM to avoid expensive reflow-driven logic in runtime UI paths.

- Pretext: text measurement and text layout without depending on live DOM traversal.
- fluidUI: component/card/widget layout without coupling layout computation to a specific renderer.

Short version:

`Inspired by Pretext's DOM-decoupled layout philosophy, fluidUI applies that approach to block-level UI layout.`

## DOM/CSS vs Predictive Engine

Typical renderer-coupled dashboard flow:

1. Render nodes.
2. Read back DOM sizes.
3. Trigger layout recalculation.
4. Re-render and repeat on width changes or interactions.

fluidUI predictive flow:

1. `prepare(nodes)` once.
2. `computeLayout(prepared, options)` many times.
3. Render boxes in any renderer.

Comparison:

| Topic | Traditional DOM/CSS-heavy flow | fluidUI predictive flow |
| --- | --- | --- |
| Layout source of truth | Runtime DOM measurements | Prepared cache + pure layout function |
| Determinism | Can drift across timing/reflow paths | Stable: same input -> same output |
| Renderer portability | Mostly tied to browser DOM | DOM, Canvas, SSR, custom renderers |
| Frequent relayouts | More costly (measure + layout loops) | Faster (`computeLayout` on prepared data) |

## Installation

```bash
npm install fluidui-layout-engine
```

## Quick Start

```ts
import { prepare, computeLayout, type Node } from "fluidui-layout-engine";

const nodes: Node[] = [
  {
    id: "kpi-throughput",
    type: "card",
    content: { title: "Throughput", value: "42000", delta: "+6.2%" },
    intrinsicSize: { width: 320, height: 180 }
  },
  {
    id: "trend-throughput",
    type: "chart",
    intrinsicSize: { width: 640, height: 280 }
  }
];

const prepared = prepare(nodes);

const boxes = computeLayout(prepared, {
  width: 1200,
  type: "masonry",
  gap: 12,
  padding: 16,
  columns: 3
});
```

## Core Concepts

### 1) `prepare(nodes, options?)`

The expensive phase:
- validates and normalizes nodes
- computes/caches measurements across width buckets
- returns `PreparedNode[]`

### 2) `computeLayout(preparedNodes, options)`

The fast phase:
- consumes prepared data only
- computes final `LayoutBox[]`
- does not re-measure node content

This split enables responsive or real-time UI updates with stable performance.

## Layout Modes

- `vertical`: top-to-bottom stacking
- `grid`: 12-column adaptive placement
- `masonry`: shortest-column placement

## Text Measurement

By default, text measurement uses a heuristic strategy. You can opt into Pretext:

```ts
import {
  configureTextMeasurement,
  initializePretextTextMeasurement,
  getTextMeasurementRuntimeState
} from "fluidui-layout-engine";

configureTextMeasurement({ font: "16px Inter", lineHeight: 22, whiteSpace: "normal" });
await initializePretextTextMeasurement({ strategy: "pretext" });

console.log(getTextMeasurementRuntimeState());
```

If Pretext cannot be initialized in the current runtime, the engine automatically falls back to heuristic measurement.

## API Surface

Primary exports:
- `prepare`
- `computeLayout`
- `measure`
- `configureTextMeasurement`
- `initializePretextTextMeasurement`
- `clearTextMeasurementCaches`
- `getTextMeasurementRuntimeState`

Primary types:
- `Node`, `NodeType`, `NodeConstraints`
- `PrepareOptions`, `PreparedNode`
- `LayoutOptions`, `LayoutType`, `LayoutBox`
- `Size`, `CachedMeasurement`

## Example App

A React dashboard demo is available at:

- [`examples/react-dashboard`](examples/react-dashboard)

It demonstrates:
- engine-first UI component composition (no AI runtime dependency)
- local component factory -> `Node[]` pipeline
- predictive layout rendering
- drag/swap interactions with deterministic relayout

### GitHub Pages

The example can be deployed automatically with:

- [`.github/workflows/pages.yml`](.github/workflows/pages.yml)

Once Pages is enabled with **Source = GitHub Actions**, the demo is published from `examples/react-dashboard/dist`.

## Development

### Prerequisites

- Node.js 20+
- npm 10+

### Commands

```bash
npm install
npm run lint
npm run typecheck
npm run test
npm run bench
npm run build
npm run lint:example
npm run example:dashboard
npm run example:react
```

## Use Via GitHub

If you want users to consume the engine directly from GitHub (without npm publish), they can install the package from a branch, tag, or commit:

```bash
# Latest from default branch
npm install git+https://github.com/<owner>/<repo>.git

# Pin to a tag or commit
npm install git+https://github.com/<owner>/<repo>.git#v0.1.0
npm install git+https://github.com/<owner>/<repo>.git#<commit-sha>
```

The package runs `prepare` on Git installs, so `dist/` is built automatically.

Then import it normally:

```ts
import { prepare, computeLayout } from "fluidui-layout-engine";
```

## Testing and Validation

Current automated validation includes:
- layout determinism
- boundary safety
- cache stability
- predictive pipeline advantage (`prepare once + layout many`)
- benchmark gate (`bench/baseline.json` thresholds)

See:
- [`docs/USE_CASE_VALIDATION.md`](docs/USE_CASE_VALIDATION.md)

## Repository Docs

- Agent demo playbook: [`docs/AGENT_PLAYBOOK.md`](docs/AGENT_PLAYBOOK.md)
- Use-case validation: [`docs/USE_CASE_VALIDATION.md`](docs/USE_CASE_VALIDATION.md)
- Changelog: [`CHANGELOG.md`](CHANGELOG.md)

## Contributing

Please read [`CONTRIBUTING.md`](CONTRIBUTING.md) before opening a pull request.

## Security

Please report vulnerabilities according to [`SECURITY.md`](SECURITY.md).

## Code of Conduct

This project follows the Contributor Covenant. See [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).

## License

MIT. See [`LICENSE`](LICENSE).
