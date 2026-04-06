import type { ComparePayload } from "../dashboard/types";

interface CompareCardProps {
  payload: ComparePayload;
}

function formatValue(value: number, unit: ComparePayload["unit"]): string {
  if (unit === "%") {
    return `${value.toFixed(1)}%`;
  }
  return Math.round(value).toLocaleString();
}

export function CompareCard({ payload }: CompareCardProps): JSX.Element {
  const max = Math.max(1, payload.leftValue, payload.rightValue);
  const leftRatio = (payload.leftValue / max) * 100;
  const rightRatio = (payload.rightValue / max) * 100;
  const delta = payload.rightValue - payload.leftValue;
  const toneClass = delta >= 0 ? "is-positive" : "is-negative";

  return (
    <div className="compare-widget">
      <div className="compare-row">
        <div className="compare-label">
          <span>{payload.leftLabel}</span>
          <strong>{formatValue(payload.leftValue, payload.unit)}</strong>
        </div>
        <div className="compare-track">
          <div className="compare-fill compare-left" style={{ width: `${leftRatio}%` }} />
        </div>
      </div>

      <div className="compare-row">
        <div className="compare-label">
          <span>{payload.rightLabel}</span>
          <strong>{formatValue(payload.rightValue, payload.unit)}</strong>
        </div>
        <div className="compare-track">
          <div className="compare-fill compare-right" style={{ width: `${rightRatio}%` }} />
        </div>
      </div>

      <p className={`compare-delta ${toneClass}`}>
        {delta >= 0 ? "+" : ""}
        {formatValue(delta, payload.unit)} between {payload.leftLabel} and {payload.rightLabel}
      </p>
    </div>
  );
}
