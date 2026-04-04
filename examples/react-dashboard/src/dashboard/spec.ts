import type { NodeConstraints, NodeType, Size } from "@engine";
import type { LayoutType } from "@engine";
import type { Node } from "@engine";
import type { WidgetPayload } from "./types";

export type SourceDocumentKind = "pdf" | "csv" | "xlsx" | "xls" | "docx" | "txt" | "md" | "json";

export interface SourceDocumentHit {
  id: string;
  kind: SourceDocumentKind;
  title: string;
  excerpt: string;
  score: number;
}

export interface DashboardSpecWidget {
  id: string;
  nodeType: NodeType;
  payload: WidgetPayload;
  intrinsicSize?: Size;
  constraints?: NodeConstraints;
}

export interface DashboardSpec {
  title: string;
  userPrompt: string;
  layoutType: LayoutType;
  narrative: string;
  widgets: DashboardSpecWidget[];
  sources: SourceDocumentHit[];
}

export interface DashboardGenerationResult {
  provider: string;
  elapsedMs: number;
  spec: DashboardSpec;
  nodes: Node[];
}
