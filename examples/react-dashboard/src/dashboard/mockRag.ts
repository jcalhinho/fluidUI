import type { SourceDocumentHit, SourceDocumentKind } from "./spec";

interface RagDocument {
  id: string;
  kind: SourceDocumentKind;
  title: string;
  content: string;
}

const RAG_CORPUS: RagDocument[] = [
  {
    id: "doc-finance-q1",
    kind: "pdf",
    title: "Q1 Board Finance Pack",
    content:
      "Monthly recurring revenue reached 148k EUR. Churn moved from 2.4 to 2.1 percent. Expansion revenue increased in enterprise tier."
  },
  {
    id: "doc-product-funnel",
    kind: "csv",
    title: "Acquisition Funnel Export",
    content:
      "Visitors 118200, leads 54800, trials 16400, paid 4300. Activation improved after onboarding redesign in week 5."
  },
  {
    id: "doc-web-analytics",
    kind: "xlsx",
    title: "Web Analytics Conversion Workbook",
    content:
      "Top converting pages: /pricing, /signup, /checkout. Conversion trend positive on mobile and mixed on desktop."
  },
  {
    id: "doc-incidents",
    kind: "json",
    title: "Ops Incident Feed",
    content:
      "Critical latency alerts observed on checkout API. Monitoring status active on notification worker and warehouse sync pipeline."
  },
  {
    id: "doc-csm-notes",
    kind: "docx",
    title: "Customer Success Notes",
    content:
      "NPS stabilized after support response-time improvements. Retention risk concentrated in self-serve customers with low activation."
  },
  {
    id: "doc-roadmap",
    kind: "md",
    title: "Product Roadmap Summary",
    content:
      "Focus areas: activation, conversion uplift experiments, plan comparison insights, and proactive risk alerting for growth teams."
  }
];

export function retrieveRelevantDocuments(query: string, limit = 4): SourceDocumentHit[] {
  const queryTokens = tokenize(query);
  const ranked = RAG_CORPUS.map((doc) => {
    const contentTokens = new Set(tokenize(`${doc.title} ${doc.content}`));
    const overlap = countOverlap(queryTokens, contentTokens);
    const densityBoost = queryTokens.length === 0 ? 0 : overlap / queryTokens.length;
    const score = overlap * 3 + densityBoost;

    return {
      id: doc.id,
      kind: doc.kind,
      title: doc.title,
      excerpt: buildExcerpt(doc.content),
      score
    } satisfies SourceDocumentHit;
  })
    .sort((a, b) => b.score - a.score);

  const relevant = ranked.filter((item) => item.score > 0).slice(0, limit);
  if (relevant.length > 0) {
    return relevant;
  }

  return ranked.slice(0, limit);
}

function countOverlap(a: readonly string[], b: ReadonlySet<string>): number {
  let overlap = 0;
  for (const token of a) {
    if (b.has(token)) {
      overlap += 1;
    }
  }
  return overlap;
}

function tokenize(value: string): string[] {
  const normalized = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  if (normalized.length === 0) {
    return [];
  }

  return normalized
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

function buildExcerpt(content: string): string {
  const clean = content.trim().replace(/\s+/g, " ");
  if (clean.length <= 120) {
    return clean;
  }
  return `${clean.slice(0, 117)}...`;
}
