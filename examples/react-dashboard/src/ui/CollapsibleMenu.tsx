import type { CollapsibleMenuPayload } from "../dashboard/types";

interface CollapsibleMenuProps {
  payload: CollapsibleMenuPayload;
}

export function CollapsibleMenu({ payload }: CollapsibleMenuProps): JSX.Element {
  return (
    <nav className="collapsible-menu" aria-label={payload.title}>
      {payload.groups.map((group) => (
        <details key={group.id} open={Boolean(group.defaultOpen)} className="collapsible-menu-group">
          <summary>{group.label}</summary>
          <ul>
            {group.items.map((item) => (
              <li key={`${group.id}-${item}`}>{item}</li>
            ))}
          </ul>
        </details>
      ))}
    </nav>
  );
}
