# Agent Playbook (Demo Support)

This file is a support guide for running the "chatbot -> RAG -> JSON spec -> fluidUI render" demo consistently.

## Demo Story

User prompt example:

```text
Je veux un dashboard SaaS avec MRR, churn, activation, un comparatif Plan A vs Plan B,
un trend conversion, et un tableau des pages qui convertissent le mieux.
```

Expected pipeline:

1. Agent parses intent from natural language.
2. Agent queries RAG sources (PDF, CSV, DOCX, XLSX, JSON, Markdown).
3. Agent outputs strict `DashboardSpec` JSON.
4. Adapter maps JSON -> `Node[]`.
5. Engine runs `prepare(nodes)` then `computeLayout(prepared, options)`.
6. Renderer displays `LayoutBox[]`.

## Minimal `DashboardSpec` Contract

```ts
type WidgetKind = "kpi" | "compare" | "trend" | "table" | "summary";

interface DashboardSpec {
  widgets: Array<{
    id: string;
    kind: WidgetKind;
    title: string;
    payload: unknown;
  }>;
  layout: {
    width: number;
    type: "vertical" | "grid" | "masonry";
    gap?: number;
    padding?: number;
    columns?: number;
    minColumnWidth?: number;
  };
}
```

## Agent Quality Gates

1. Output must be valid JSON and schema-compliant.
2. Widget IDs must be unique.
3. Width and layout type must be present.
4. No HTML/CSS generation from the model for layout; only spec JSON.

## Demo Commands

```bash
npm run typecheck
npm run test
npm run example:react
```

Use `examples/react-dashboard` to showcase real-time behavior with live width and layout changes.
