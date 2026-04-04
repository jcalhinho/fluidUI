import type { ActivityPayload } from "../dashboard/types";

interface ActivityFeedProps {
  payload: ActivityPayload;
}

export function ActivityFeed({ payload }: ActivityFeedProps): JSX.Element {
  return (
    <ul className="activity-list">
      {payload.items.map((item) => (
        <li key={item.id}>
          <p>
            <strong>{item.actor}</strong> {item.action} <em>{item.target}</em>
          </p>
          <small>{item.time}</small>
        </li>
      ))}
    </ul>
  );
}
