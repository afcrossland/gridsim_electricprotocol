import { StrictMode, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

import { getTheme } from "../shared/theme/mui-theme";
import { loadPolicyData } from "./data/policyData";
import { restoreEditorSession } from "./lib/editorAuth";
import "./i18n";
import "../shared/index.css";

/**
 * The app's modules build lookup tables from the policy data as they load (see
 * data/policyData.ts), so they are imported only once the data is settled:
 * fetched from the policy database when this build asks for it
 * (VITE_POLICY_API, dev only), otherwise the bundled JSON straight away.
 * Nothing above this line may import them.
 */
async function start() {
  if (import.meta.env.VITE_POLICY_API) await loadPolicyData();
  restoreEditorSession();

  const [{ default: App }, { useProtocolStore }] = await Promise.all([
    import("./App"),
    import("./stores/protocolStore"),
  ]);

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
}

void start();
