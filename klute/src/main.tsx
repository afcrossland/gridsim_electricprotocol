import { StrictMode, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@mui/material/styles";
import type { PaletteMode } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

import App from "./App";
import { getTheme } from "../../shared/theme/mui-theme";
import { getStoredMode, setStoredMode } from "../../shared/lib/darkMode";
import "../../shared/index.css";

// Same shape as deployment/src/main.tsx: plain useState, with the choice stored under the
// cross-app dark-mode key so it carries over to the other apps.
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
