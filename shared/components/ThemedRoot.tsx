import { useMemo, useState, type ReactNode } from "react";
import { ThemeProvider } from "@mui/material/styles";
import type { PaletteMode } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

import { getStoredMode, setStoredMode } from "../lib/darkMode";
import { getTheme } from "../theme/mui-theme";

/**
 * The root of an app with no store of its own: light or dark mode held in state, read from and written to the cross-app
 * `DARK_MODE_KEY` (see shared/lib/darkMode.ts) so a choice made in one app carries over to the others, with the GSC MUI
 * theme and CssBaseline around the app. The Deployment Explorer and the Solar Homes Calculator had identical copies of this
 * in their `main.tsx`. (The Policy Explorer keeps its mode in its store, so it has its own.)
 */
export default function ThemedRoot({ children }: { children: (mode: PaletteMode, setMode: (mode: PaletteMode) => void) => ReactNode }) {
  const [mode, setModeState] = useState<PaletteMode>(() => getStoredMode() ?? "light");
  const setMode = (m: PaletteMode) => {
    setStoredMode(m);
    setModeState(m);
  };
  const theme = useMemo(() => getTheme(mode), [mode]);
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children(mode, setMode)}
    </ThemeProvider>
  );
}
