import { computeLayout } from "../layout/compute-layout";
import { prepare } from "../prepare";
import type { LayoutBox, LayoutOptions, Node } from "../types";

interface DashboardItem {
  id: string;
  type: Node["type"];
  title: string;
}

interface DashboardResult {
  width: number;
  mode: LayoutOptions["type"];
  boxes: LayoutBox[];
  items: DashboardItem[];
}

const SAMPLE_NODES: Node[] = [
  {
    id: "kpi-revenue",
    type: "card",
    content: { title: "Revenue", value: "€42,000", trend: "+12.4%" },
    intrinsicSize: { width: 320, height: 180 }
  },
  {
    id: "kpi-churn",
    type: "card",
    content: { title: "Churn", value: "2.1%", trend: "-0.3%" },
    intrinsicSize: { width: 320, height: 180 }
  },
  {
    id: "kpi-nps",
    type: "card",
    content: { title: "NPS", value: "54", trend: "+2" },
    intrinsicSize: { width: 320, height: 180 }
  },
  {
    id: "chart-revenue",
    type: "chart",
    content: { title: "Revenue by Week" },
    intrinsicSize: { width: 640, height: 280 }
  },
  {
    id: "chart-cohorts",
    type: "chart",
    content: { title: "Retention Cohorts" },
    intrinsicSize: { width: 640, height: 300 }
  },
  {
    id: "ops-notes",
    type: "text",
    content:
      "Ops notes: investigate conversion drop on mobile safari, verify subscription retries, and follow up with support on high-priority tickets."
  },
  {
    id: "custom-widget",
    type: "custom",
    content: { widget: "alerts" },
    intrinsicSize: { width: 420, height: 260 },
    constraints: { minWidth: 260, maxWidth: 520 }
  }
];

const TITLES: Record<string, string> = {
  "kpi-revenue": "KPI Revenue",
  "kpi-churn": "KPI Churn",
  "kpi-nps": "KPI NPS",
  "chart-revenue": "Revenue Chart",
  "chart-cohorts": "Cohorts Chart",
  "ops-notes": "Ops Notes",
  "custom-widget": "Alerts Widget"
};

function parseLayoutType(raw: string | undefined): LayoutOptions["type"] {
  if (raw === "vertical" || raw === "grid" || raw === "masonry") {
    return raw;
  }
  return "masonry";
}

function parsePositiveNumber(raw: string | undefined, fallback: number): number {
  if (!raw) {
    return fallback;
  }

  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return value;
}

function parseOptionsFromCli(argv: readonly string[]): LayoutOptions {
  const mode = parseLayoutType(argv[0]);
  const width = parsePositiveNumber(argv[1], 1200);
  const columns = parsePositiveNumber(argv[2], 3);

  return {
    type: mode,
    width,
    gap: 12,
    padding: 16,
    columns
  };
}

function buildDashboardLayout(options: LayoutOptions): DashboardResult {
  const prepared = prepare(SAMPLE_NODES);
  const boxes = computeLayout(prepared, options);

  const items: DashboardItem[] = SAMPLE_NODES.map((node) => ({
    id: node.id,
    type: node.type,
    title: TITLES[node.id] ?? node.id
  }));

  return {
    width: options.width,
    mode: options.type,
    boxes,
    items
  };
}

function printResult(result: DashboardResult): void {
  const itemById = new Map(result.items.map((item) => [item.id, item]));
  const rows = result.boxes.map((box) => {
    const item = itemById.get(box.id);
    return {
      id: box.id,
      title: item?.title ?? box.id,
      type: item?.type ?? "custom",
      x: Math.round(box.x),
      y: Math.round(box.y),
      width: Math.round(box.width),
      height: Math.round(box.height)
    };
  });

  const dashboardHeight = result.boxes.reduce((max, box) => {
    return Math.max(max, box.y + box.height);
  }, 0);

  console.log(`\nDashboard layout computed (${result.mode})`);
  console.log(`container width: ${result.width}px`);
  console.log(`estimated height: ${Math.round(dashboardHeight)}px\n`);
  console.table(rows);
}

function main(): void {
  const cliOptions = parseOptionsFromCli(process.argv.slice(2));
  const result = buildDashboardLayout(cliOptions);
  printResult(result);
}

main();

