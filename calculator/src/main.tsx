import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import ThemedRoot from "../../shared/components/ThemedRoot";
import "../../shared/index.css";

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
