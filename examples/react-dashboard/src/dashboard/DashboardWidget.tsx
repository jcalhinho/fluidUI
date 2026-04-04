import type { Node } from "@engine";
import { ActivityFeed } from "../ui/ActivityFeed";
import { AlertsPanel } from "../ui/AlertsPanel";
import { CompareCard } from "../ui/CompareCard";
import { DataTable } from "../ui/DataTable";
import { FunnelChart } from "../ui/FunnelChart";
import { IncidentPanel } from "../ui/IncidentPanel";
import { KpiCard } from "../ui/KpiCard";
import { LineChart } from "../ui/LineChart";
import { SummaryCard } from "../ui/SummaryCard";
import { isWidgetPayload } from "./types";

interface DashboardWidgetProps {
  node: Node;
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
      return <LineChart payload={content} />;
    case "compare":
      return <CompareCard payload={content} />;
    case "funnel":
      return <FunnelChart payload={content} />;
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
    default: {
      const neverPayload: never = content;
      return <p>Unknown widget: {String(neverPayload)}</p>;
    }
  }
}

export function DashboardWidget({ node }: DashboardWidgetProps): JSX.Element {
  const title =
    isWidgetPayload(node.content) && "title" in node.content
      ? String(node.content.title)
      : node.id;

  return (
    <article className={`widget widget-${node.type}`}>
      <header className="widget-header">
        <h3>{title}</h3>
      </header>

      <div className="widget-body">{renderPayload(node)}</div>
    </article>
  );
}
