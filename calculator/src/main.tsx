import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import ThemedRoot from "../../shared/components/ThemedRoot";
import { loadCalculatorData } from "./data/calculatorData";
import "../../shared/index.css";

/**
 * lib/demandProfile.ts reads the calculator's data as it loads (see
 * data/calculatorData.ts), so App is imported only once that data is
 * settled: from the database when this build asks for it
 * (VITE_CALCULATOR_API, dev only), otherwise the bundled JSON straight away.
 * Nothing above this line may import it.
 */
async function start() {
  if (import.meta.env.VITE_CALCULATOR_API) await loadCalculatorData();
  const { default: App } = await import("./App");

  /**
   * Same shape as the sibling apps' own ThemedApp - no persisted store of its
   * own, but `mode` now reads/writes the cross-app `DARK_MODE_KEY` (see
   * shared/lib/darkMode.ts) rather than plain unpersisted useState, so a
   * choice made here carries over to the other two apps too.
   */
  function ThemedApp() {
    return <ThemedRoot>{(mode, setMode) => <App mode={mode} setMode={setMode} />}</ThemedRoot>;
  }

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ThemedApp />
    </StrictMode>,
  );
}

void start();
