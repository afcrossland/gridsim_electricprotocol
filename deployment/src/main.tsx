import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import ThemedRoot from "../../shared/components/ThemedRoot";
import { loadDeploymentData } from "./data/deploymentData";
import i18n, { LANGUAGE_KEY, SUPPORTED_LANGUAGES } from "./i18n";
import "../../shared/index.css";

// No persisted store in this app (see ThemedApp's own comment below) - a
// returning visitor's language choice lives in localStorage instead, same
// "plain flag" precedent as App.tsx's own TOUR_SEEN_KEY. Read once, before
// the app renders, rather than on every load of LanguageSwitcher.tsx.
const savedLanguage = localStorage.getItem(LANGUAGE_KEY);
if (savedLanguage && (SUPPORTED_LANGUAGES as readonly string[]).includes(savedLanguage)) {
  i18n.changeLanguage(savedLanguage);
}

/**
 * The app's modules build lookup tables from the Ember and population data
 * as they load (see data/deploymentData.ts), so App is imported only once
 * that data is settled: from the database when this build asks for it
 * (VITE_DEPLOYMENT_API, dev only), otherwise the bundled JSON. Nothing above
 * this line may import them.
 */
async function start() {
  await loadDeploymentData();
  const { default: App } = await import("./App");

  /**
   * Same shape as ep_policymap's ThemedApp in main.tsx, but with plain
   * `useState` instead of a Zustand store. `mode` now reads/writes the
   * cross-app `DARK_MODE_KEY` (see shared/lib/darkMode.ts) rather than
   * resetting to light on every load, so a choice made here carries over to
   * the other two apps too.
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
