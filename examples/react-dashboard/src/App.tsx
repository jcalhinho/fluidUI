import { useEffect, useState } from "react";
import { AboutPage } from "./about/AboutPage";
import { DashboardPage } from "./dashboard/DashboardPage";

type AppView = "builder" | "about";

function resolveViewFromHash(hashValue: string): AppView {
  const normalizedHash = hashValue.trim().toLowerCase();
  return normalizedHash.startsWith("#about") ? "about" : "builder";
}

export function App(): JSX.Element {
  const [view, setView] = useState<AppView>(() => {
    if (typeof window === "undefined") return "builder";
    return resolveViewFromHash(window.location.hash);
  });

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleHashChange = (): void => {
      setView(resolveViewFromHash(window.location.hash));
    };

    window.addEventListener("hashchange", handleHashChange);
    handleHashChange();
    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  const switchToView = (nextView: AppView): void => {
    setView(nextView);
    if (typeof window === "undefined") return;

    const nextHash = nextView === "about" ? "#about" : "#builder";
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    }
  };

  return (
    <main className="main-content">
      <section className="demo-shell">
        <header className="demo-topbar">
          <h1>fluidUI React Example</h1>
          <nav className="demo-topbar-nav" aria-label="Example sections">
            <button
              type="button"
              className={`demo-tab ${view === "builder" ? "is-active" : ""}`}
              onClick={() => switchToView("builder")}
            >
              Builder
            </button>
            <button
              type="button"
              className={`demo-tab ${view === "about" ? "is-active" : ""}`}
              onClick={() => switchToView("about")}
            >
              About
            </button>
          </nav>
        </header>
        <section className={`demo-stage ${view === "about" ? "is-scrollable" : ""}`}>
          {view === "about" ? <AboutPage /> : <DashboardPage />}
        </section>
      </section>
    </main>
  );
}
