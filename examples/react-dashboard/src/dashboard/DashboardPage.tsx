import { type LayoutType } from "@fluidui/core";
import { useMemo, useState } from "react";
import { DashboardCanvas } from "./DashboardCanvas";
import { type BuilderDensity, buildDemoNodes, type WidgetCounts } from "./componentFactory";

interface TemplateFamily {
  id: string;
  label: string;
  description: string;
  baseCounts: WidgetCounts;
}

interface SkeletonTemplate {
  id: string;
  label: string;
  description: string;
  layout: LayoutType;
  density: BuilderDensity;
  seed: number;
  counts: WidgetCounts;
}

const LAYOUT_ROTATION: readonly LayoutType[] = ["masonry", "grid", "vertical"];
const VARIANT_LABELS = ["Alpha", "Beta", "Gamma", "Delta", "Omega"] as const;

const TEMPLATE_FAMILIES: readonly TemplateFamily[] = [
  {
    id: "executive",
    label: "Executive",
    description: "Executive overview dashboard.",
    baseCounts: { bignumber: 1, kpi: 2, line: 1, summary: 1, dropcap: 1 },
  },
  {
    id: "operations",
    label: "Operations",
    description: "Incident and alert supervision.",
    baseCounts: { alerts: 2, incidents: 2, activity: 2, line: 1, table: 1, dropcap: 1 },
  },
  {
    id: "acquisition",
    label: "Acquisition",
    description: "Funnel, conversion, and segments.",
    baseCounts: { funnel: 1, line: 2, table: 1, summary: 1, dropcap: 1 },
  },
  {
    id: "performance",
    label: "Performance",
    description: "Capacity trend and quality indicators.",
    baseCounts: { bignumber: 2, kpi: 2, table: 2, summary: 1, dropcap: 1 },
  },
  {
    id: "product",
    label: "Product",
    description: "Product story and KPI signals.",
    baseCounts: { kpi: 2, line: 2, activity: 1, summary: 2, dropcap: 2 },
  },
  {
    id: "reliability",
    label: "Reliability",
    description: "Platform stability and load.",
    baseCounts: { alerts: 2, incidents: 2, line: 2, table: 1, summary: 2, dropcap: 1 },
  },
];

function cloneCounts(counts: WidgetCounts): WidgetCounts {
  return Object.fromEntries(Object.entries(counts).map(([key, value]) => [key, Number(value) || 0]));
}

function scaleCountsForVariant(baseCounts: WidgetCounts, variantIndex: number): WidgetCounts {
  const factor = variantIndex >= 4 ? 2 : variantIndex >= 2 ? 1.5 : 1;
  const counts = cloneCounts(baseCounts);
  for (const [widgetType, value] of Object.entries(counts)) {
    let next = Math.max(1, Math.round(value * factor));
    if (variantIndex >= 3 && (widgetType === "summary" || widgetType === "dropcap")) {
      next += 1;
    }
    counts[widgetType] = next;
  }
  return counts;
}

function buildSkeletonTemplates(): SkeletonTemplate[] {
  const templates: SkeletonTemplate[] = [];
  TEMPLATE_FAMILIES.forEach((family, familyIndex) => {
    VARIANT_LABELS.forEach((variantLabel, variantIndex) => {
      const layout = LAYOUT_ROTATION[(familyIndex + variantIndex) % LAYOUT_ROTATION.length] ?? "masonry";
      const density: BuilderDensity = variantIndex >= 3 ? "stress" : "showcase";
      const counts = scaleCountsForVariant(family.baseCounts, variantIndex);
      templates.push({
        id: `${family.id}-${variantLabel.toLowerCase()}`,
        label: `${family.label} ${variantLabel}`,
        description: `${family.description} Variant ${variantLabel}.`,
        layout,
        density,
        seed: 20261100 + familyIndex * 100 + variantIndex * 17,
        counts,
      });
    });
  });
  return templates;
}

const SKELETONS: readonly SkeletonTemplate[] = buildSkeletonTemplates();
const DEFAULT_SKELETON: SkeletonTemplate =
  SKELETONS.find(
    (template) => template.layout === "grid" && template.density === "stress",
  ) ?? SKELETONS[0]!;

export function DashboardPage(): JSX.Element {
  const [activeSkeleton, setActiveSkeleton] = useState<string>(DEFAULT_SKELETON.id);
  const [layoutType, setLayoutType] = useState<LayoutType>(DEFAULT_SKELETON.layout);
  const [density, setDensity] = useState<BuilderDensity>(DEFAULT_SKELETON.density);
  const [seed, setSeed] = useState<number>(DEFAULT_SKELETON.seed);
  const [widgetCounts, setWidgetCounts] = useState<WidgetCounts>(cloneCounts(DEFAULT_SKELETON.counts));
  const [isBuilderPanelOpen, setIsBuilderPanelOpen] = useState<boolean>(false);

  const nodes = useMemo(
    () =>
      buildDemoNodes({
        counts: widgetCounts,
        density,
        seed,
      }),
    [widgetCounts, density, seed]
  );

  const applySkeleton = (template: SkeletonTemplate): void => {
    setActiveSkeleton(template.id);
    setLayoutType(template.layout);
    setDensity(template.density);
    setSeed(template.seed);
    setWidgetCounts(cloneCounts(template.counts));
  };

  const randomizeSeed = (): void => {
    setActiveSkeleton("custom");
    setSeed(Math.floor(Date.now() % 1_000_000_000));
  };
  const activeTemplateValue = SKELETONS.some((template) => template.id === activeSkeleton) ? activeSkeleton : "custom";

  return (
    <section className="page-content page-split">
      <header className="builder-header-bar">
        <div className="builder-header-title">
          <h2>Engine Builder</h2>
          <button
            type="button"
            className={`builder-mobile-toggle ${isBuilderPanelOpen ? "is-open" : ""}`}
            onClick={() => setIsBuilderPanelOpen((previous) => !previous)}
            aria-expanded={isBuilderPanelOpen}
            aria-controls="builder-controls"
          >
            {isBuilderPanelOpen ? "Close" : "Open"}
          </button>
        </div>

        <div
          id="builder-controls"
          className={`builder-header-controls ${isBuilderPanelOpen ? "is-open" : ""}`}
        >
          <div className="builder-control-group builder-control-group--template">
            <label htmlFor="builder-template-select" className="builder-template-select-label">
              Template ({SKELETONS.length})
            </label>
            <select
              id="builder-template-select"
              className="builder-template-select"
              value={activeTemplateValue}
              onChange={(event) => {
                const selected = SKELETONS.find((template) => template.id === event.target.value);
                if (selected) applySkeleton(selected);
              }}
            >
              <option value="custom">Custom</option>
              {SKELETONS.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.label} · {template.layout}
                </option>
              ))}
            </select>
          </div>

          <div className="builder-control-group">
            <span className="builder-template-select-label">Layout</span>
            <div className="builder-buttons-row">
              {(["masonry", "grid", "vertical"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`builder-chip ${layoutType === option ? "is-active" : ""}`}
                  onClick={() => {
                    setActiveSkeleton("custom");
                    setLayoutType(option);
                  }}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="builder-control-group">
            <span className="builder-template-select-label">Density</span>
            <div className="builder-buttons-row">
              {(["showcase", "stress"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`builder-chip ${density === mode ? "is-active" : ""}`}
                  onClick={() => {
                    setActiveSkeleton("custom");
                    setDensity(mode);
                  }}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <div className="builder-control-group builder-control-group--seed">
            <span className="builder-template-select-label">Seed</span>
            <div className="builder-seed-row">
              <input
                type="number"
                value={seed}
                onChange={(event) => {
                  setActiveSkeleton("custom");
                  setSeed(Number(event.target.value) || 0);
                }}
              />
              <button type="button" className="builder-chip" onClick={randomizeSeed}>
                Randomize
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="result-column">
        <DashboardCanvas nodes={nodes} layoutType={layoutType} />
      </div>
    </section>
  );
}
