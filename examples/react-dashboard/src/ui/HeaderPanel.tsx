import type { HeaderPayload } from "../dashboard/types";

interface HeaderPanelProps {
  payload: HeaderPayload;
}

export function HeaderPanel({ payload }: HeaderPanelProps): JSX.Element {
  const mainText = payload.subtitle.trim().length > 0 ? payload.subtitle : payload.title;
  const badges = Array.isArray(payload.badges) ? payload.badges.slice(0, 3) : [];

  return (
    <section className="header-panel">
      <p className="header-panel-main">{mainText}</p>
      {badges.length > 0 && (
        <div className="header-panel-badges">
          {badges.map((badge) => (
            <span key={badge}>{badge}</span>
          ))}
        </div>
      )}
    </section>
  );
}
