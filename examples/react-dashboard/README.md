# React Dashboard Example (Engine-First)

This example is now focused on one thing:
**rapid UI composition with the fluidUI engine (no AI flow, no backend dependency).**

## Goal

- Instantiate the most common dashboard UI components
- Arrange them instantly with `computeLayout` (`masonry`, `grid`, `vertical`)
- Keep the pipeline DOM-free at engine level (`prepare` + `computeLayout`)

## Run

From this folder:

```bash
npm install
npm run dev
npm run test
npm run lint
```

Open `http://localhost:5173`.

## What the demo includes

- Local component factory (`componentFactory.ts`) for realistic widget payloads
- Top header builder (horizontal) with template dropdown
- **30 templates** accessible from the dropdown, with one-click generation
- Layout switcher + density mode + seed randomization in the same control bar
- Real stress mode: component multiplication + heavy content payloads
- New narrative widget with **lettrine** (`dropcap`) to stress text measurement/wrapping
- Fast drag/swap interactions on rendered boxes
- Smoke tests with Vitest + Testing Library (`src/test`)

## Key files

- `src/dashboard/DashboardPage.tsx`: builder controls + generated node pipeline
- `src/dashboard/componentFactory.ts`: component payload generation -> `Node[]`
- `src/dashboard/DashboardCanvas.tsx`: render + drag/swap + layout recompute
- `src/dashboard/DashboardWidget.tsx`: widget type rendering
- `src/dashboard/types.ts`: typed payload contracts for UI components
