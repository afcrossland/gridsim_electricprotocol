import { StrictMode, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@mui/material/styles";
import type { PaletteMode } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

import App from "./App";
import { getTheme } from "../../shared/theme/mui-theme";
import { getStoredMode, setStoredMode } from "../../shared/lib/darkMode";
import "../../shared/index.css";

/**
 * Same shape as the sibling apps' own ThemedApp - no persisted store of its
 * own, but `mode` now reads/writes the cross-app `DARK_MODE_KEY` (see
 * shared/lib/darkMode.ts) rather than plain unpersisted useState, so a
 * choice made here carries over to the other two apps too.
 */
function ThemedApp() {
  const [mode, setModeState] = useState<PaletteMode>(() => getStoredMode() ?? "light");
  const setMode = (m: PaletteMode) => {
    setStoredMode(m);
    setModeState(m);
  };
  const theme = useMemo(() => getTheme(mode), [mode]);
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App mode={mode} setMode={setMode} />
    </ThemeProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemedApp />
  </StrictMode>,
);
