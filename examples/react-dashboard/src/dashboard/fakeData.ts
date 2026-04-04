import type { Severity, Tone } from "./types";

interface SeededRandom {
  next(): number;
  int(min: number, max: number): number;
  pick<T>(values: readonly T[]): T;
}

function createRng(seed: number): SeededRandom {
  let state = Math.abs(Math.floor(seed)) || 1;

  const next = (): number => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };

  return {
    next,
    int(min: number, max: number): number {
      return Math.floor(next() * (max - min + 1)) + min;
    },
    pick<T>(values: readonly T[]): T {
      return values[this.int(0, values.length - 1)]!;
    }
  };
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0
  }).format(value);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatDelta(value: number, unit = "%"): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}${unit}`;
}

function toneFromValue(value: number): Tone {
  if (value > 0.2) {
    return "positive";
  }
  if (value < -0.2) {
    return "negative";
  }
  return "neutral";
}

function makeTrend(rng: SeededRandom, points: number, base: number, volatility: number): number[] {
  const values: number[] = [];
  let current = base;
  for (let i = 0; i < points; i += 1) {
    current += (rng.next() - 0.48) * volatility;
    values.push(Math.max(1, Math.round(current)));
  }
  return values;
}

function createAlerts(rng: SeededRandom) {
  const messages = [
    "Latency above SLA on checkout API",
    "Background jobs queue saturation",
    "Spike in failed payment intents",
    "Inventory sync retries increasing",
    "Error burst on mobile session init"
  ] as const;
  const severities: Severity[] = ["critical", "high", "medium", "low"];

  return Array.from({ length: 6 }, (_, index) => ({
    id: `alert-${index + 1}`,
    severity: rng.pick(severities),
    message: rng.pick(messages),
    minutesAgo: rng.int(1, 65)
  }));
}

function createIncidents(rng: SeededRandom) {
  const services = [
    "Checkout",
    "Subscriptions",
    "Warehouse sync",
    "Notification worker",
    "Analytics pipeline"
  ] as const;
  const statuses = ["investigating", "monitoring", "resolved"] as const;
  const impacts = ["critical", "major", "minor"] as const;

  return Array.from({ length: 5 }, (_, index) => ({
    id: `incident-${index + 1}`,
    service: rng.pick(services),
    status: rng.pick(statuses),
    impact: rng.pick(impacts)
  }));
}

function createActivities(rng: SeededRandom) {
  const actors = ["Mia", "Luca", "Noah", "Emma", "Sofia", "Liam"] as const;
  const actions = ["updated", "created", "resolved", "reviewed", "deployed"] as const;
  const targets = [
    "pricing experiment",
    "alert policy",
    "retention dashboard",
    "incident runbook",
    "pipeline job"
  ] as const;

  return Array.from({ length: 10 }, (_, index) => ({
    id: `activity-${index + 1}`,
    actor: rng.pick(actors),
    action: rng.pick(actions),
    target: rng.pick(targets),
    time: `${rng.int(1, 14)}m ago`
  }));
}

function createTopPages(rng: SeededRandom) {
  const pages = [
    "/pricing",
    "/signup",
    "/checkout",
    "/features/ai-assistant",
    "/blog/release-notes",
    "/docs/getting-started"
  ] as const;

  return pages.map((page) => {
    const sessions = rng.int(1200, 9200);
    const conversion = rng.int(9, 58) / 10;
    const revenue = sessions * (conversion / 100) * rng.int(45, 210);

    return {
      page,
      sessions: String(sessions),
      conversion: formatPercent(conversion),
      revenue: formatCurrency(revenue)
    };
  });
}

function createMicroMetrics(rng: SeededRandom) {
  const labels = [
    "Email CTR",
    "CAC",
    "AOV",
    "LTV",
    "Refund rate",
    "Trial→Paid",
    "Activation",
    "Uptime",
    "API p95",
    "Queue lag"
  ] as const;

  return Array.from({ length: 220 }, (_, index) => {
    const label = `${rng.pick(labels)} ${index + 1}`;
    const delta = (rng.next() - 0.48) * 6;
    const sparkline = makeTrend(rng, 10, rng.int(20, 90), rng.int(4, 16));
    const value = sparkline[sparkline.length - 1] ?? 0;

    return {
      id: `micro-${index + 1}`,
      label,
      value: String(value),
      delta: formatDelta(delta),
      tone: toneFromValue(delta),
      sparkline
    };
  });
}

export interface FakeDashboardData {
  kpis: Array<{
    id: string;
    title: string;
    subtitle: string;
    value: string;
    delta: string;
    tone: Tone;
    sparkline: number[];
  }>;
  revenueSeries: number[];
  conversionSeries: number[];
  labels: string[];
  funnel: Array<{ label: string; value: number }>;
  alerts: ReturnType<typeof createAlerts>;
  incidents: ReturnType<typeof createIncidents>;
  activities: ReturnType<typeof createActivities>;
  topPages: ReturnType<typeof createTopPages>;
  summaryText: string;
  microMetrics: ReturnType<typeof createMicroMetrics>;
}

export function generateFakeDashboardData(seed: number): FakeDashboardData {
  const rng = createRng(seed);

  const revenueBase = rng.int(32000, 58000);
  const churn = rng.int(14, 35) / 10;
  const nps = rng.int(41, 67);
  const activation = rng.int(58, 84);

  const revenueDelta = (rng.next() - 0.35) * 18;
  const churnDelta = (rng.next() - 0.62) * 2;
  const npsDelta = (rng.next() - 0.48) * 6;
  const activationDelta = (rng.next() - 0.4) * 10;

  const labels = Array.from({ length: 16 }, (_, index) => `W${index + 1}`);
  const revenueSeries = makeTrend(rng, 16, revenueBase, 2200);
  const conversionSeries = makeTrend(rng, 16, rng.int(18, 42), 4);

  const kpis = [
    {
      id: "kpi-revenue",
      title: "Monthly Recurring Revenue",
      subtitle: "vs previous month",
      value: formatCurrency(revenueBase),
      delta: formatDelta(revenueDelta),
      tone: toneFromValue(revenueDelta),
      sparkline: makeTrend(rng, 14, 58, 12)
    },
    {
      id: "kpi-churn",
      title: "Customer Churn",
      subtitle: "monthly",
      value: formatPercent(churn),
      delta: formatDelta(churnDelta),
      tone: toneFromValue(-churnDelta),
      sparkline: makeTrend(rng, 14, 44, 10)
    },
    {
      id: "kpi-nps",
      title: "Net Promoter Score",
      subtitle: "customer sentiment",
      value: String(nps),
      delta: formatDelta(npsDelta, ""),
      tone: toneFromValue(npsDelta),
      sparkline: makeTrend(rng, 14, 52, 8)
    },
    {
      id: "kpi-activation",
      title: "Activation Rate",
      subtitle: "new users",
      value: formatPercent(activation),
      delta: formatDelta(activationDelta),
      tone: toneFromValue(activationDelta),
      sparkline: makeTrend(rng, 14, 48, 11)
    }
  ];

  const visitors = rng.int(90000, 130000);
  const leadRate = rng.int(40, 55) / 100;
  const trialRate = rng.int(23, 37) / 100;
  const paidRate = rng.int(19, 34) / 100;

  const funnel = [
    { label: "Visitors", value: visitors },
    { label: "Leads", value: Math.round(visitors * leadRate) },
    { label: "Trials", value: Math.round(visitors * leadRate * trialRate) },
    { label: "Paid", value: Math.round(visitors * leadRate * trialRate * paidRate) }
  ];

  const alerts = createAlerts(rng);
  const incidents = createIncidents(rng);
  const activities = createActivities(rng);
  const topPages = createTopPages(rng);
  const microMetrics = createMicroMetrics(rng);

  const summaryText = [
    `Revenue momentum is ${revenueDelta >= 0 ? "up" : "down"} ${Math.abs(revenueDelta).toFixed(1)}% month over month.`,
    `Churn is holding at ${formatPercent(churn)} with ${alerts.length} active alerts monitored by ops.`,
    `The current funnel converts ${formatPercent((funnel[3]!.value / funnel[0]!.value) * 100)} from visitor to paid.`
  ].join(" ");

  return {
    kpis,
    revenueSeries,
    conversionSeries,
    labels,
    funnel,
    alerts,
    incidents,
    activities,
    topPages,
    summaryText,
    microMetrics
  };
}
