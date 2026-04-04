import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import express from "express";
import mammoth from "mammoth";
import multer from "multer";
import pdfParse from "pdf-parse";
import xlsx from "xlsx";

const PORT = Number(process.env.RAG_API_PORT ?? 8787);
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "qwen3.5:9b";
const OLLAMA_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS ?? 90000);

const STORAGE_DIR = path.resolve(process.cwd(), "server", "data");
const STORAGE_FILE = path.resolve(STORAGE_DIR, "rag-store.json");

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_FILES_PER_UPLOAD = 12;
const MAX_EXTRACTED_TEXT = 160_000;
const EMBEDDING_DIM = 256;
const CHUNK_TOKEN_SIZE = 180;
const CHUNK_TOKEN_OVERLAP = 40;

const SUPPORTED_KINDS = new Set(["pdf", "xlsx", "xls", "csv", "docx", "txt", "md", "json"]);

const DEFAULT_CORPUS = [
  {
    id: "seed-finance",
    kind: "pdf",
    title: "Q1 Board Finance Pack",
    excerpt:
      "Monthly recurring revenue reached 148k EUR. Churn moved from 2.4 to 2.1 percent. Expansion revenue increased in enterprise tier.",
    score: 0.1
  },
  {
    id: "seed-web-analytics",
    kind: "xlsx",
    title: "Web Analytics Conversion Workbook",
    excerpt:
      "Top converting pages: /pricing, /signup, /checkout. Conversion trend positive on mobile and mixed on desktop.",
    score: 0.1
  },
  {
    id: "seed-roadmap",
    kind: "md",
    title: "Product Roadmap Summary",
    excerpt:
      "Focus areas: activation, conversion uplift, plan comparison insights, and proactive risk alerting.",
    score: 0.1
  }
];

/** @type {{version:number,documents:Array<{id:string,title:string,kind:string,size:number,uploadedAt:string,excerpt:string,chunkCount:number}>,chunks:Array<{id:string,documentId:string,text:string,embedding:number[]}>}} */
const ragStore = {
  version: 1,
  documents: [],
  chunks: []
};

const app = express();
app.use(express.json({ limit: "1mb" }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_BYTES,
    files: MAX_FILES_PER_UPLOAD
  }
});

await initializeStore();

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    documents: ragStore.documents.length,
    chunks: ragStore.chunks.length
  });
});

app.get("/api/sources", (_req, res) => {
  res.json({ sources: listStoredSources() });
});

app.post("/api/upload", upload.array("files", MAX_FILES_PER_UPLOAD), async (req, res) => {
  try {
    const files = Array.isArray(req.files) ? req.files : [];
    if (files.length === 0) {
      res.status(400).json({ error: "No files uploaded. Use field name 'files'." });
      return;
    }

    const uploaded = [];
    const rejected = [];

    for (const file of files) {
      try {
        const kind = resolveKind(file.originalname, file.mimetype);
        if (!kind) {
          rejected.push({
            filename: file.originalname,
            reason: "Unsupported format. Allowed: pdf, xlsx, xls, csv, docx, txt, md, json."
          });
          continue;
        }

        const extracted = await extractTextByKind(file.buffer, kind);
        const normalized = normalizeWhitespace(extracted).slice(0, MAX_EXTRACTED_TEXT);
        if (normalized.length < 30) {
          rejected.push({
            filename: file.originalname,
            reason: "No usable textual content extracted from file."
          });
          continue;
        }

        const chunks = chunkText(normalized);
        if (chunks.length === 0) {
          rejected.push({
            filename: file.originalname,
            reason: "No indexable chunks produced."
          });
          continue;
        }

        const documentId = createId("doc");
        const uploadedAt = new Date().toISOString();
        const excerpt = chunks[0].slice(0, 160);

        ragStore.documents.push({
          id: documentId,
          title: file.originalname,
          kind,
          size: file.size,
          uploadedAt,
          excerpt,
          chunkCount: chunks.length
        });

        for (const chunkTextValue of chunks) {
          ragStore.chunks.push({
            id: createId("chunk"),
            documentId,
            text: chunkTextValue,
            embedding: embedText(chunkTextValue)
          });
        }

        uploaded.push({
          id: documentId,
          kind,
          title: file.originalname,
          excerpt,
          score: 1
        });
      } catch (error) {
        rejected.push({
          filename: file.originalname,
          reason: error instanceof Error ? error.message : String(error)
        });
      }
    }

    if (uploaded.length > 0) {
      await persistStore();
    }

    res.json({
      uploaded,
      rejected,
      totalDocuments: ragStore.documents.length
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

app.post("/api/chat", async (req, res) => {
  try {
    const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";
    if (prompt.length === 0) {
      res.status(400).json({ error: "Prompt must be a non-empty string." });
      return;
    }

    const startedAt = Date.now();
    const sources = retrieveRelevantSources(prompt, 4);

    let plan;
    let provider = `Ollama ${OLLAMA_MODEL}`;

    try {
      plan = await generatePlanWithOllama({
        prompt,
        sources,
        model:
          typeof req.body?.model === "string" && req.body.model.trim().length > 0
            ? req.body.model.trim()
            : OLLAMA_MODEL,
        timeoutMs: clampNumber(req.body?.timeoutMs, 15_000, 180_000, OLLAMA_TIMEOUT_MS)
      });
    } catch (error) {
      provider = `Local planner fallback (${error instanceof Error ? error.message : String(error)})`;
      plan = planFromSignals(inferSignals(prompt), prompt);
    }

    const data = generateData(seedFrom(`${prompt}|${sources.map((s) => s.id).join("|")}`), sources);
    const spec = buildSpecFromPlan(prompt, sources, data, plan);

    res.json({
      provider,
      elapsedMs: Date.now() - startedAt,
      spec
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

app.use((error, _req, res, _next) => {
  res.status(500).json({
    error: error instanceof Error ? error.message : String(error)
  });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[rag-api] listening on http://127.0.0.1:${PORT}`);
});

async function initializeStore() {
  await fs.mkdir(STORAGE_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(STORAGE_FILE, "utf8");
    const parsed = JSON.parse(raw);

    if (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray(parsed.documents) &&
      Array.isArray(parsed.chunks)
    ) {
      ragStore.documents = parsed.documents;
      ragStore.chunks = parsed.chunks;
    }
  } catch (error) {
    if (isNoEntError(error)) {
      await persistStore();
      return;
    }
    throw error;
  }
}

async function persistStore() {
  const payload = JSON.stringify(
    {
      version: ragStore.version,
      documents: ragStore.documents,
      chunks: ragStore.chunks
    },
    null,
    2
  );
  await fs.writeFile(STORAGE_FILE, payload, "utf8");
}

function listStoredSources() {
  return [...ragStore.documents]
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
    .map((doc) => ({
      id: doc.id,
      kind: doc.kind,
      title: doc.title,
      excerpt: doc.excerpt,
      score: 0
    }));
}

function createId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function normalizeWhitespace(value) {
  return value
    .replace(/\u0000/g, " ")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function resolveKind(filename, mimetype) {
  const extension = path.extname(filename).toLowerCase().replace(".", "");
  if (SUPPORTED_KINDS.has(extension)) {
    return extension;
  }

  if (mimetype === "text/plain") {
    return "txt";
  }
  if (mimetype === "application/json") {
    return "json";
  }
  if (mimetype === "text/csv") {
    return "csv";
  }

  return null;
}

async function extractTextByKind(buffer, kind) {
  switch (kind) {
    case "txt":
    case "md":
    case "csv":
    case "json":
      return buffer.toString("utf8");
    case "pdf": {
      const parsed = await pdfParse(buffer);
      return parsed.text ?? "";
    }
    case "xlsx":
    case "xls": {
      const workbook = xlsx.read(buffer, { type: "buffer" });
      const parts = [];
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const csv = xlsx.utils.sheet_to_csv(sheet, { blankrows: false });
        if (csv.trim().length > 0) {
          parts.push(`# Sheet: ${sheetName}\n${csv}`);
        }
      }
      return parts.join("\n\n");
    }
    case "docx": {
      const result = await mammoth.extractRawText({ buffer });
      return result.value ?? "";
    }
    default:
      throw new Error(`Unsupported file kind: ${kind}`);
  }
}

function chunkText(text) {
  const tokens = tokenize(text);
  if (tokens.length === 0) {
    return [];
  }

  const chunks = [];
  const stride = Math.max(1, CHUNK_TOKEN_SIZE - CHUNK_TOKEN_OVERLAP);

  for (let start = 0; start < tokens.length; start += stride) {
    const slice = tokens.slice(start, start + CHUNK_TOKEN_SIZE);
    const chunkValue = slice.join(" ").trim();
    if (chunkValue.length >= 40) {
      chunks.push(chunkValue);
    }
  }

  return chunks;
}

function tokenize(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9%./-]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

function embedText(text) {
  const tokens = tokenize(text);
  const vector = new Array(EMBEDDING_DIM).fill(0);

  for (const token of tokens) {
    const hash = hashToken(token);
    vector[hash % EMBEDDING_DIM] += 1;
    vector[(hash >>> 8) % EMBEDDING_DIM] += 0.5;
    vector[(hash >>> 16) % EMBEDDING_DIM] += 0.25;
  }

  const norm = Math.sqrt(vector.reduce((acc, value) => acc + value * value, 0));
  if (norm > 0) {
    for (let i = 0; i < vector.length; i += 1) {
      vector[i] /= norm;
    }
  }

  return vector;
}

function hashToken(token) {
  let hash = 2166136261;
  for (let i = 0; i < token.length; i += 1) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const length = Math.min(a.length, b.length);

  for (let i = 0; i < length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dot / Math.sqrt(normA * normB);
}

function retrieveRelevantSources(prompt, limit = 4) {
  if (ragStore.chunks.length === 0 || ragStore.documents.length === 0) {
    return DEFAULT_CORPUS.slice(0, limit);
  }

  const queryEmbedding = embedText(prompt);

  const scored = ragStore.chunks
    .map((chunk) => ({
      chunk,
      score: cosineSimilarity(queryEmbedding, chunk.embedding)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 24);

  const documentsById = new Map(ragStore.documents.map((doc) => [doc.id, doc]));
  const consolidated = new Map();

  for (const item of scored) {
    const doc = documentsById.get(item.chunk.documentId);
    if (!doc) {
      continue;
    }

    const existing = consolidated.get(doc.id);
    if (!existing || item.score > existing.score) {
      consolidated.set(doc.id, {
        id: doc.id,
        kind: doc.kind,
        title: doc.title,
        excerpt: item.chunk.text.slice(0, 180),
        score: round(item.score, 4)
      });
    }
  }

  const ranked = [...consolidated.values()].sort((a, b) => b.score - a.score).slice(0, limit);
  if (ranked.length > 0) {
    return ranked;
  }

  return DEFAULT_CORPUS.slice(0, limit);
}

function inferSignals(prompt) {
  const normalized = prompt
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

  return {
    wantsRevenue: /(mrr|revenue|recurring|ca)/.test(normalized),
    wantsChurn: /(churn|retention)/.test(normalized),
    wantsActivation: /(activation|onboarding)/.test(normalized),
    wantsNps: /(nps|sentiment|satisfaction)/.test(normalized),
    wantsComparison: /(comparatif|compare|comparison|vs|versus)/.test(normalized),
    wantsTrend: /(trend|tendance|evolution|series)/.test(normalized),
    wantsAlerts: /(alert|incident|risk|risque|ops)/.test(normalized),
    wantsTable: /(table|top page|pages|segment|breakdown)/.test(normalized)
  };
}

function planFromSignals(signals, prompt) {
  return {
    layoutType: inferLayoutType(prompt),
    kpis: [
      ...(signals.wantsRevenue ? ["revenue"] : []),
      ...(signals.wantsChurn ? ["churn"] : []),
      ...(signals.wantsNps ? ["nps"] : []),
      ...(signals.wantsActivation ? ["activation"] : [])
    ],
    kpiCount: extractRequestedKpiCount(prompt),
    includeComparison: signals.wantsComparison,
    compareLeftLabel: "Plan A",
    compareRightLabel: "Plan B",
    includeTrend: signals.wantsTrend,
    includeAlerts: signals.wantsAlerts,
    includeTable: signals.wantsTable,
    narrative: ""
  };
}

function inferLayoutType(prompt) {
  const normalized = prompt
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  if (normalized.includes("vertical")) {
    return "vertical";
  }
  if (normalized.includes("grid")) {
    return "grid";
  }
  return "masonry";
}

function extractRequestedKpiCount(prompt) {
  const match = prompt.toLowerCase().match(/\b(\d{1,2})\s*kpi(s)?\b/);
  if (!match) {
    return undefined;
  }
  return clampNumber(Number(match[1]), 1, 12, 4);
}

async function generatePlanWithOllama({ prompt, sources, model, timeoutMs }) {
  const systemPrompt = [
    "You generate dashboard plans.",
    "Return strict JSON only.",
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
    "Retrieved sources:",
    ...sources.map((source) => `- [${source.kind}] ${source.title}: ${source.excerpt}`)
  ].join("\n");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("timeout"), timeoutMs);

  try {
    const response = await fetch(`${trimTrailingSlash(OLLAMA_BASE_URL)}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        stream: false,
        format: "json",
        keep_alive: "10m",
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

    if (!response.ok) {
      throw new Error(`Ollama HTTP ${response.status}`);
    }

    const payload = await response.json();
    const content =
      typeof payload?.message?.content === "string"
        ? payload.message.content
        : typeof payload?.response === "string"
          ? payload.response
          : "";
    if (content.trim().length === 0) {
      throw new Error("Missing Ollama content");
    }

    const parsed = parseJsonObject(content);
    return coercePlan(parsed);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`Ollama timeout after ${Math.round(timeoutMs / 1000)}s`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function parseJsonObject(raw) {
  const trimmed = raw.trim();
  const direct = tryParseJson(trimmed);
  if (direct !== null) {
    return direct;
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const embedded = tryParseJson(trimmed.slice(start, end + 1));
    if (embedded !== null) {
      return embedded;
    }
  }

  throw new Error("Unable to parse plan JSON.");
}

function tryParseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function coercePlan(value) {
  const fallback = planFromSignals(
    {
      wantsRevenue: true,
      wantsChurn: true,
      wantsActivation: true,
      wantsNps: false,
      wantsComparison: true,
      wantsTrend: true,
      wantsAlerts: true,
      wantsTable: true
    },
    ""
  );

  if (!value || typeof value !== "object") {
    return fallback;
  }

  return {
    layoutType: coerceEnum(value.layoutType, ["masonry", "grid", "vertical"], fallback.layoutType),
    kpis: coerceKpis(value.kpis),
    kpiCount: clampNumber(value.kpiCount, 1, 12, 4),
    includeComparison: Boolean(value.includeComparison),
    compareLeftLabel: coerceString(value.compareLeftLabel, "Plan A", 24),
    compareRightLabel: coerceString(value.compareRightLabel, "Plan B", 24),
    includeTrend: Boolean(value.includeTrend),
    includeAlerts: Boolean(value.includeAlerts),
    includeTable: Boolean(value.includeTable),
    narrative: coerceString(value.narrative, "", 200)
  };
}

function coerceKpis(input) {
  if (!Array.isArray(input)) {
    return ["revenue", "churn", "activation"];
  }

  const allowed = new Set(["revenue", "churn", "nps", "activation"]);
  const deduped = [];
  for (const value of input) {
    if (typeof value === "string" && allowed.has(value) && !deduped.includes(value)) {
      deduped.push(value);
    }
  }
  return deduped.length > 0 ? deduped : ["revenue", "churn", "activation"];
}

function coerceEnum(value, allowed, fallback) {
  return typeof value === "string" && allowed.includes(value) ? value : fallback;
}

function coerceString(value, fallback, maxLength) {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed.length > 0 ? trimmed.slice(0, maxLength) : fallback;
}

function generateData(seed, sources) {
  const random = createRng(seed);
  const labels = Array.from({ length: 12 }, (_, index) => `M${index + 1}`);

  const revenueSeries = makeSeries(random, 12, random.int(90, 140), 9);
  const conversionSeries = makeSeries(random, 12, random.int(20, 42), 4);
  const churnValue = random.int(12, 34) / 10;
  const activationValue = random.int(55, 84);
  const npsValue = random.int(35, 72);

  const kpis = [
    {
      id: "kpi-revenue",
      title: "Monthly Recurring Revenue",
      subtitle: "vs previous month",
      value: `€${(revenueSeries[revenueSeries.length - 1] * 1000).toLocaleString()}`,
      delta: formatDelta((random.next() - 0.35) * 14),
      tone: "positive",
      sparkline: makeSeries(random, 10, 52, 8)
    },
    {
      id: "kpi-churn",
      title: "Customer Churn",
      subtitle: "monthly",
      value: `${churnValue.toFixed(1)}%`,
      delta: formatDelta((random.next() - 0.62) * 2),
      tone: "neutral",
      sparkline: makeSeries(random, 10, 40, 6)
    },
    {
      id: "kpi-nps",
      title: "Net Promoter Score",
      subtitle: "customer sentiment",
      value: `${npsValue}`,
      delta: formatDelta((random.next() - 0.5) * 8, ""),
      tone: "positive",
      sparkline: makeSeries(random, 10, 55, 8)
    },
    {
      id: "kpi-activation",
      title: "Activation Rate",
      subtitle: "new users",
      value: `${activationValue.toFixed(1)}%`,
      delta: formatDelta((random.next() - 0.45) * 10),
      tone: "positive",
      sparkline: makeSeries(random, 10, 47, 7)
    }
  ];

  const topPages = ["/pricing", "/signup", "/checkout", "/contact-sales", "/features"].map((page) => ({
    page,
    sessions: `${random.int(1200, 9200)}`,
    conversion: `${(random.int(10, 58) / 10).toFixed(1)}%`,
    revenue: `€${random.int(18_000, 94_000).toLocaleString()}`
  }));

  const alerts = [
    "Latency above SLA on checkout API",
    "Spike in failed payment intents",
    "Warehouse sync retries increasing",
    "Notification queue lag above threshold"
  ].map((message, index) => ({
    id: `alert-${index + 1}`,
    severity: index === 0 ? "high" : index % 2 === 0 ? "medium" : "low",
    message,
    minutesAgo: random.int(3, 50)
  }));

  const sourceSummary = sources.slice(0, 2).map((source) => source.title).join(", ");
  const summaryText = `Signals are improving on revenue and activation. Main evidence came from: ${sourceSummary || "uploaded files"}.`;

  return {
    kpis,
    revenueSeries,
    conversionSeries,
    labels,
    topPages,
    alerts,
    summaryText
  };
}

function createRng(seed) {
  let state = Math.abs(Math.floor(seed)) || 1;
  return {
    next() {
      state = (state * 1664525 + 1013904223) % 4294967296;
      return state / 4294967296;
    },
    int(min, max) {
      return Math.floor(this.next() * (max - min + 1)) + min;
    }
  };
}

function makeSeries(random, points, base, volatility) {
  const values = [];
  let current = base;
  for (let i = 0; i < points; i += 1) {
    current += (random.next() - 0.48) * volatility;
    values.push(Math.max(1, Math.round(current)));
  }
  return values;
}

function formatDelta(value, suffix = "%") {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}${suffix}`;
}

function buildSpecFromPlan(prompt, sources, data, plan) {
  const selectedKpis = selectKpis(data.kpis, plan.kpis, clampNumber(plan.kpiCount, 1, 12, 4));
  const widgets = [];

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
        tone: normalizeTone(kpi.tone),
        sparkline: kpi.sparkline
      }
    });
  }

  if (plan.includeComparison) {
    const leftValue = Number.parseFloat(data.topPages[0]?.conversion.replace("%", "") ?? "0");
    const rightValue = Number.parseFloat(data.topPages[1]?.conversion.replace("%", "") ?? "0");
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
        leftValue,
        rightValue,
        unit: "%"
      }
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
        tone: normalizeTone(data.kpis[0]?.tone ?? "neutral")
      }
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
        tone: normalizeTone(data.kpis[3]?.tone ?? "neutral")
      }
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
      }
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
      }
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
      text: plan.narrative?.trim().length ? `${plan.narrative}. ${data.summaryText}` : data.summaryText
    }
  });

  return {
    title: "AI Generated Dashboard",
    userPrompt: prompt,
    layoutType: coerceEnum(plan.layoutType, ["masonry", "grid", "vertical"], "masonry"),
    narrative: `Generated from ${sources.length} retrieved documents.`,
    widgets,
    sources
  };
}

function selectKpis(kpis, requested, requestedCount) {
  const byMetric = new Map([
    ["revenue", kpis[0]],
    ["churn", kpis[1]],
    ["nps", kpis[2]],
    ["activation", kpis[3]]
  ]);

  const selected = [];
  for (const metric of requested) {
    const value = byMetric.get(metric);
    if (value) {
      selected.push(value);
    }
  }

  if (selected.length === 0) {
    selected.push(kpis[0], kpis[1], kpis[3]);
  }

  while (selected.length < requestedCount) {
    const index = selected.length + 1;
    selected.push({
      id: `kpi-extra-${index}`,
      title: `Extra KPI ${index}`,
      subtitle: "custom metric",
      value: `${20 + index}`,
      delta: `+${(index / 2).toFixed(1)}%`,
      tone: "neutral",
      sparkline: [12 + index, 14 + index, 13 + index, 15 + index, 16 + index]
    });
  }

  return selected.slice(0, requestedCount);
}

function normalizeTone(value) {
  if (value === "positive" || value === "negative" || value === "neutral") {
    return value;
  }
  return "neutral";
}

function seedFrom(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash % 99991) + 1;
}

function trimTrailingSlash(value) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function round(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function clampNumber(value, min, max, fallback) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.round(value)));
}

function isNoEntError(error) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}
