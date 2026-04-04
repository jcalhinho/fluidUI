export type Severity = "critical" | "high" | "medium" | "low";
export type Tone = "positive" | "negative" | "neutral";
export type DensityMode = "showcase" | "stress";

export interface KpiPayload {
  widget: "kpi";
  title: string;
  subtitle: string;
  value: string;
  delta: string;
  tone: Tone;
  sparkline: number[];
}

export interface LineChartPayload {
  widget: "line";
  title: string;
  unit: string;
  points: number[];
  labels: string[];
  change: string;
  tone: Tone;
}

export interface ComparePayload {
  widget: "compare";
  title: string;
  leftLabel: string;
  rightLabel: string;
  leftValue: number;
  rightValue: number;
  unit: "%" | "€" | "count";
}

export interface FunnelChartPayload {
  widget: "funnel";
  title: string;
  stages: Array<{ label: string; value: number }>;
}

export interface AlertPayload {
  id: string;
  severity: Severity;
  message: string;
  minutesAgo: number;
}

export interface AlertsPayload {
  widget: "alerts";
  title: string;
  alerts: AlertPayload[];
}

export interface ActivityPayload {
  widget: "activity";
  title: string;
  items: Array<{
    id: string;
    actor: string;
    action: string;
    target: string;
    time: string;
  }>;
}

export interface IncidentPayload {
  widget: "incidents";
  title: string;
  incidents: Array<{
    id: string;
    service: string;
    status: "investigating" | "monitoring" | "resolved";
    impact: "minor" | "major" | "critical";
  }>;
}

export interface TablePayload {
  widget: "table";
  title: string;
  columns: string[];
  rows: Array<Record<string, string>>;
}

export interface SummaryPayload {
  widget: "summary";
  title: string;
  text: string;
}

export type WidgetPayload =
  | KpiPayload
  | LineChartPayload
  | ComparePayload
  | FunnelChartPayload
  | AlertsPayload
  | ActivityPayload
  | IncidentPayload
  | TablePayload
  | SummaryPayload;

export function isWidgetPayload(content: unknown): content is WidgetPayload {
  if (!content || typeof content !== "object") {
    return false;
  }

  const value = content as { widget?: unknown };
  return typeof value.widget === "string";
}
