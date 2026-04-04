import { useState } from "react";
import { AIComposer } from "./AIComposer";
import { DashboardCanvas } from "./DashboardCanvas";
import type { DashboardGenerationResult } from "./spec";

export function DashboardPage(): JSX.Element {
  const [generated, setGenerated] = useState<DashboardGenerationResult | null>(null);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(true);

  return (
    <section className="page-content page-split">
      <aside className={`chat-column ${isChatOpen ? "is-open" : "is-collapsed"}`}>
        <button
          type="button"
          className="chat-toggle"
          onClick={() => setIsChatOpen((previous) => !previous)}
          aria-expanded={isChatOpen}
          aria-label={isChatOpen ? "Replier le chatbot" : "Ouvrir le chatbot"}
        >
          {isChatOpen ? "←" : "→"}
        </button>

        {isChatOpen ? <AIComposer onGenerated={setGenerated} /> : null}
      </aside>

      <div className="result-column">
        <DashboardCanvas nodes={generated?.nodes ?? []} layoutType={generated?.spec.layoutType} />
      </div>
    </section>
  );
}
