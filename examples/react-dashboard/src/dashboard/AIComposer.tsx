import { useEffect, useRef, useState } from "react";
import { generateDashboardFromPrompt, getDefaultPrompt } from "./mockAgent";
import type { DashboardGenerationResult } from "./spec";

interface AIComposerProps {
  onGenerated: (result: DashboardGenerationResult) => void;
}

type ComposerState = "idle" | "running" | "error";

type ChatRole = "assistant" | "user";

interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
}

interface DemoPrompt {
  label: string;
  prompt: string;
}

const INTRO_MESSAGE =
  "Salut, je suis ton assistant dashboard. Je peux transformer une demande métier en dashboard complet (KPI, tendances, comparatifs, alertes, top pages), avec un layout automatique (masonry, grid ou vertical). Tu peux me demander: '8 KPI SaaS', 'Plan A vs Plan B', 'trend conversion', 'risques/incidents', ou combiner tout ça en une seule phrase.";

const DEMO_PROMPTS: readonly DemoPrompt[] = [
  {
    label: "SaaS 8 KPI",
    prompt:
      "Je veux un dashboard SaaS avec 8 KPI, MRR, churn, activation, comparatif Plan A vs Plan B, trend conversion, alertes et top pages."
  },
  {
    label: "Growth + Risks",
    prompt:
      "Build a growth dashboard with revenue trend, conversion trend, top pages and incident risks."
  },
  {
    label: "Vertical NPS",
    prompt:
      "Create a vertical layout with NPS, activation, comparison mobile vs desktop and summary."
  }
];

export function AIComposer({ onGenerated }: AIComposerProps): JSX.Element {
  const [prompt, setPrompt] = useState<string>("");
  const [state, setState] = useState<ComposerState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "intro", role: "assistant", text: "" }
  ]);
  const threadRef = useRef<HTMLDivElement>(null);
  const messageCounterRef = useRef<number>(0);

  const canGenerate = prompt.trim().length > 0 && state !== "running";

  useEffect(() => {
    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      const nextText = INTRO_MESSAGE.slice(0, index);
      setMessages((previous) =>
        previous.map((message) => {
          if (message.id !== "intro") {
            return message;
          }
          return { ...message, text: nextText };
        })
      );

      if (index >= INTRO_MESSAGE.length) {
        window.clearInterval(timer);
      }
    }, 14);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const thread = threadRef.current;
    if (!thread) {
      return;
    }
    thread.scrollTop = thread.scrollHeight;
  }, [messages]);

  const runGeneration = async (nextPrompt: string): Promise<void> => {
    const trimmedPrompt = nextPrompt.trim();
    if (trimmedPrompt.length === 0 || state === "running") {
      return;
    }

    const userMessageId = `user-${messageCounterRef.current += 1}`;
    const assistantMessageId = `assistant-${messageCounterRef.current += 1}`;

    setMessages((previous) => [
      ...previous,
      { id: userMessageId, role: "user", text: trimmedPrompt },
      { id: assistantMessageId, role: "assistant", text: "Je prépare ton dashboard..." }
    ]);
    setPrompt("");

    try {
      setState("running");
      setError(null);

      const result = await generateDashboardFromPrompt(trimmedPrompt, {
        providerMode: "auto",
        timeoutMs: 120000,
        allowFallbackOnError: true
      });

      onGenerated(result);
      setMessages((previous) =>
        previous.map((message) => {
          if (message.id !== assistantMessageId) {
            return message;
          }

          const generatedSummary =
            `Dashboard généré: ${result.spec.widgets.length} widgets, layout ${result.spec.layoutType}. ` +
            `Provider: ${result.provider}.`;

          return {
            ...message,
            text: generatedSummary
          };
        })
      );
      setState("idle");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setError(message);
      setMessages((previous) =>
        previous.map((entry) => {
          if (entry.id !== assistantMessageId) {
            return entry;
          }
          return {
            ...entry,
            text: `Je n'ai pas pu générer le dashboard: ${message}`
          };
        })
      );
      setState("error");
    }
  };

  return (
    <section className="chatbot-panel">
      <header className="chatbot-header">
        <h2>Dashboard Chatbot</h2>
        <p>Décris le dashboard voulu, je génère le rendu automatiquement.</p>
      </header>

      <div className="chatbot-demos">
        {DEMO_PROMPTS.map((demo) => (
          <button
            key={demo.label}
            type="button"
            className="demo-chip"
            onClick={() => {
              void runGeneration(demo.prompt);
            }}
            disabled={state === "running"}
          >
            {demo.label}
          </button>
        ))}
      </div>

      <div ref={threadRef} className="chatbot-thread" aria-live="polite">
        {messages.map((message) => (
          <article key={message.id} className={`chat-message chat-${message.role}`}>
            <p>{message.text}</p>
          </article>
        ))}
      </div>

      <form
        className="chatbot-input"
        onSubmit={(event) => {
          event.preventDefault();
          if (canGenerate) {
            void runGeneration(prompt);
          }
        }}
      >
        <input
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder={`Ex: ${getDefaultPrompt()}`}
          type="text"
        />

        <button type="submit" disabled={!canGenerate}>
          {state === "running" ? "Generation..." : "Envoyer"}
        </button>
      </form>

      {error ? <p className="chatbot-error">Generation failed: {error}</p> : null}
    </section>
  );
}
