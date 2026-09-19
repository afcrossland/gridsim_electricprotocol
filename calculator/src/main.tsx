import { StrictMode, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@mui/material/styles";
import type { PaletteMode } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

import App from "./App";
import { getTheme } from "../../shared/theme/mui-theme";
import "../../shared/index.css";

/** Same shape as the sibling apps' own ThemedApp - plain useState, no persisted store. */
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
