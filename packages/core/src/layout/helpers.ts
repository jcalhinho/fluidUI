import type { PreparedNode } from "../types";
import { clampWidth, nearestMeasurement } from "../utils";

export function getNodeWidth(preparedNode: PreparedNode, targetWidth: number): number {
  return clampWidth(targetWidth, preparedNode.constraints);
}

export function getNodeHeight(preparedNode: PreparedNode, targetWidth: number): number {
  const safeWidth = getNodeWidth(preparedNode, targetWidth);
  return nearestMeasurement(preparedNode.cachedMeasurements, safeWidth).height;
}
