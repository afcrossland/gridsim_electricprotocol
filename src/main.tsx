import { StrictMode, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

import App from "./App";
import { getTheme } from "./mui-theme";
import { useProtocolStore } from "./stores/protocolStore";
import "./index.css";

/**
 * Rebuilds the theme only when `mode` actually changes - getTheme() is not
 * cheap (createTheme() over the whole palette/component-overrides object),
 * so this can't just be called inline in the render below.
 */
function ThemedApp() {
  const mode = useProtocolStore((s) => s.mode);
  const theme = useMemo(() => getTheme(mode), [mode]);
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemedApp />
  </StrictMode>,
);
