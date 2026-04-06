export type Severity = "critical" | "high" | "medium" | "low";
export type Tone = "positive" | "negative" | "neutral";
export type DensityMode = "showcase" | "stress";

export interface WidgetInsight {
  confidence: number;
  evidence: string[];
}

interface WidgetPayloadBase {
  insight?: WidgetInsight;
}

export interface KpiPayload extends WidgetPayloadBase {
  widget: "kpi";
  title: string;
  subtitle: string;
  value: string;
  delta: string;
  tone: Tone;
}

export interface LineChartPayload extends WidgetPayloadBase {
  widget: "line";
  title: string;
  unit: string;
  points: number[];
  labels: string[];
  change: string;
  tone: Tone;
}

export interface ComparePayload extends WidgetPayloadBase {
  widget: "compare";
  title: string;
  leftLabel: string;
  rightLabel: string;
  leftValue: number;
  rightValue: number;
  unit: "%" | "count";
}

export interface FunnelChartPayload extends WidgetPayloadBase {
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

export interface AlertsPayload extends WidgetPayloadBase {
  widget: "alerts";
  title: string;
  alerts: AlertPayload[];
}

export interface ActivityPayload extends WidgetPayloadBase {
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

export interface IncidentPayload extends WidgetPayloadBase {
  widget: "incidents";
  title: string;
  incidents: Array<{
    id: string;
    service: string;
    status: "investigating" | "monitoring" | "resolved";
    impact: "minor" | "major" | "critical";
  }>;
}

export interface TablePayload extends WidgetPayloadBase {
  widget: "table";
  title: string;
  columns: string[];
  rows: Array<Record<string, string>>;
}

export interface SummaryPayload extends WidgetPayloadBase {
  widget: "summary";
  title: string;
  text: string;
}

export interface DropcapPayload extends WidgetPayloadBase {
  widget: "dropcap";
  title: string;
  text: string;
  accent?: string;
}

export interface BigNumberPayload extends WidgetPayloadBase {
  widget: "bignumber";
  title: string;
  value: string;
  delta?: string;
  tone?: Tone;
  label?: string;
  sublabel?: string;
}

export interface HeaderPayload extends WidgetPayloadBase {
  widget: "header";
  title: string;
  subtitle: string;
  eyebrow?: string;
  badges?: string[];
}

export interface CollapsibleMenuPayload extends WidgetPayloadBase {
  widget: "menu";
  title: string;
  groups: Array<{
    id: string;
    label: string;
    defaultOpen?: boolean;
    items: string[];
  }>;
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
  | SummaryPayload
  | DropcapPayload
  | BigNumberPayload
  | HeaderPayload
  | CollapsibleMenuPayload;

export function isWidgetPayload(content: unknown): content is WidgetPayload {
  if (!content || typeof content !== "object") {
    return false;
  }

  const value = content as { widget?: unknown };
  return typeof value.widget === "string";
}
