import type { Node } from "@fluidui/core";
import { Suspense, lazy, memo } from "react";
import { ActivityFeed } from "../ui/ActivityFeed";
import { AlertsPanel } from "../ui/AlertsPanel";
import { BigNumber } from "../ui/BigNumber";
import { CollapsibleMenu } from "../ui/CollapsibleMenu";
import { DataTable } from "../ui/DataTable";
import { DropcapStory } from "../ui/DropcapStory";
import { HeaderPanel } from "../ui/HeaderPanel";
import { IncidentPanel } from "../ui/IncidentPanel";
import { KpiCard } from "../ui/KpiCard";
import { SummaryCard } from "../ui/SummaryCard";
import type { WidgetInsight } from "./types";
import { isWidgetPayload } from "./types";

interface DashboardWidgetProps {
  node: Node;
  isDragging?: boolean;
  isLocked?: boolean;
}

const LineChartLazy = lazy(async () => {
  const module = await import("../ui/LineChart");
  return { default: module.LineChart };
});

const FunnelChartLazy = lazy(async () => {
  const module = await import("../ui/FunnelChart");
  return { default: module.FunnelChart };
});

function chartFallback(): JSX.Element {
  return (
    <div className="chart-loading-fallback" role="status" aria-live="polite">
      Loading chart...
    </div>
  );
}

function renderPayload(node: Node): JSX.Element {
  const content = node.content;
  if (!isWidgetPayload(content)) {
    return <p>{typeof content === "string" ? content : "Unsupported widget payload"}</p>;
  }

  switch (content.widget) {
    case "kpi":
      return <KpiCard payload={content} />;
    case "line":
      return (
        <Suspense fallback={chartFallback()}>
          <LineChartLazy payload={content} />
        </Suspense>
      );
    case "compare":
      return <p>Comparison widget disabled (ECharts-only mode).</p>;
    case "funnel":
      return (
        <Suspense fallback={chartFallback()}>
          <FunnelChartLazy payload={content} />
        </Suspense>
      );
    case "alerts":
      return <AlertsPanel payload={content} />;
    case "activity":
      return <ActivityFeed payload={content} />;
    case "incidents":
      return <IncidentPanel payload={content} />;
    case "table":
      return <DataTable payload={content} />;
    case "summary":
      return <SummaryCard payload={content} />;
    case "dropcap":
      return <DropcapStory payload={content} />;
    case "bignumber":
      return <BigNumber payload={content} />;
    case "header":
      return <HeaderPanel payload={content} />;
    case "menu":
      return <CollapsibleMenu payload={content} />;
    default: {
      const neverPayload: never = content;
      return <p>Unknown widget: {String(neverPayload)}</p>;
    }
  }
}

function DashboardWidgetComponent({ node, isDragging = false, isLocked = false }: DashboardWidgetProps): JSX.Element {
  const content = node.content;
  const title =
    isWidgetPayload(content) && "title" in content ? String(content.title) : node.id;
  const insight = extractInsight(content);
  const isHeaderWidget = isWidgetPayload(content) && content.widget === "header";

  const widgetType =
    isWidgetPayload(content) ? content.widget : node.type;

  return (
    <article
      className={`widget widget-${widgetType}${isDragging ? " is-dragging" : ""}${isHeaderWidget ? " is-compact-header" : ""}`}
      aria-label={title}
    >
      {!isHeaderWidget && (
        <header className="widget-header">
          {!isLocked && <span className="widget-drag-handle" aria-hidden="true">⠿</span>}
          <h3>{title}</h3>
        </header>
      )}
      {!isHeaderWidget && insight !== null && (
        <div className="widget-insight">
          <span className={`widget-confidence ${confidenceClassName(insight.confidence)}`}>
            Confidence {Math.round(insight.confidence * 100)}%
          </span>
          {insight.evidence.length > 0 && (
            <ul className="widget-evidence">
              {insight.evidence.slice(0, 2).map((evidence) => (
                <li key={evidence}>{evidence}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="widget-body">{renderPayload(node)}</div>
    </article>
  );
}

export const DashboardWidget = memo(DashboardWidgetComponent);
DashboardWidget.displayName = "DashboardWidget";

function extractInsight(content: unknown): WidgetInsight | null {
  if (!isWidgetPayload(content) || typeof content.insight !== "object" || content.insight === null) {
    return null;
  }
  const confidence = Number((content.insight as { confidence?: unknown }).confidence);
  const rawEvidence = (content.insight as { evidence?: unknown }).evidence;
  const evidence = Array.isArray(rawEvidence)
    ? rawEvidence.map((item) => String(item).trim()).filter((item) => item.length > 0)
    : [];
  if (!Number.isFinite(confidence)) return null;
  return {
    confidence: Math.max(0, Math.min(1, confidence)),
    evidence,
  };
}

function confidenceClassName(confidence: number): string {
  if (confidence >= 0.75) return "is-high";
  if (confidence >= 0.5) return "is-medium";
  return "is-low";
}
