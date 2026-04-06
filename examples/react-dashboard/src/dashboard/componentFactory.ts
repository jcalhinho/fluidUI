import type { Node } from "@fluidui/core";
import type {
  ActivityPayload,
  AlertsPayload,
  BigNumberPayload,
  CollapsibleMenuPayload,
  ComparePayload,
  DropcapPayload,
  FunnelChartPayload,
  HeaderPayload,
  IncidentPayload,
  KpiPayload,
  LineChartPayload,
  SummaryPayload,
  TablePayload,
  Tone,
} from "./types";

export type WidgetCounts = Record<string, number>;

export type BuilderDensity = "showcase" | "stress";

export interface BuildNodesOptions {
  counts: WidgetCounts;
  density: BuilderDensity;
  seed: number;
}

const FALLBACK_COUNTS: WidgetCounts = {
  bignumber: 1,
  kpi: 2,
  line: 1,
  funnel: 1,
  alerts: 1,
  activity: 1,
  incidents: 1,
  table: 1,
  summary: 1,
  dropcap: 1,
};

const STRESS_NODE_MULTIPLIER = 4;
const STRESS_MIN_COUNTS: Readonly<Record<string, number>> = {
  bignumber: 2,
  kpi: 5,
  line: 4,
  funnel: 3,
  alerts: 4,
  activity: 4,
  incidents: 4,
  table: 3,
  summary: 8,
  dropcap: 6,
};

export function buildDemoNodes(options: BuildNodesOptions): Node[] {
  const counts = expandCountsForDensity(withFallbackCounts(options.counts), options.density);
  const densityFactor = options.density === "stress" ? 1.7 : 1;
  const random = createRng(options.seed);
  const nodes: Node[] = [];

  for (const [widgetType, count] of Object.entries(counts)) {
    for (let index = 0; index < count; index += 1) {
      nodes.push(buildNode(widgetType, index, random, densityFactor, options.density));
    }
  }

  return nodes;
}

function withFallbackCounts(input: WidgetCounts): WidgetCounts {
  let total = 0;
  for (const value of Object.values(input)) {
    total += Number(value) || 0;
  }
  if (total > 0) return input;
  return { ...FALLBACK_COUNTS };
}

function expandCountsForDensity(counts: WidgetCounts, density: BuilderDensity): WidgetCounts {
  if (density !== "stress") {
    return { ...counts };
  }

  const expanded: WidgetCounts = {};
  for (const [widgetType, rawCount] of Object.entries(counts)) {
    const count = Math.max(0, Math.floor(Number(rawCount) || 0));
    if (count === 0) {
      expanded[widgetType] = 0;
      continue;
    }
    const minimum = STRESS_MIN_COUNTS[widgetType] ?? count;
    expanded[widgetType] = Math.max(count * STRESS_NODE_MULTIPLIER, minimum);
  }
  return expanded;
}

function buildNode(
  widgetType: string,
  index: number,
  random: () => number,
  densityFactor: number,
  density: BuilderDensity,
): Node {
  switch (widgetType) {
    case "header":
      return {
        id: `header-${index + 1}`,
        type: "custom",
        content: buildHeaderPayload(index, random, density),
        intrinsicSize: scaleSize({ width: 620, height: 220 }, densityFactor),
      };
    case "menu":
      return {
        id: `menu-${index + 1}`,
        type: "custom",
        content: buildMenuPayload(index, random, density),
        intrinsicSize: scaleSize({ width: 390, height: 300 }, densityFactor),
      };
    case "bignumber":
      return {
        id: `bignumber-${index + 1}`,
        type: "card",
        content: buildBigNumberPayload(index, random),
        intrinsicSize: scaleSize({ width: 360, height: 220 }, densityFactor),
      };
    case "kpi":
      return {
        id: `kpi-${index + 1}`,
        type: "card",
        content: buildKpiPayload(index, random),
        intrinsicSize: scaleSize({ width: 340, height: 190 }, densityFactor),
      };
    case "line":
      return {
        id: `line-${index + 1}`,
        type: "chart",
        content: buildLinePayload(index, random, density),
        intrinsicSize: scaleSize({ width: 560, height: 280 }, densityFactor),
      };
    case "compare":
      return {
        id: `compare-${index + 1}`,
        type: "card",
        content: buildComparePayload(index, random),
        intrinsicSize: scaleSize({ width: 360, height: 210 }, densityFactor),
      };
    case "funnel":
      return {
        id: `funnel-${index + 1}`,
        type: "chart",
        content: buildFunnelPayload(index, random, density),
        intrinsicSize: scaleSize({ width: 560, height: 300 }, densityFactor),
      };
    case "alerts":
      return {
        id: `alerts-${index + 1}`,
        type: "custom",
        content: buildAlertsPayload(index, random, density),
        intrinsicSize: scaleSize({ width: 420, height: 260 }, densityFactor),
      };
    case "activity":
      return {
        id: `activity-${index + 1}`,
        type: "custom",
        content: buildActivityPayload(index, random, density),
        intrinsicSize: scaleSize({ width: 420, height: 280 }, densityFactor),
      };
    case "incidents":
      return {
        id: `incidents-${index + 1}`,
        type: "custom",
        content: buildIncidentsPayload(index, random, density),
        intrinsicSize: scaleSize({ width: 420, height: 250 }, densityFactor),
      };
    case "table":
      return {
        id: `table-${index + 1}`,
        type: "custom",
        content: buildTablePayload(index, random, density),
        intrinsicSize: scaleSize({ width: 590, height: 310 }, densityFactor),
      };
    case "summary":
      return {
        id: `summary-${index + 1}`,
        type: "text",
        content: buildSummaryPayload(index, density, random),
        constraints: density === "stress"
          ? { minWidth: 280, maxWidth: 760 }
          : { minWidth: 280, maxWidth: 640 },
      };
    case "dropcap":
      return {
        id: `dropcap-${index + 1}`,
        type: "text",
        content: buildDropcapPayload(index, density, random),
        constraints: density === "stress"
          ? { minWidth: 320, maxWidth: 860 }
          : { minWidth: 300, maxWidth: 700 },
      };
    default:
      return {
        id: `custom-${widgetType}-${index + 1}`,
        type: "custom",
        content: {
          widget: "summary",
          title: "Unknown component",
          text: `Widget type ${widgetType} is not supported by the factory.`,
        } satisfies SummaryPayload,
        intrinsicSize: scaleSize({ width: 360, height: 200 }, densityFactor),
      };
  }
}

function scaleSize(size: { width: number; height: number }, densityFactor: number): { width: number; height: number } {
  return {
    width: Math.max(220, Math.round(size.width / densityFactor)),
    height: Math.max(140, Math.round(size.height / densityFactor)),
  };
}

function buildBigNumberPayload(index: number, random: () => number): BigNumberPayload {
  const base = 1_200_000 + index * 140_000 + Math.round(random() * 80_000);
  const delta = ((random() - 0.45) * 18).toFixed(1);
  const tone: Tone = Number(delta) >= 0 ? "positive" : "negative";
  const deltaText = `${Number(delta) >= 0 ? "+" : "/core"}${delta}%`;
  return {
    widget: "bignumber",
    title: `Core Metric ${index + 1}`,
    value: base.toLocaleString("en-US"),
    delta: deltaText,
    tone,
    label: "Primary throughput",
    sublabel: "Continuously updated",
  };
}

function buildHeaderPayload(index: number, random: () => number, density: BuilderDensity): HeaderPayload {
  const quartile = ["Q1", "Q2", "Q3", "Q4"][index % 4] ?? "Q1";
  const activeFlows = Math.round(12 + random() * (density === "stress" ? 44 : 20));
  const cards = Math.round(24 + random() * (density === "stress" ? 76 : 32));
  return {
    widget: "header",
    title: `Dashboard cockpit ${index + 1}`,
    subtitle: `${cards} components rendered · ${activeFlows} active streams`,
    eyebrow: `Control ${quartile} · operator view`,
    badges: [
      density === "stress" ? "stress mode" : "showcase mode",
      `seed #${Math.round(1000 + random() * 8999)}`,
      `latency p95 ${(120 + random() * 180).toFixed(0)}ms`,
    ],
  };
}

function buildMenuPayload(index: number, random: () => number, density: BuilderDensity): CollapsibleMenuPayload {
  const stressItems = density === "stress" ? 6 : 4;
  const makeItems = (prefix: string): string[] =>
    Array.from({ length: stressItems }, (_, itemIndex) => `${prefix} ${itemIndex + 1}`);

  return {
    widget: "menu",
    title: `Navigation modules ${index + 1}`,
    groups: [
      {
        id: `menu-overview-${index}`,
        label: "Overview",
        defaultOpen: true,
        items: makeItems("Section"),
      },
      {
        id: `menu-ops-${index}`,
        label: "Operations",
        defaultOpen: random() > 0.4,
        items: makeItems("Runbook"),
      },
      {
        id: `menu-insights-${index}`,
        label: "Insights",
        defaultOpen: random() > 0.7,
        items: makeItems("Report"),
      },
    ],
  };
}

function buildKpiPayload(index: number, random: () => number): KpiPayload {
  const history = buildSeries(7, 84 + index * 5, random, 10);
  const start = history[0] ?? 0;
  const end = history[history.length - 1] ?? start;
  const ratio = start === 0 ? 0 : ((end - start) / Math.abs(start)) * 100;
  const tone: Tone = ratio >= 0 ? "positive" : "negative";
  return {
    widget: "kpi",
    title: `Pipeline ${index + 1}`,
    subtitle: "Conversion rate",
    value: `${(22 + random() * 14).toFixed(1)}%`,
    delta: `${ratio >= 0 ? "+" : "/core"}${ratio.toFixed(1)}%`,
    tone,
  };
}

function buildLinePayload(index: number, random: () => number, density: BuilderDensity): LineChartPayload {
  const pointCount = density === "stress" ? 48 : 12;
  const labels = buildPeriodLabels(pointCount, density === "stress" ? "T" : "P");
  const points = buildSeries(pointCount, 100 + index * 8, random, density === "stress" ? 24 : 16);
  const first = points[0] ?? 0;
  const last = points[points.length - 1] ?? first;
  const delta = first === 0 ? 0 : ((last - first) / Math.abs(first)) * 100;
  const tone: Tone = delta >= 0 ? "positive" : "negative";
  return {
    widget: "line",
    title: `Trend evolution ${index + 1}`,
    unit: "count",
    points,
    labels,
    change: `${delta >= 0 ? "+" : "/core"}${delta.toFixed(1)}%`,
    tone,
  };
}

function buildComparePayload(index: number, random: () => number): ComparePayload {
  const leftValue = 60 + index * 6 + Math.round(random() * 18);
  const rightValue = leftValue + Math.round((random() - 0.3) * 22);
  return {
    widget: "compare",
    title: `Target vs Actual ${index + 1}`,
    leftLabel: "Target",
    rightLabel: "Actual",
    leftValue,
    rightValue,
    unit: "%",
  };
}

function buildFunnelPayload(index: number, random: () => number, density: BuilderDensity): FunnelChartPayload {
  const top = 16_000 + index * 1_100 + Math.round(random() * 1_200);
  const stages = density === "stress"
    ? [
        { label: "Visitors", value: top },
        { label: "Leads", value: Math.round(top * 0.42) },
        { label: "Qualified", value: Math.round(top * 0.28) },
        { label: "Decision makers", value: Math.round(top * 0.18) },
        { label: "Proposals", value: Math.round(top * 0.11) },
        { label: "Negotiation", value: Math.round(top * 0.07) },
        { label: "Customers", value: Math.round(top * 0.05) },
      ]
    : [
        { label: "Visitors", value: top },
        { label: "Leads", value: Math.round(top * 0.36) },
        { label: "Qualified", value: Math.round(top * 0.2) },
        { label: "Proposals", value: Math.round(top * 0.11) },
        { label: "Customers", value: Math.round(top * 0.06) },
      ];
  return {
    widget: "funnel",
    title: `Acquisition funnel ${index + 1}`,
    stages,
  };
}

function buildAlertsPayload(index: number, random: () => number, density: BuilderDensity): AlertsPayload {
  const stressMessages = [
    "API latency > 1.4s in 3 zones (eu-west-1, us-east-1, ap-southeast-1) with partial worker saturation.",
    "Worker queue saturated: backlog > 8,200 jobs, estimated catch-up time is 17 minutes.",
    "Retry flow rising: +41% in the last 30 minutes, spike correlated with an upstream timeout.",
    "Dashboard render time degraded on low-end mobile clients, p95 moved from 240ms to 470ms.",
    "Intermittent webhook errors on ingestion stream: invalid checksum on 2.3% of events.",
  ];
  const baseAlerts: AlertsPayload["alerts"] = [
    { id: `a-${index}-1`, severity: "critical", message: "API latency > 1.4s", minutesAgo: 2 + Math.round(random() * 5) },
    { id: `a-${index}-2`, severity: "high", message: "Worker queue saturated", minutesAgo: 8 + Math.round(random() * 10) },
    { id: `a-${index}-3`, severity: "medium", message: "Retry flow rising", minutesAgo: 16 + Math.round(random() * 14) },
  ];
  const alerts = density === "stress"
    ? stressMessages.map((message, messageIndex) => ({
        id: `a-${index}-${messageIndex + 1}`,
        severity: (["critical", "high", "medium", "low"][messageIndex % 4] ?? "low") as AlertsPayload["alerts"][number]["severity"],
        message,
        minutesAgo: 2 + messageIndex * 3 + Math.round(random() * 4),
      }))
    : baseAlerts;

  return {
    widget: "alerts",
    title: `Active alerts ${index + 1}`,
    alerts,
  };
}

function buildActivityPayload(index: number, random: () => number, density: BuilderDensity): ActivityPayload {
  const itemCount = density === "stress" ? 12 : 4;
  return {
    widget: "activity",
    title: `Recent activity ${index + 1}`,
    items: Array.from({ length: itemCount }, (_, itemIndex) => ({
      id: `act-${index}-${itemIndex + 1}`,
      actor: ["Ops Bot", "Platform", "Support", "Growth", "DataOps"][itemIndex % 5] ?? "Ops Bot",
      action: ["scaled", "synced", "tagged", "published", "reconciled"][itemIndex % 5] ?? "updated",
      target: density === "stress"
        ? `pipeline-${itemIndex + 1} · scope=global · batch=${1200 + itemIndex * 37}`
        : ["worker-pool", "event stream", "incident #842", "campaign A/B"][itemIndex % 4] ?? "pipeline",
      time: `${2 + itemIndex * 2 + Math.round(random() * 3)} min`,
    })),
  };
}

function buildIncidentsPayload(index: number, random: () => number, density: BuilderDensity): IncidentPayload {
  const statuses: IncidentPayload["incidents"] = density === "stress"
    ? Array.from({ length: 8 }, (_, itemIndex) => ({
        id: `inc-${index}-${itemIndex + 1}`,
        service: `Service-${itemIndex + 1}`,
        status: (["investigating", "monitoring", "resolved"][itemIndex % 3] ?? "resolved") as IncidentPayload["incidents"][number]["status"],
        impact: (["critical", "major", "minor"][itemIndex % 3] ?? "minor") as IncidentPayload["incidents"][number]["impact"],
      }))
    : [
    { id: `inc-${index}-1`, service: "API Gateway", status: "monitoring", impact: "major" },
    { id: `inc-${index}-2`, service: "Checkout", status: random() > 0.5 ? "investigating" : "resolved", impact: "minor" },
    { id: `inc-${index}-3`, service: "Email Worker", status: "resolved", impact: "minor" },
  ];
  return {
    widget: "incidents",
    title: `Service status ${index + 1}`,
    incidents: statuses,
  };
}

function buildTablePayload(index: number, random: () => number, density: BuilderDensity): TablePayload {
  const columns = density === "stress"
    ? ["Segment", "Value", "Change", "Score", "Context"]
    : ["Segment", "Value", "Change", "Score"];
  const rowCount = density === "stress" ? 24 : 6;
  const rows = Array.from({ length: rowCount }, (_, rowIndex) => {
    const value = 8_500 + rowIndex * 1_250 + Math.round(random() * 600);
    const delta = ((random() - 0.45) * 18).toFixed(1);
    const row: Record<string, string> = {
      segment: `Segment ${String.fromCharCode(65 + rowIndex)}`,
      value: value.toLocaleString("en-US"),
      change: `${Number(delta) >= 0 ? "+" : "/core"}${delta}%`,
      score: `${68 + rowIndex * 4 + index}`,
    };
    if (density === "stress") {
      row.context = `Enterprise cohort ${rowIndex + 1} · cycle ${2 + (rowIndex % 7)} weeks · risk ${["low", "medium", "high"][rowIndex % 3]}`;
    }
    return row;
  });
  return {
    widget: "table",
    title: `Top segments ${index + 1}`,
    columns,
    rows,
  };
}

function buildSummaryPayload(index: number, density: BuilderDensity, random: () => number): SummaryPayload {
  const compactText =
    "The engine distributes standard UI components automatically, keeps layout stability, and minimizes recomputes under high density.";
  const narrativeParagraphs = [
    "The pipeline prepares nodes once, then reuses cached measurements to recompute geometry continuously without traversing the DOM.",
    "Stress mode loads longer text blocks to demonstrate stable pre-typographic measurement and consistent placement under higher volume.",
    "Each relayout keeps deterministic ordering: same inputs, same outputs, even with width changes and drag/swap interactions.",
    "Long-form blocks simulate real product constraints: operational notes, incident comments, audit context, and executive summaries.",
  ];
  const stressText = [
    ...narrativeParagraphs,
    `Block ${index + 1} · horizon=${3 + Math.round(random() * 9)} weeks · reliability score=${(82 + random() * 17).toFixed(1)}%`,
    `Load hypothesis: ${Math.round(1800 + random() * 4600)} events/minute, ${Math.round(30 + random() * 120)} active widgets, ${Math.round(6 + random() * 18)} parallel streams.`,
    "Observation: text measurement and layout share the same preparation cycle, reducing unnecessary recalculations and improving predictability under pressure.",
  ].join("\n\n");

  return {
    widget: "summary",
    title: `Operational summary ${index + 1}`,
    text: density === "stress" ? stressText : compactText,
  };
}

function buildDropcapPayload(index: number, density: BuilderDensity, random: () => number): DropcapPayload {
  const baseParagraph =
    "The engine composes visual blocks with a stable hierarchy: the drop cap opens the reading flow, then narrative text unfolds context and decisions while preserving layout structure.";
  const stressTail = [
    "Under load, this component acts as a long narrative zone: incident recap, risk analysis, and a detailed action plan.",
    "Each width change triggers text measurement through the prepared pipeline to preserve readable and consistent wrapping.",
    `Density index ${index + 1}: ${Math.round(70 + random() * 28)}/100 · horizon: ${4 + Math.round(random() * 10)} weeks.`,
  ].join(" ");
  return {
    widget: "dropcap",
    title: `Product chronicle ${index + 1}`,
    text: density === "stress" ? `${baseParagraph} ${stressTail}` : baseParagraph,
    accent: ["#1d4ed8", "#0f766e", "#7c3aed", "#be123c"][index % 4],
  };
}

function buildPeriodLabels(length: number, prefix: string): string[] {
  return Array.from({ length }, (_, index) => `${prefix}${index + 1}`);
}

function buildSeries(length: number, base: number, random: () => number, volatility: number): number[] {
  const series: number[] = [];
  let current = base;
  for (let index = 0; index < length; index += 1) {
    const swing = (random() - 0.48) * volatility;
    current = Math.max(1, current + swing);
    series.push(Number(current.toFixed(2)));
  }
  return series;
}

function createRng(seed: number): () => number {
  let state = (seed >>> 0) || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}
