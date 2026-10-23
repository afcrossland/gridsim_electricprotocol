import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import ThemedRoot from "../../shared/components/ThemedRoot";
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
