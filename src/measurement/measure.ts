import type { Node, Size } from "../types";
import { clampWidth, normalizeConstraints, stableSerialize } from "../utils";

// Heuristic measurement constants for fallback when Pretext is unavailable
const TEXT_CHAR_WIDTH = 7;
const TEXT_LINE_HEIGHT = 20;
const TEXT_HORIZONTAL_PADDING = 16;
const TEXT_VERTICAL_PADDING = 14;

const CARD_BASE_HEIGHT = 96;
const CARD_CHARS_PER_ROW = 72;
const CARD_ROW_HEIGHT = 18;

const CHART_DEFAULT_HEIGHT = 240;
const CUSTOM_DEFAULT_HEIGHT = 180;

export type TextWhiteSpaceMode = "normal" | "pre-wrap";
export type TextMeasurementStrategy = "heuristic" | "pretext";

export interface TextMeasurementOptions {
  strategy: TextMeasurementStrategy;
  font: string;
  lineHeight: number;
  whiteSpace: TextWhiteSpaceMode;
}

export interface TextMeasurementRuntimeState {
  strategy: TextMeasurementStrategy;
  pretextLoaded: boolean;
  pretextAvailable: boolean;
  pretextLoadError: string | null;
  preparedCacheSize: number;
  font: string;
  lineHeight: number;
  whiteSpace: TextWhiteSpaceMode;
}

interface PretextPrepareOptions {
  whiteSpace?: TextWhiteSpaceMode;
}

interface PretextLayoutResult {
  height: number;
  lineCount: number;
}

interface PretextModule {
  prepare(text: string, font: string, options?: PretextPrepareOptions): unknown;
  layout(prepared: unknown, maxWidth: number, lineHeight: number): PretextLayoutResult;
  clearCache?: () => void;
}

const DEFAULT_TEXT_MEASUREMENT: TextMeasurementOptions = {
  strategy: "heuristic",
  font: "16px Inter",
  lineHeight: TEXT_LINE_HEIGHT,
  whiteSpace: "normal"
};

let textMeasurementOptions: TextMeasurementOptions = { ...DEFAULT_TEXT_MEASUREMENT };
let pretextModule: PretextModule | null = null;
let pretextLoaded = false;
let pretextLoadError: Error | null = null;
const pretextPreparedCache = new Map<string, unknown>();

export function measure(node: Node, width: number): Size {
  const constraints = normalizeConstraints(node.constraints);
  const safeWidth = clampWidth(Math.max(1, width), constraints);

  switch (node.type) {
    case "text":
      return measureText(node, safeWidth);
    case "card":
      return measureCard(node, safeWidth);
    case "chart":
      return measureChart(node, safeWidth);
    case "custom":
      return measureCustom(node, safeWidth);
    default:
      return assertNever(node.type);
  }
}

function measureText(node: Node, width: number): Size {
  if (node.intrinsicSize) {
    const ratio = node.intrinsicSize.height / Math.max(1, node.intrinsicSize.width);
    const scaledHeight = Math.max(TEXT_LINE_HEIGHT + TEXT_VERTICAL_PADDING * 2, Math.round(width * ratio));
    return { width, height: scaledHeight };
  }

  const pretext = measureTextWithPretext(node, width);
  if (pretext) {
    return pretext;
  }

  const text = extractText(node.content);
  const printableLength = Math.max(1, text.trim().length);
  const availableWidth = Math.max(1, width - TEXT_HORIZONTAL_PADDING * 2);
  const charsPerLine = Math.max(1, Math.floor(availableWidth / TEXT_CHAR_WIDTH));
  const lines = Math.ceil(printableLength / charsPerLine);
  const height = lines * TEXT_LINE_HEIGHT + TEXT_VERTICAL_PADDING * 2;

  return { width, height };
}

function measureTextWithPretext(node: Node, width: number): Size | null {
  if (textMeasurementOptions.strategy !== "pretext" || pretextModule === null) {
    return null;
  }

  const text = extractText(node.content).trim();
  if (text.length === 0) {
    return {
      width,
      height: textMeasurementOptions.lineHeight + TEXT_VERTICAL_PADDING * 2
    };
  }

  const availableWidth = Math.max(1, width - TEXT_HORIZONTAL_PADDING * 2);
  const cacheKey = `${textMeasurementOptions.font}|${textMeasurementOptions.whiteSpace}|${text}`;

  try {
    let prepared = pretextPreparedCache.get(cacheKey);
    if (!prepared) {
      prepared = pretextModule.prepare(text, textMeasurementOptions.font, {
        whiteSpace: textMeasurementOptions.whiteSpace
      });
      pretextPreparedCache.set(cacheKey, prepared);
    }

    const result = pretextModule.layout(prepared, availableWidth, textMeasurementOptions.lineHeight);
    return {
      width,
      height: Math.max(
        textMeasurementOptions.lineHeight + TEXT_VERTICAL_PADDING * 2,
        Math.ceil(result.height) + TEXT_VERTICAL_PADDING * 2
      )
    };
  } catch {
    return null;
  }
}

function measureCard(node: Node, width: number): Size {
  if (node.intrinsicSize) {
    const ratio = node.intrinsicSize.height / Math.max(1, node.intrinsicSize.width);
    return {
      width,
      height: Math.max(CARD_BASE_HEIGHT, Math.round(width * ratio))
    };
  }

  const textLength = extractText(node.content).length;
  const serializedLength = stableSerialize(node.content).length;
  const effectiveLength = Math.max(textLength, serializedLength);
  const rows = Math.ceil(effectiveLength / CARD_CHARS_PER_ROW);

  return {
    width,
    height: CARD_BASE_HEIGHT + rows * CARD_ROW_HEIGHT
  };
}

function measureChart(node: Node, width: number): Size {
  return {
    width,
    height: node.intrinsicSize?.height ?? CHART_DEFAULT_HEIGHT
  };
}

function measureCustom(node: Node, width: number): Size {
  if (node.intrinsicSize) {
    const ratio = node.intrinsicSize.height / Math.max(1, node.intrinsicSize.width);
    return {
      width,
      height: Math.max(1, Math.round(width * ratio))
    };
  }

  return {
    width,
    height: CUSTOM_DEFAULT_HEIGHT
  };
}

function extractText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (typeof content === "number" || typeof content === "boolean" || typeof content === "bigint") {
    return String(content);
  }

  if (content === null || typeof content === "undefined") {
    return "";
  }

  if (Array.isArray(content)) {
    return content.map((entry) => extractText(entry)).join(" ");
  }

  if (typeof content === "object") {
    return Object.values(content)
      .map((entry) => extractText(entry))
      .join(" ");
  }

  return "";
}

function assertNever(value: never): never {
  throw new Error(`Unsupported node type: ${String(value)}`);
}

function normalizeTextMeasurementOptions(
  patch: Partial<TextMeasurementOptions>,
  base: TextMeasurementOptions,
): TextMeasurementOptions {
  const strategy = patch.strategy ?? base.strategy;
  const font = typeof patch.font === "string" && patch.font.trim().length > 0 ? patch.font : base.font;
  const lineHeight =
    typeof patch.lineHeight === "number" && Number.isFinite(patch.lineHeight) && patch.lineHeight > 0
      ? patch.lineHeight
      : base.lineHeight;
  const whiteSpace =
    patch.whiteSpace === "normal" || patch.whiteSpace === "pre-wrap"
      ? patch.whiteSpace
      : base.whiteSpace;

  return { strategy, font, lineHeight, whiteSpace };
}

export function configureTextMeasurement(options: Partial<TextMeasurementOptions>): TextMeasurementOptions {
  const next = normalizeTextMeasurementOptions(options, textMeasurementOptions);
  const changedPretextInputs =
    next.font !== textMeasurementOptions.font || next.whiteSpace !== textMeasurementOptions.whiteSpace;
  textMeasurementOptions = next;

  if (changedPretextInputs) {
    pretextPreparedCache.clear();
  }

  return { ...textMeasurementOptions };
}

async function loadPretextModule(): Promise<PretextModule> {
  if (pretextModule !== null) {
    return pretextModule;
  }

  try {
    const imported = await import("@chenglou/pretext");
    const moduleValue = imported as Partial<PretextModule>;

    if (
      typeof moduleValue.prepare !== "function" ||
      typeof moduleValue.layout !== "function"
    ) {
      throw new Error("Invalid @chenglou/pretext module shape.");
    }

    const loaded: PretextModule = {
      prepare: moduleValue.prepare.bind(moduleValue),
      layout: moduleValue.layout.bind(moduleValue),
      ...(typeof moduleValue.clearCache === "function"
        ? { clearCache: moduleValue.clearCache.bind(moduleValue) }
        : {})
    };
    pretextModule = loaded;
    pretextLoadError = null;
    pretextLoaded = true;
    return loaded;
  } catch (error) {
    pretextLoadError = error instanceof Error ? error : new Error(String(error));
    throw pretextLoadError;
  }
}

export async function initializePretextTextMeasurement(
  options: Partial<TextMeasurementOptions> = {},
): Promise<boolean> {
  try {
    await loadPretextModule();
    configureTextMeasurement({ ...options, strategy: "pretext" });
    return true;
  } catch {
    configureTextMeasurement({ ...options, strategy: "heuristic" });
    return false;
  }
}

export function clearTextMeasurementCaches(): void {
  pretextPreparedCache.clear();
  if (pretextModule?.clearCache) {
    pretextModule.clearCache();
  }
}

export function getTextMeasurementRuntimeState(): TextMeasurementRuntimeState {
  return {
    strategy: textMeasurementOptions.strategy,
    pretextLoaded,
    pretextAvailable: pretextModule !== null,
    pretextLoadError: pretextLoadError ? pretextLoadError.message : null,
    preparedCacheSize: pretextPreparedCache.size,
    font: textMeasurementOptions.font,
    lineHeight: textMeasurementOptions.lineHeight,
    whiteSpace: textMeasurementOptions.whiteSpace
  };
}
