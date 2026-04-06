import type { CachedMeasurement, NodeConstraints, NormalizedConstraints, Size } from "./types";

export const DEFAULT_GAP = 12;
export const DEFAULT_PADDING = 0;
export const DEFAULT_INTRINSIC_WIDTH = 320;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function coercePositiveNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

export function normalizeConstraints(constraints?: NodeConstraints): NormalizedConstraints {
  const minWidth = coerceNonNegative(constraints?.minWidth, 0);
  const maxCandidate =
    typeof constraints?.maxWidth === "number" && Number.isFinite(constraints.maxWidth)
      ? constraints.maxWidth
      : Number.POSITIVE_INFINITY;
  const maxWidth = Math.max(minWidth, maxCandidate);
  const grow = coerceNonNegative(constraints?.grow, 0);
  const shrink = coerceNonNegative(constraints?.shrink, 1);

  return { minWidth, maxWidth, grow, shrink };
}

export function clampWidth(width: number, constraints: NormalizedConstraints): number {
  return clamp(width, constraints.minWidth, constraints.maxWidth);
}

export function coerceSize(size: Partial<Size> | undefined, fallback: Size): Size {
  if (!size) {
    return fallback;
  }

  return {
    width: coercePositiveNumber(size.width, fallback.width),
    height: coercePositiveNumber(size.height, fallback.height)
  };
}

export function nearestMeasurement(
  measurements: ReadonlyArray<CachedMeasurement>,
  width: number
): CachedMeasurement {
  if (measurements.length === 0) {
    throw new Error("Prepared node has no cached measurements.");
  }

  let best = measurements[0];
  let bestDelta = Math.abs(best.width - width);

  for (let i = 1; i < measurements.length; i += 1) {
    const candidate = measurements[i];
    const delta = Math.abs(candidate.width - width);
    if (delta < bestDelta) {
      best = candidate;
      bestDelta = delta;
    }
  }

  return best;
}

export function normalizeWidthBuckets(widthBuckets: ReadonlyArray<number>): number[] {
  const normalized = Array.from(
    new Set(
      widthBuckets
        .filter((value) => typeof value === "number" && Number.isFinite(value) && value > 0)
        .map((value) => Math.floor(value))
    )
  ).sort((a, b) => a - b);

  if (normalized.length === 0) {
    throw new Error("prepare() requires at least one positive width bucket.");
  }

  return normalized;
}

export function stableSerialize(value: unknown): string {
  const seen = new WeakSet<object>();

  const serialize = (input: unknown): string => {
    if (input === null) {
      return "null";
    }

    if (typeof input === "undefined") {
      return "undefined";
    }

    if (typeof input === "number" || typeof input === "boolean") {
      return String(input);
    }

    if (typeof input === "string") {
      return JSON.stringify(input);
    }

    if (typeof input === "bigint") {
      return `bigint:${input.toString()}`;
    }

    if (typeof input === "symbol") {
      return `symbol:${String(input.description ?? "")}`;
    }

    if (typeof input === "function") {
      return `function:${input.name || "anonymous"}`;
    }

    if (Array.isArray(input)) {
      return `[${input.map((item) => serialize(item)).join(",")}]`;
    }

    if (typeof input === "object") {
      if (seen.has(input)) {
        return '"[Circular]"';
      }

      seen.add(input);

      const entries = Object.entries(input as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entryValue]) => `${JSON.stringify(key)}:${serialize(entryValue)}`)
        .join(",");

      return `{${entries}}`;
    }

    return String(input);
  };

  return serialize(value);
}

function coerceNonNegative(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
}
