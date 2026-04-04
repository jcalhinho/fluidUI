import type { FunnelChartPayload } from "../dashboard/types";

interface FunnelChartProps {
  payload: FunnelChartPayload;
}

export function FunnelChart({ payload }: FunnelChartProps): JSX.Element {
  const max = payload.stages.reduce((acc, stage) => Math.max(acc, stage.value), 1);

  return (
    <div className="funnel-widget">
      {payload.stages.map((stage) => {
        const pct = (stage.value / max) * 100;
        return (
          <div key={stage.label} className="funnel-row">
            <div className="funnel-label">
              <span>{stage.label}</span>
              <strong>{stage.value.toLocaleString()}</strong>
            </div>
            <div className="funnel-bar-track">
              <div className="funnel-bar-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
