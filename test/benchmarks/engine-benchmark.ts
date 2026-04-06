import { performance } from "node:perf_hooks";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { computeLayout, prepare, type Node } from "../../src";

interface BenchmarkThresholds {
  minSpeedup: number;
  maxPredictiveTotalMs: number;
  maxPrepareMs: number;
}

interface BenchmarkBaseline {
  version: number;
  datasetSize: number;
  widthCount: number;
  warmupRuns: number;
  sampleRuns: number;
  thresholds: BenchmarkThresholds;
}

interface BenchmarkSample {
  prepareMs: number;
  predictiveLayoutManyMs: number;
  predictiveTotalMs: number;
  naiveTotalMs: number;
}

interface BenchmarkResult {
  node: string;
  platform: string;
  arch: string;
  timestamp: string;
  baselineVersion: number;
  datasetSize: number;
  widthCount: number;
  warmupRuns: number;
  sampleRuns: number;
  prepareMsMedian: number;
  predictiveLayoutManyMsMedian: number;
  predictiveTotalMsMedian: number;
  naiveTotalMsMedian: number;
  speedupMedian: number;
  thresholds: BenchmarkThresholds;
}

function parseArgs(argv: readonly string[]): { ci: boolean; outputPath: string | null } {
  let ci = false;
  let outputPath: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current) continue;
    if (current === "--ci") {
      ci = true;
      continue;
    }
    if (current === "--output") {
      outputPath = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
  }

  return { ci, outputPath };
}

function buildStressNodes(count: number): Node[] {
  return Array.from({ length: count }, (_, index) => {
    if (index % 9 === 0) {
      return {
        id: `text-${index}`,
        type: "text",
        content:
          `Benchmark narrative ${index}: ` +
          "Revenue, conversion, retention, activation and margin context. ".repeat(3),
      } satisfies Node;
    }

    if (index % 4 === 0) {
      return {
        id: `chart-${index}`,
        type: "chart",
        content: { title: `Trend ${index}`, points: [3, 8, 5, 9, 11, 10] },
      } satisfies Node;
    }

    return {
      id: `card-${index}`,
      type: "card",
      content: {
        title: `Metric ${index}`,
        body: "Card payload for benchmark throughput measurement.".repeat((index % 5) + 1),
      },
    } satisfies Node;
  });
}

function buildWidths(widthCount: number): number[] {
  return Array.from({ length: widthCount }, (_, index) => 520 + index * 44);
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1]! + sorted[middle]!) / 2;
  }
  return sorted[middle]!;
}

function runSample(nodes: readonly Node[], widths: readonly number[]): BenchmarkSample {
  const predictiveStart = performance.now();
  const prepared = prepare(nodes);
  const prepareDone = performance.now();
  for (const width of widths) {
    computeLayout(prepared, {
      width,
      type: "masonry",
      gap: 10,
      padding: 12,
      minColumnWidth: 220,
    });
  }
  const predictiveDone = performance.now();

  const naiveStart = performance.now();
  for (const width of widths) {
    const naivePrepared = prepare(nodes);
    computeLayout(naivePrepared, {
      width,
      type: "masonry",
      gap: 10,
      padding: 12,
      minColumnWidth: 220,
    });
  }
  const naiveDone = performance.now();

  return {
    prepareMs: prepareDone - predictiveStart,
    predictiveLayoutManyMs: predictiveDone - prepareDone,
    predictiveTotalMs: predictiveDone - predictiveStart,
    naiveTotalMs: naiveDone - naiveStart,
  };
}

function assertThresholds(result: BenchmarkResult): string[] {
  const failures: string[] = [];

  if (result.speedupMedian < result.thresholds.minSpeedup) {
    failures.push(
      `speedup ${result.speedupMedian.toFixed(2)}x is below required ${result.thresholds.minSpeedup.toFixed(2)}x`
    );
  }

  if (result.predictiveTotalMsMedian > result.thresholds.maxPredictiveTotalMs) {
    failures.push(
      `predictive total ${result.predictiveTotalMsMedian.toFixed(2)}ms exceeds max ${result.thresholds.maxPredictiveTotalMs.toFixed(2)}ms`
    );
  }

  if (result.prepareMsMedian > result.thresholds.maxPrepareMs) {
    failures.push(
      `prepare phase ${result.prepareMsMedian.toFixed(2)}ms exceeds max ${result.thresholds.maxPrepareMs.toFixed(2)}ms`
    );
  }

  return failures;
}

function main(): number {
  const args = parseArgs(process.argv.slice(2));
  const rootDir = path.resolve(__dirname, "..", "..", "..");
  const baselinePath = path.resolve(rootDir, "bench", "baseline.json");
  const defaultOutputPath = path.resolve(rootDir, "bench", "results", "latest.json");
  const outputPath = args.outputPath ? path.resolve(rootDir, args.outputPath) : defaultOutputPath;

  const baseline = JSON.parse(readFileSync(baselinePath, "utf8")) as BenchmarkBaseline;
  const nodes = buildStressNodes(baseline.datasetSize);
  const widths = buildWidths(baseline.widthCount);

  for (let run = 0; run < baseline.warmupRuns; run += 1) {
    runSample(nodes, widths);
  }

  const samples: BenchmarkSample[] = [];
  for (let run = 0; run < baseline.sampleRuns; run += 1) {
    samples.push(runSample(nodes, widths));
  }

  const prepareMsMedian = median(samples.map((sample) => sample.prepareMs));
  const predictiveLayoutManyMsMedian = median(samples.map((sample) => sample.predictiveLayoutManyMs));
  const predictiveTotalMsMedian = median(samples.map((sample) => sample.predictiveTotalMs));
  const naiveTotalMsMedian = median(samples.map((sample) => sample.naiveTotalMs));
  const speedupMedian = naiveTotalMsMedian / Math.max(0.001, predictiveTotalMsMedian);

  const result: BenchmarkResult = {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    timestamp: new Date().toISOString(),
    baselineVersion: baseline.version,
    datasetSize: baseline.datasetSize,
    widthCount: baseline.widthCount,
    warmupRuns: baseline.warmupRuns,
    sampleRuns: baseline.sampleRuns,
    prepareMsMedian,
    predictiveLayoutManyMsMedian,
    predictiveTotalMsMedian,
    naiveTotalMsMedian,
    speedupMedian,
    thresholds: baseline.thresholds,
  };

  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");

  console.log("[benchmark] output:", path.relative(rootDir, outputPath));
  console.table({
    prepareMsMedian: result.prepareMsMedian.toFixed(2),
    predictiveLayoutManyMsMedian: result.predictiveLayoutManyMsMedian.toFixed(2),
    predictiveTotalMsMedian: result.predictiveTotalMsMedian.toFixed(2),
    naiveTotalMsMedian: result.naiveTotalMsMedian.toFixed(2),
    speedupMedian: `${result.speedupMedian.toFixed(2)}x`,
  });

  if (!args.ci) {
    return 0;
  }

  const failures = assertThresholds(result);
  if (failures.length === 0) {
    console.log("[benchmark] CI thresholds: OK");
    return 0;
  }

  console.error("[benchmark] CI thresholds failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  return 1;
}

process.exitCode = main();
