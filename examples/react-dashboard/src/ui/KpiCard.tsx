import type { KpiPayload } from "../dashboard/types";

interface KpiCardProps {
  payload: KpiPayload;
}

function sparklinePath(values: readonly number[], width: number, height: number): string {
  if (values.length === 0) {
    return "";
  }

  let min = values[0]!;
  let max = values[0]!;
  for (const value of values) {
    min = Math.min(min, value);
    max = Math.max(max, value);
  }

  const range = Math.max(1, max - min);
  const stepX = values.length > 1 ? width / (values.length - 1) : width;

  return values
    .map((value, index) => {
      const x = index * stepX;
      const normalized = (value - min) / range;
      const y = height - normalized * height;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
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
      <svg className="kpi-sparkline" viewBox="0 0 180 52" preserveAspectRatio="none">
        <polyline
          className={`kpi-line ${toneClass(payload.tone)}`}
          points={sparklinePath(payload.sparkline, 180, 52)}
        />
      </svg>
    </div>
  );
}
