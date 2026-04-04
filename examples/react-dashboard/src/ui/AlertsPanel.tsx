import type { AlertsPayload } from "../dashboard/types";

interface AlertsPanelProps {
  payload: AlertsPayload;
}

function severityClass(severity: AlertsPayload["alerts"][number]["severity"]): string {
  return `severity-${severity}`;
}

export function AlertsPanel({ payload }: AlertsPanelProps): JSX.Element {
  return (
    <ul className="alerts-list">
      {payload.alerts.map((alert) => (
        <li key={alert.id} className="alerts-item">
          <span className={`severity-pill ${severityClass(alert.severity)}`}>{alert.severity}</span>
          <div className="alerts-content">
            <p>{alert.message}</p>
            <small>{alert.minutesAgo}m ago</small>
          </div>
        </li>
      ))}
    </ul>
  );
}
