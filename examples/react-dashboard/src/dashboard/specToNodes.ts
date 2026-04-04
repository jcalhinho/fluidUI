import type { Node } from "@engine";
import type { DashboardSpec } from "./spec";

export function specToNodes(spec: DashboardSpec): Node[] {
  const seen = new Set<string>();

  return spec.widgets.map((widget, index) => {
    const rawId = widget.id.trim();
    const baseId = rawId.length > 0 ? rawId : `widget-${index + 1}`;
    const id = ensureUniqueId(baseId, seen);
    seen.add(id);

    return {
      id,
      type: widget.nodeType,
      content: widget.payload,
      ...(widget.intrinsicSize ? { intrinsicSize: widget.intrinsicSize } : {}),
      ...(widget.constraints ? { constraints: widget.constraints } : {})
    } satisfies Node;
  });
}

function ensureUniqueId(candidate: string, seen: ReadonlySet<string>): string {
  if (!seen.has(candidate)) {
    return candidate;
  }

  let suffix = 2;
  while (seen.has(`${candidate}-${suffix}`)) {
    suffix += 1;
  }

  return `${candidate}-${suffix}`;
}
