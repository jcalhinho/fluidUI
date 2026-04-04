export { DEFAULT_GAP, DEFAULT_PADDING } from "../utils";

export function coerceNonNegativeNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
}
