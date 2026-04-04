import type { IncidentPayload } from "../dashboard/types";

interface IncidentPanelProps {
  payload: IncidentPayload;
}

export function IncidentPanel({ payload }: IncidentPanelProps): JSX.Element {
  return (
    <div className="incident-list">
      {payload.incidents.map((incident) => (
        <article key={incident.id} className="incident-item">
          <header>
            <strong>{incident.service}</strong>
            <span className={`impact-${incident.impact}`}>{incident.impact}</span>
          </header>
          <p>Status: {incident.status}</p>
        </article>
      ))}
    </div>
  );
}
