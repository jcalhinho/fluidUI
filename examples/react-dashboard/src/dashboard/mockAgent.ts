import type { WidgetPayload } from "./types";
import { generateFakeDashboardData } from "./fakeData";
import { retrieveRelevantDocuments } from "./mockRag";
import type { DashboardGenerationResult, DashboardSpec, DashboardSpecWidget } from "./spec";
import { specToNodes } from "./specToNodes";

type KpiMetric = "revenue" | "churn" | "nps" | "activation";

interface DashboardPlan {
  layoutType: DashboardSpec["layoutType"];
  kpis: KpiMetric[];
  kpiCount?: number;
  includeComparison: boolean;
  compareLeftLabel: string;
  compareRightLabel: string;
  includeTrend: boolean;
  includeAlerts: boolean;
  includeTable: boolean;
  narrative?: string;
}

interface PromptSignals {
  wantsRevenue: boolean;
  wantsChurn: boolean;
  wantsActivation: boolean;
  wantsNps: boolean;
  wantsComparison: boolean;
  wantsTrend: boolean;
  wantsAlerts: boolean;
  wantsTable: boolean;
}

export type AIProviderMode = "auto" | "mock" | "ollama-qwen";

export interface DashboardGenerationOptions {
  providerMode?: AIProviderMode;
  ollamaBaseUrl?: string;
  ollamaModel?: string;
  timeoutMs?: number;
  allowFallbackOnError?: boolean;
}

const DEFAULT_PROMPT =
  "Je veux un dashboard SaaS avec MRR, churn, activation, comparatif Plan A vs Plan B, trend conversion, alertes et top pages.";
const DEFAULT_OLLAMA_BASE_URL = "/ollama";
const DEFAULT_OLLAMA_MODEL = "qwen3.5:9b";
const DEFAULT_OLLAMA_TIMEOUT_MS = 90000;

export function getDefaultPrompt(): string {
  return DEFAULT_PROMPT;
}

export async function generateDashboardFromPrompt(
  prompt: string,
  options: DashboardGenerationOptions = {}
): Promise<DashboardGenerationResult> {
  const started = performance.now();
  const safePrompt = prompt.trim().length > 0 ? prompt.trim() : DEFAULT_PROMPT;
  const sources = retrieveRelevantDocuments(safePrompt, 4);
  const providerMode = options.providerMode ?? "auto";
  const allowFallbackOnError = options.allowFallbackOnError ?? true;
  const seed = deriveSeed(
    `${safePrompt}|${sources.map((source) => source.id).join("|")}|mode:${providerMode}`
  );
  const data = generateFakeDashboardData(seed);
  const fallbackPlan = planFromSignals(inferSignals(safePrompt), safePrompt);

  let plan: DashboardPlan = fallbackPlan;
  let providerName = "Mock RAG + JSON render";

  if (providerMode === "ollama-qwen") {
    try {
      plan = await generatePlanWithOllama(safePrompt, sources, options);
      providerName = `Ollama ${options.ollamaModel ?? DEFAULT_OLLAMA_MODEL}`;
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : String(cause);
      if (!allowFallbackOnError) {
        throw cause;
      }
      plan = fallbackPlan;
      providerName = `Mock fallback from Ollama (${reason})`;
    }
  } else if (providerMode === "auto") {
    try {
      plan = await generatePlanWithOllama(safePrompt, sources, options);
      providerName = `Ollama ${options.ollamaModel ?? DEFAULT_OLLAMA_MODEL}`;
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : String(cause);
      providerName = `Mock fallback (${reason})`;
      plan = fallbackPlan;
    }
  }

  const spec = buildSpecFromPlan(safePrompt, sources, data, plan);
  return {
    provider: providerName,
    elapsedMs: performance.now() - started,
    spec,
    nodes: specToNodes(spec)
  };
}

function buildSpecFromPlan(
  safePrompt: string,
  sources: DashboardSpec["sources"],
  data: ReturnType<typeof generateFakeDashboardData>,
  plan: DashboardPlan
): DashboardSpec {
  const widgets: DashboardSpecWidget[] = [];

  const requestedKpiCount = coerceKpiCount(plan.kpiCount);
  const baseKpis = normalizeKpis(plan.kpis).map((metric) => pickKpiByMetric(data, metric));
  const selectedKpis: ReturnType<typeof generateFakeDashboardData>["kpis"] = [];

  for (const item of baseKpis) {
    selectedKpis.push(item);
  }

  if (selectedKpis.length < requestedKpiCount) {
    const needed = requestedKpiCount - selectedKpis.length;
    for (let i = 0; i < needed; i += 1) {
      const micro = data.microMetrics[i];
      if (!micro) {
        break;
      }
      selectedKpis.push({
        id: `kpi-extra-${micro.id}`,
        title: micro.label,
        subtitle: "requested KPI",
        value: micro.value,
        delta: micro.delta,
        tone: micro.tone,
        sparkline: micro.sparkline
      });
    }
  }

  for (const kpi of selectedKpis) {
    widgets.push({
      id: kpi.id,
      nodeType: "card",
      intrinsicSize: { width: 320, height: 190 },
      constraints: { minWidth: 220, maxWidth: 420 },
      payload: {
        widget: "kpi",
        title: kpi.title,
        subtitle: kpi.subtitle,
        value: kpi.value,
        delta: kpi.delta,
        tone: kpi.tone,
        sparkline: kpi.sparkline
      } satisfies WidgetPayload
    });
  }

  if (plan.includeComparison) {
    const left = Number.parseFloat(data.topPages[0]?.conversion.replace("%", "") ?? "0");
    const right = Number.parseFloat(data.topPages[1]?.conversion.replace("%", "") ?? "0");
    widgets.push({
      id: "compare-plan",
      nodeType: "custom",
      intrinsicSize: { width: 420, height: 220 },
      constraints: { minWidth: 260, maxWidth: 560 },
      payload: {
        widget: "compare",
        title: `${plan.compareLeftLabel} vs ${plan.compareRightLabel}`,
        leftLabel: plan.compareLeftLabel,
        rightLabel: plan.compareRightLabel,
        leftValue: left,
        rightValue: right,
        unit: "%"
      } satisfies WidgetPayload
    });
  }

  if (plan.includeTrend) {
    widgets.push({
      id: "trend-revenue",
      nodeType: "chart",
      intrinsicSize: { width: 680, height: 300 },
      constraints: { minWidth: 280, maxWidth: 860 },
      payload: {
        widget: "line",
        title: "Revenue Trend",
        unit: "€",
        points: data.revenueSeries,
        labels: data.labels,
        change: data.kpis[0]?.delta ?? "+0.0%",
        tone: data.kpis[0]?.tone ?? "neutral"
      } satisfies WidgetPayload
    });
    widgets.push({
      id: "trend-conversion",
      nodeType: "chart",
      intrinsicSize: { width: 680, height: 290 },
      constraints: { minWidth: 280, maxWidth: 860 },
      payload: {
        widget: "line",
        title: "Conversion Trend",
        unit: "%",
        points: data.conversionSeries,
        labels: data.labels,
        change: data.kpis[3]?.delta ?? "+0.0%",
        tone: data.kpis[3]?.tone ?? "neutral"
      } satisfies WidgetPayload
    });
  }

  if (plan.includeTable) {
    widgets.push({
      id: "table-top-pages",
      nodeType: "custom",
      intrinsicSize: { width: 760, height: 320 },
      constraints: { minWidth: 320, maxWidth: 980 },
      payload: {
        widget: "table",
        title: "Top Pages",
        columns: ["Page", "Sessions", "Conversion", "Revenue"],
        rows: data.topPages
      } satisfies WidgetPayload
    });
  }

  if (plan.includeAlerts) {
    widgets.push({
      id: "alerts-live",
      nodeType: "custom",
      intrinsicSize: { width: 420, height: 300 },
      constraints: { minWidth: 260, maxWidth: 520 },
      payload: {
        widget: "alerts",
        title: "Active Alerts",
        alerts: data.alerts
      } satisfies WidgetPayload
    });
  }

  widgets.push({
    id: "summary-ai",
    nodeType: "text",
    intrinsicSize: { width: 860, height: 140 },
    constraints: { minWidth: 320, maxWidth: 1100 },
    payload: {
      widget: "summary",
      title: "AI Summary",
      text: buildNarrative(data.summaryText, sources, plan.narrative)
    } satisfies WidgetPayload
  });

  return {
    title: "AI Generated Dashboard",
    userPrompt: safePrompt,
    layoutType: plan.layoutType,
    narrative: `Generated from ${sources.length} retrieved documents.`,
    widgets,
    sources
  };
}

function inferSignals(prompt: string): PromptSignals {
  const normalized = normalize(prompt);
  return {
    wantsRevenue: /(mrr|revenue|ca|recurring)/.test(normalized),
    wantsChurn: /(churn|retention)/.test(normalized),
    wantsActivation: /(activation|onboarding)/.test(normalized),
    wantsNps: /(nps|satisfaction|sentiment)/.test(normalized),
    wantsComparison: /(comparatif|compare|comparison|vs|versus)/.test(normalized),
    wantsTrend: /(trend|tendance|evolution|series)/.test(normalized),
    wantsAlerts: /(alert|incident|risk|risque|ops)/.test(normalized),
    wantsTable: /(table|top page|pages|segment|breakdown)/.test(normalized)
  };
}

function planFromSignals(signals: PromptSignals, prompt: string): DashboardPlan {
  const comparison = extractComparisonLabels(prompt);
  return {
    layoutType: inferLayoutType(prompt),
    kpis: [
      ...(signals.wantsRevenue ? (["revenue"] as const) : []),
      ...(signals.wantsChurn ? (["churn"] as const) : []),
      ...(signals.wantsNps ? (["nps"] as const) : []),
      ...(signals.wantsActivation ? (["activation"] as const) : [])
    ],
    includeComparison: signals.wantsComparison,
    compareLeftLabel: comparison.left,
    compareRightLabel: comparison.right,
    includeTrend: signals.wantsTrend,
    includeAlerts: signals.wantsAlerts,
    includeTable: signals.wantsTable,
    kpiCount: extractRequestedKpiCount(prompt)
  };
}

function normalizeKpis(values: ReadonlyArray<KpiMetric>): KpiMetric[] {
  const deduped = Array.from(new Set(values));
  if (deduped.length > 0) {
    return deduped;
  }
  return ["revenue", "churn", "activation"];
}

function pickKpiByMetric(
  data: ReturnType<typeof generateFakeDashboardData>,
  metric: KpiMetric
): ReturnType<typeof generateFakeDashboardData>["kpis"][number] {
  switch (metric) {
    case "revenue":
      return data.kpis[0];
    case "churn":
      return data.kpis[1];
    case "nps":
      return data.kpis[2];
    case "activation":
      return data.kpis[3];
    default:
      return assertNever(metric);
  }
}

function extractComparisonLabels(prompt: string): { left: string; right: string } {
  const directMatch = prompt.match(/([A-Za-z0-9][A-Za-z0-9 -]{1,28})\s+vs\.?\s+([A-Za-z0-9][A-Za-z0-9 -]{1,28})/i);
  if (directMatch) {
    return {
      left: cleanLabel(directMatch[1]),
      right: cleanLabel(directMatch[2])
    };
  }

  return { left: "Plan A", right: "Plan B" };
}

function cleanLabel(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 24);
}

function buildNarrative(
  summary: string,
  sources: DashboardSpec["sources"],
  extraNarrative?: string
): string {
  const sourceTitles = sources.map((source) => source.title).join(", ");
  const prefix = extraNarrative ? `${extraNarrative}. ` : "";
  return `${prefix}${summary} Sources used: ${sourceTitles}.`;
}

function deriveSeed(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash % 99991) + 1;
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function extractRequestedKpiCount(prompt: string): number | undefined {
  const normalized = normalize(prompt);
  const match = normalized.match(/\b(\d{1,2})\s*kpi(s)?\b/);
  if (!match) {
    return undefined;
  }

  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return coerceKpiCount(parsed);
}

function coerceKpiCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 3;
  }
  return Math.max(1, Math.min(12, Math.round(value)));
}

function inferLayoutType(prompt: string): DashboardSpec["layoutType"] {
  const normalized = normalize(prompt);
  if (normalized.includes("vertical")) {
    return "vertical";
  }
  if (normalized.includes("grid")) {
    return "grid";
  }
  return "masonry";
}

async function generatePlanWithOllama(
  prompt: string,
  sources: DashboardSpec["sources"],
  options: DashboardGenerationOptions
): Promise<DashboardPlan> {
  const baseUrl = options.ollamaBaseUrl ?? DEFAULT_OLLAMA_BASE_URL;
  const model = options.ollamaModel ?? DEFAULT_OLLAMA_MODEL;
  const timeoutMs = options.timeoutMs ?? DEFAULT_OLLAMA_TIMEOUT_MS;

  const sourceContext = sources
    .map((source) => `- [${source.kind}] ${source.title}: ${source.excerpt}`)
    .join("\n");

  const systemPrompt = [
    "You are an assistant generating dashboard layout plans.",
    "Respond with strict JSON only. No markdown.",
    "Schema:",
    "{",
    '  "layoutType": "masonry|grid|vertical",',
    '  "kpis": ["revenue|churn|nps|activation"],',
    '  "kpiCount": number,',
    '  "includeComparison": boolean,',
    '  "compareLeftLabel": string,',
    '  "compareRightLabel": string,',
    '  "includeTrend": boolean,',
    '  "includeAlerts": boolean,',
    '  "includeTable": boolean,',
    '  "narrative": string',
    "}"
  ].join("\n");

  const userPrompt = [
    `User request: ${prompt}`,
    "Retrieved documents:",
    sourceContext
  ].join("\n\n");

  const controller = new AbortController();
  const abortTimer = window.setTimeout(() => controller.abort("timeout"), timeoutMs);

  try {
    let response: Response;
    try {
      response = await fetch(`${trimTrailingSlash(baseUrl)}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          stream: false,
          format: "json",
          keep_alive: "15m",
          options: {
            temperature: 0.1,
            num_predict: 220
          },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ]
        })
      });
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") {
        throw new Error(`Ollama timeout after ${Math.round(timeoutMs / 1000)}s`);
      }
      const message = cause instanceof Error ? cause.message : String(cause);
      throw new Error(`Ollama request failed: ${message}`);
    }

    if (!response.ok) {
      throw new Error(`Ollama HTTP ${response.status}`);
    }

    const payload = (await response.json()) as unknown;
    const raw = extractContentFromOllamaPayload(payload);
    const parsed = parseJsonObject(raw);
    return coerceDashboardPlan(parsed);
  } finally {
    window.clearTimeout(abortTimer);
  }
}

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function extractContentFromOllamaPayload(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid Ollama response payload.");
  }

  const value = payload as {
    message?: { content?: unknown };
    response?: unknown;
  };

  if (typeof value.message?.content === "string") {
    return value.message.content;
  }
  if (typeof value.response === "string") {
    return value.response;
  }

  throw new Error("Missing message content in Ollama response.");
}

function parseJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  const direct = tryParseJson(trimmed);
  if (direct !== null) {
    return direct;
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const candidate = trimmed.slice(start, end + 1);
    const embedded = tryParseJson(candidate);
    if (embedded !== null) {
      return embedded;
    }
  }

  throw new Error("Ollama JSON parse failed.");
}

function tryParseJson(raw: string): unknown | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function coerceDashboardPlan(value: unknown): DashboardPlan {
  if (!value || typeof value !== "object") {
    throw new Error("Plan must be an object.");
  }

  const input = value as Record<string, unknown>;
  const layoutType = input.layoutType;
  const includeComparison = Boolean(input.includeComparison);
  const includeTrend = Boolean(input.includeTrend);
  const includeAlerts = Boolean(input.includeAlerts);
  const includeTable = Boolean(input.includeTable);
  const narrative = typeof input.narrative === "string" ? input.narrative.trim() : undefined;
  const rawKpiCount = input.kpiCount;

  const parsedKpis = Array.isArray(input.kpis)
    ? input.kpis
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.toLowerCase())
        .filter((entry): entry is KpiMetric =>
          entry === "revenue" || entry === "churn" || entry === "nps" || entry === "activation"
        )
    : [];

  return {
    layoutType:
      layoutType === "grid" || layoutType === "vertical" || layoutType === "masonry"
        ? layoutType
        : "masonry",
    kpis: normalizeKpis(parsedKpis),
    includeComparison,
    compareLeftLabel: cleanLabel(stringOrFallback(input.compareLeftLabel, "Plan A")),
    compareRightLabel: cleanLabel(stringOrFallback(input.compareRightLabel, "Plan B")),
    includeTrend,
    includeAlerts,
    includeTable,
    kpiCount: coerceKpiCount(typeof rawKpiCount === "number" ? rawKpiCount : undefined),
    ...(narrative ? { narrative } : {})
  };
}

function stringOrFallback(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }
  return fallback;
}

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}
