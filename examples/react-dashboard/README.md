# React Dashboard Example

Minimal React demo: one chatbot input, one generated dashboard output.

## Run

From this folder:

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## What it demonstrates

- Predictive layout pipeline:
  - `prepare(nodes)` once
  - `computeLayout(prepared, options)` for the rendered result
- Renderer-agnostic usage in React (absolute-positioned boxes)
- Widget rendering (KPI, compare, line charts, funnel, alerts, incidents, table)
- Pretext-backed text measurement activation at app bootstrap
- AI composer flow:
  - prompt -> mock RAG retrieval over multi-format docs (`pdf/csv/xlsx/docx/md/json`)
  - strict JSON `DashboardSpec` generation
  - JSON spec -> engine nodes -> predictive layout render
  - provider strategy in code: `auto` (Ollama with fallback mock)
  - networking:
    - dev UI calls Ollama through Vite proxy: `/ollama -> http://127.0.0.1:11434`
    - this avoids browser CORS issues against local Ollama
  - prompt control:
    - you can request explicit KPI count (example: `"dashboard with 8 kpi"`)

## Files

- `src/App.tsx`: minimal app container
- `src/dashboard/DashboardPage.tsx`: chatbot + generated result
- `src/dashboard/DashboardCanvas.tsx`: pure generated layout rendering
- `src/dashboard/AIComposer.tsx`: minimal chatbot input
- `src/dashboard/mockRag.ts`: retrieval simulation over built-in docs
- `src/dashboard/mockAgent.ts`: prompt -> DashboardSpec generator
- `src/dashboard/spec.ts`: JSON dashboard contract
- `src/dashboard/specToNodes.ts`: spec -> `Node[]` adapter
- `src/dashboard/fakeData.ts`: deterministic fake data generator
- `src/dashboard/nodes.ts`: data → engine nodes mapping
- `src/dashboard/DashboardWidget.tsx`: widget rendering by payload
- `src/ui/*`: reusable dashboard components
- `src/layout/useContainerWidth.ts`: resize observer hook
