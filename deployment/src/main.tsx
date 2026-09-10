import { StrictMode, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@mui/material/styles";
import type { PaletteMode } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

import App from "./App";
import { getTheme } from "./mui-theme";
import "./index.css";

/**
 * Same shape as ep_policymap's ThemedApp in main.tsx, but with plain
 * `useState` instead of a Zustand store - this app has no persisted store
 * yet, and the toggle doesn't need to survive a reload for a demo.
 */
function ThemedApp() {
  const [mode, setMode] = useState<PaletteMode>("light");
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
