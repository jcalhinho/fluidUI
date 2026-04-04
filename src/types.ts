export type NodeType = "text" | "card" | "chart" | "custom";

export interface Size {
  width: number;
  height: number;
}

export interface NodeConstraints {
  minWidth?: number;
  maxWidth?: number;
  grow?: number;
  shrink?: number;
}

export interface Node {
  id: string;
  type: NodeType;
  content?: unknown;
  intrinsicSize?: Size;
  constraints?: NodeConstraints;
}

export interface NormalizedConstraints {
  minWidth: number;
  maxWidth: number;
  grow: number;
  shrink: number;
}

export interface CachedMeasurement {
  width: number;
  height: number;
}

export interface PreparedNode {
  node: Node;
  constraints: NormalizedConstraints;
  intrinsicSize: Size;
  cachedMeasurements: ReadonlyArray<CachedMeasurement>;
  cacheKey: string;
}

export interface LayoutBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type LayoutType = "vertical" | "grid" | "masonry";

export interface PrepareOptions {
  widthBuckets?: ReadonlyArray<number>;
  cache?: Map<string, Size>;
  defaultIntrinsicWidth?: number;
}

export interface LayoutOptions {
  width: number;
  type: LayoutType;
  gap?: number;
  padding?: number;
  columns?: number;
  minColumnWidth?: number;
}
