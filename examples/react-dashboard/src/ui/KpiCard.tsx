import type { KpiPayload } from "../dashboard/types";

interface KpiCardProps {
  payload: KpiPayload;
}

function toneClass(tone: KpiPayload["tone"]): string {
  if (tone === "positive") {
    return "is-positive";
  }
  if (tone === "negative") {
    return "is-negative";
  }
  return "is-neutral";
}

export function KpiCard({ payload }: KpiCardProps): JSX.Element {
  return (
    <div className="kpi-card">
      <div className="kpi-top">
        <span className="kpi-subtitle">{payload.subtitle}</span>
        <span className={`kpi-delta ${toneClass(payload.tone)}`}>{payload.delta}</span>
      </div>
      <div className="kpi-value">{payload.value}</div>
      <p className="kpi-footnote">Real-time consolidated metric · SVG-free rendering path</p>
    </div>
  );
}
