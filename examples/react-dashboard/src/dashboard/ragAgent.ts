import {
  generateDashboardFromPrompt as generateMockDashboard,
  type DashboardGenerationOptions
} from "./mockAgent";
import type { DashboardGenerationResult, DashboardSpec, SourceDocumentHit } from "./spec";
import { specToNodes } from "./specToNodes";

interface ChatApiResponse {
  provider: string;
  elapsedMs: number;
  spec: DashboardSpec;
}

interface SourcesApiResponse {
  sources: SourceDocumentHit[];
}

interface UploadApiResponse {
  uploaded: SourceDocumentHit[];
  rejected: Array<{ filename: string; reason: string }>;
  totalDocuments: number;
}

const DEFAULT_TIMEOUT_MS = 120_000;

export async function generateDashboardFromPrompt(
  prompt: string,
  options: DashboardGenerationOptions = {}
): Promise<DashboardGenerationResult> {
  const safePrompt = prompt.trim();
  if (safePrompt.length === 0) {
    return generateMockDashboard(prompt, options);
  }

  const timeoutMs = coerceTimeout(options.timeoutMs, DEFAULT_TIMEOUT_MS);
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort("timeout"), timeoutMs);

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        prompt: safePrompt,
        timeoutMs,
        model: options.ollamaModel
      })
    });

    if (!response.ok) {
      throw new Error(`RAG API HTTP ${response.status}`);
    }

    const payload = (await response.json()) as Partial<ChatApiResponse>;
    if (!isDashboardSpec(payload.spec)) {
      throw new Error("Invalid DashboardSpec payload from API.");
    }

    return {
      provider: typeof payload.provider === "string" ? payload.provider : "RAG API",
      elapsedMs: typeof payload.elapsedMs === "number" ? payload.elapsedMs : 0,
      spec: payload.spec,
      nodes: specToNodes(payload.spec)
    };
  } catch {
    return generateMockDashboard(safePrompt, options);
  } finally {
    window.clearTimeout(timer);
  }
}

export async function listIndexedSources(): Promise<SourceDocumentHit[]> {
  const response = await fetch("/api/sources", {
    method: "GET"
  });
  if (!response.ok) {
    throw new Error(`Unable to list sources (HTTP ${response.status}).`);
  }

  const payload = (await response.json()) as Partial<SourcesApiResponse>;
  if (!Array.isArray(payload.sources)) {
    throw new Error("Invalid sources payload.");
  }

  return payload.sources.filter(isSourceDocumentHit);
}

export async function uploadSources(files: File[]): Promise<UploadApiResponse> {
  if (files.length === 0) {
    throw new Error("No files selected.");
  }

  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }

  const response = await fetch("/api/upload", {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Upload failed (HTTP ${response.status}).`);
  }

  const payload = (await response.json()) as Partial<UploadApiResponse>;

  return {
    uploaded: Array.isArray(payload.uploaded) ? payload.uploaded.filter(isSourceDocumentHit) : [],
    rejected: Array.isArray(payload.rejected)
      ? payload.rejected
          .filter((value): value is { filename: string; reason: string } => {
            return (
              Boolean(value) &&
              typeof value === "object" &&
              typeof value.filename === "string" &&
              typeof value.reason === "string"
            );
          })
      : [],
    totalDocuments: typeof payload.totalDocuments === "number" ? payload.totalDocuments : 0
  };
}

function isDashboardSpec(value: unknown): value is DashboardSpec {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<DashboardSpec>;
  return (
    typeof candidate.title === "string" &&
    typeof candidate.userPrompt === "string" &&
    (candidate.layoutType === "masonry" ||
      candidate.layoutType === "grid" ||
      candidate.layoutType === "vertical") &&
    Array.isArray(candidate.widgets) &&
    Array.isArray(candidate.sources)
  );
}

function isSourceDocumentHit(value: unknown): value is SourceDocumentHit {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<SourceDocumentHit>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.excerpt === "string" &&
    typeof candidate.score === "number" &&
    typeof candidate.kind === "string"
  );
}

function coerceTimeout(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(15_000, Math.min(180_000, Math.round(value)));
}
