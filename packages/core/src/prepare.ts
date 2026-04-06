import { measure } from "./measurement/measure";
import type { CachedMeasurement, Node, PrepareOptions, PreparedNode, Size } from "./types";
import {
  DEFAULT_INTRINSIC_WIDTH,
  coercePositiveNumber,
  coerceSize,
  nearestMeasurement,
  normalizeConstraints,
  normalizeWidthBuckets,
  stableSerialize
} from "./utils";

const DEFAULT_WIDTH_BUCKETS = [160, 240, 320, 480, 640, 800, 1024, 1280] as const;

export function prepare(nodes: ReadonlyArray<Node>, options: PrepareOptions = {}): PreparedNode[] {
  const widthBuckets = normalizeWidthBuckets(options.widthBuckets ?? DEFAULT_WIDTH_BUCKETS);
  const cache = options.cache ?? new Map<string, Size>();
  const intrinsicWidth = coercePositiveNumber(options.defaultIntrinsicWidth, DEFAULT_INTRINSIC_WIDTH);

  return nodes.map((rawNode) => prepareSingleNode(rawNode, widthBuckets, intrinsicWidth, cache));
}

function prepareSingleNode(
  rawNode: Node,
  widthBuckets: ReadonlyArray<number>,
  intrinsicWidth: number,
  cache: Map<string, Size>
): PreparedNode {
  const node = normalizeNode(rawNode);
  const constraints = normalizeConstraints(node.constraints);
  const cacheKey = buildNodeCacheKey(node);

  const cachedMeasurements = widthBuckets.map((bucketWidth) => {
    const measurementKey = `${cacheKey}|w:${bucketWidth}`;
    const cached = cache.get(measurementKey);

    if (cached) {
      return { width: bucketWidth, height: cached.height } satisfies CachedMeasurement;
    }

    const measured = measure(node, bucketWidth);
    const size: Size = { width: measured.width, height: measured.height };
    cache.set(measurementKey, size);

    return {
      width: bucketWidth,
      height: measured.height
    } satisfies CachedMeasurement;
  });

  const closest = nearestMeasurement(cachedMeasurements, intrinsicWidth);
  const intrinsicSize = coerceSize(node.intrinsicSize, {
    width: closest.width,
    height: closest.height
  });

  return {
    node,
    constraints,
    intrinsicSize,
    cachedMeasurements,
    cacheKey
  };
}

function normalizeNode(node: Node): Node {
  if (!node || typeof node !== "object") {
    throw new Error("Invalid node: expected an object.");
  }

  if (typeof node.id !== "string" || node.id.trim().length === 0) {
    throw new Error("Invalid node id: expected a non-empty string.");
  }

  if (!isNodeType(node.type)) {
    throw new Error(`Invalid node type for '${node.id}'.`);
  }

  const normalized: Node = {
    id: node.id,
    type: node.type
  };

  if (typeof node.content !== "undefined") {
    normalized.content = node.content;
  }

  if (typeof node.constraints !== "undefined") {
    normalized.constraints = node.constraints;
  }

  if (node.intrinsicSize) {
    normalized.intrinsicSize = {
      width: coercePositiveNumber(node.intrinsicSize.width, 1),
      height: coercePositiveNumber(node.intrinsicSize.height, 1)
    };
  }

  return normalized;
}

function buildNodeCacheKey(node: Node): string {
  return [
    `id:${node.id}`,
    `type:${node.type}`,
    `content:${stableSerialize(node.content)}`,
    `intrinsic:${stableSerialize(node.intrinsicSize)}`,
    `constraints:${stableSerialize(node.constraints)}`
  ].join("|");
}

function isNodeType(value: unknown): value is Node["type"] {
  return value === "text" || value === "card" || value === "chart" || value === "custom";
}
