import type { Node } from "@engine";
import type { DensityMode, WidgetPayload } from "./types";
import type { FakeDashboardData } from "./fakeData";

function kpiNode(id: string, payload: WidgetPayload): Node {
  return {
    id,
    type: "card",
    intrinsicSize: { width: 320, height: 190 },
    constraints: { minWidth: 220, maxWidth: 420 },
    content: payload
  };
}

export function buildDashboardNodes(data: FakeDashboardData, density: DensityMode): Node[] {
  const baseNodes: Node[] = [
    ...data.kpis.map((kpi) =>
      kpiNode(kpi.id, {
        widget: "kpi",
        title: kpi.title,
        subtitle: kpi.subtitle,
        value: kpi.value,
        delta: kpi.delta,
        tone: kpi.tone,
        sparkline: kpi.sparkline
      }),
    ),
    {
      id: "chart-revenue",
      type: "chart",
      intrinsicSize: { width: 680, height: 300 },
      constraints: { minWidth: 280, maxWidth: 860 },
      content: {
        widget: "line",
        title: "Revenue Trend",
        unit: "€",
        points: data.revenueSeries,
        labels: data.labels,
        change: data.kpis[0]?.delta ?? "+0.0%",
        tone: data.kpis[0]?.tone ?? "neutral"
      } satisfies WidgetPayload
    },
    {
      id: "chart-conversion",
      type: "chart",
      intrinsicSize: { width: 680, height: 290 },
      constraints: { minWidth: 280, maxWidth: 860 },
      content: {
        widget: "line",
        title: "Conversion Trend",
        unit: "%",
        points: data.conversionSeries,
        labels: data.labels,
        change: data.kpis[3]?.delta ?? "+0.0%",
        tone: data.kpis[3]?.tone ?? "neutral"
      } satisfies WidgetPayload
    },
    {
      id: "funnel",
      type: "custom",
      intrinsicSize: { width: 520, height: 280 },
      constraints: { minWidth: 260, maxWidth: 620 },
      content: {
        widget: "funnel",
        title: "Acquisition Funnel",
        stages: data.funnel
      } satisfies WidgetPayload
    },
    {
      id: "alerts",
      type: "custom",
      intrinsicSize: { width: 420, height: 300 },
      constraints: { minWidth: 260, maxWidth: 520 },
      content: {
        widget: "alerts",
        title: "Active Alerts",
        alerts: data.alerts
      } satisfies WidgetPayload
    },
    {
      id: "incidents",
      type: "custom",
      intrinsicSize: { width: 420, height: 260 },
      constraints: { minWidth: 260, maxWidth: 520 },
      content: {
        widget: "incidents",
        title: "Incident Status",
        incidents: data.incidents
      } satisfies WidgetPayload
    },
    {
      id: "activity",
      type: "custom",
      intrinsicSize: { width: 520, height: 280 },
      constraints: { minWidth: 260, maxWidth: 680 },
      content: {
        widget: "activity",
        title: "Recent Activity",
        items: data.activities
      } satisfies WidgetPayload
    },
    {
      id: "top-pages",
      type: "custom",
      intrinsicSize: { width: 760, height: 320 },
      constraints: { minWidth: 320, maxWidth: 980 },
      content: {
        widget: "table",
        title: "Top Pages",
        columns: ["Page", "Sessions", "Conversion", "Revenue"],
        rows: data.topPages
      } satisfies WidgetPayload
    },
    {
      id: "summary",
      type: "text",
      intrinsicSize: { width: 880, height: 130 },
      constraints: { minWidth: 320, maxWidth: 1100 },
      content: {
        widget: "summary",
        title: "Executive Summary",
        text: data.summaryText
      } satisfies WidgetPayload
    }
  ];

  if (density === "showcase") {
    return baseNodes;
  }

  const stressNodes: Node[] = data.microMetrics.map((metric) => ({
    id: metric.id,
    type: "card",
    intrinsicSize: { width: 220, height: 150 },
    constraints: { minWidth: 180, maxWidth: 260 },
    content: {
      widget: "kpi",
      title: metric.label,
      subtitle: "high-density metric",
      value: metric.value,
      delta: metric.delta,
      tone: metric.tone,
      sparkline: metric.sparkline
    } satisfies WidgetPayload
  }));

  return [...baseNodes, ...stressNodes];
}
