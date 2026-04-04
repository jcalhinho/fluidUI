# fluidUI Layout Engine

A DOM-free, renderer-agnostic layout engine for dynamic dashboards and data-heavy UIs.

`fluidui-layout-engine` separates expensive measurement from fast layout computation so you can reliably render complex UI structures in real time across browser and Node.js runtimes.

## Why fluidUI

- Predictive pipeline: measure once, layout many times.
- Deterministic output for the same input and options.
- Strict TypeScript contracts for nodes, constraints, and layout options.
- Multiple layout strategies out of the box: `vertical`, `grid`, `masonry`.
- Optional high-quality text measurement via Pretext with automatic heuristic fallback.
- Works without DOM APIs in core logic.

## Installation

```bash
npm install fluidui-layout-engine
```

## Quick Start

```ts
import { prepare, computeLayout, type Node } from "fluidui-layout-engine";

const nodes: Node[] = [
  {
    id: "kpi-revenue",
    type: "card",
    content: { title: "MRR", value: "€42,000", delta: "+6.2%" },
    intrinsicSize: { width: 320, height: 180 }
  },
  {
    id: "trend-revenue",
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
- chatbot-driven dashboard generation
- strict JSON spec -> node mapping
- predictive layout rendering
- optional Ollama provider flow with fallback behavior

## Development

### Prerequisites

- Node.js 20+
- npm 10+

### Commands

```bash
npm install
npm run typecheck
npm run test
npm run build
npm run example:dashboard
npm run example:react
```

## Testing and Validation

Current automated validation includes:
- layout determinism
- boundary safety
- cache stability
- predictive pipeline advantage (`prepare once + layout many`)

See:
- [`docs/USE_CASE_VALIDATION.md`](docs/USE_CASE_VALIDATION.md)

## Repository Docs

- Agent demo playbook: [`docs/AGENT_PLAYBOOK.md`](docs/AGENT_PLAYBOOK.md)
- Use-case validation: [`docs/USE_CASE_VALIDATION.md`](docs/USE_CASE_VALIDATION.md)

## Contributing

Please read [`CONTRIBUTING.md`](CONTRIBUTING.md) before opening a pull request.

## Security

Please report vulnerabilities according to [`SECURITY.md`](SECURITY.md).

## Code of Conduct

This project follows the Contributor Covenant. See [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).

## License

MIT. See [`LICENSE`](LICENSE).
