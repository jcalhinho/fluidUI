import type { LineChartPayload } from "../dashboard/types";

interface LineChartProps {
  payload: LineChartPayload;
}

function buildLine(points: readonly number[]): string {
  if (points.length === 0) {
    return "";
  }

  let min = points[0]!;
  let max = points[0]!;
  for (const point of points) {
    min = Math.min(min, point);
    max = Math.max(max, point);
  }

  const width = 100;
  const height = 44;
  const range = Math.max(1, max - min);
  const stepX = points.length > 1 ? width / (points.length - 1) : width;

  return points
    .map((point, index) => {
      const x = index * stepX;
      const y = height - ((point - min) / range) * height;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

function toneClass(tone: LineChartPayload["tone"]): string {
  if (tone === "positive") {
    return "is-positive";
  }
  if (tone === "negative") {
    return "is-negative";
  }
  return "is-neutral";
}

export function LineChart({ payload }: LineChartProps): JSX.Element {
  return (
    <div className="line-widget">
      <div className="line-widget-meta">
        <span className={`line-change ${toneClass(payload.tone)}`}>{payload.change}</span>
      </div>
      <svg className="line-widget-chart" viewBox="0 0 100 44" preserveAspectRatio="none">
        <polyline className={`line-widget-path ${toneClass(payload.tone)}`} points={buildLine(payload.points)} />
      </svg>
      <div className="line-widget-axis">
        <span>{payload.labels[0] ?? "start"}</span>
        <span>{payload.labels[payload.labels.length - 1] ?? "end"}</span>
      </div>
    </div>
  );
}
