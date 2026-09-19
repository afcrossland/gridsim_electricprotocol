import type { ReactNode } from "react";
import { AppBar, Box, IconButton, Toolbar, Tooltip, Typography } from "@mui/material";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import type { PaletteMode } from "@mui/material/styles";

interface Props {
  title: string;
  /** The "by GSC · tagline" subtitle line - a ReactNode (not a plain string) since every app renders the tagline itself in a different colour/style span. */
  byline: ReactNode;
  mode: PaletteMode;
  setMode: (mode: PaletteMode) => void;
  onLogoClick: () => void;
  /** App-specific nav links (e.g. Tour/Help/Admin), rendered between the flex spacer and the dark-mode toggle - see NavItem.tsx for the shared link style. Omit for an app with no nav links (calculator, today). */
  children?: ReactNode;
  /**
   * Tooltip text for the dark-mode toggle, keyed by the mode it would
   * switch TO - optional since calculator's own toggle never had one;
   * deployment's own did (i18n-driven, "theme.switchToLight"/
   * "theme.switchToDark"), preserved here rather than dropped when
   * deployment was ported onto this component 2026-09-19.
   */
  darkModeTooltip?: { toLight: string; toDark: string };
}

/**
 * The identity block + dark-mode toggle shared byte-for-byte (confirmed
 * 2026-09-19) across all three apps' own `TopNavbar.tsx` - logo image
 * (click to leave this app, back to the Electric Futures Playbook splash),
 * title stacked over a "by GSC · tagline" subtitle, then whatever nav
 * links this particular app has (via `children`), then the dark-mode
 * toggle. What's deliberately NOT here: which nav links exist, i18n, and
 * any store-coupling - those differ per app (see the "shared UI" plan's
 * own bespoke-elements table) and stay owned by whichever app renders
 * this component.
 */
export default function AppHeader({ title, byline, mode, setMode, onLogoClick, children, darkModeTooltip }: Props) {
  const toggle = (
    <IconButton onClick={() => setMode(mode === "light" ? "dark" : "light")} size="small" sx={{ ml: 0.5 }}>
      {mode === "light" ? <DarkModeOutlinedIcon fontSize="small" /> : <LightModeOutlinedIcon fontSize="small" />}
    </IconButton>
  );

  return (
    <AppBar position="static" color="inherit" elevation={1}>
      <Toolbar variant="dense" sx={{ gap: { xs: 0.5, sm: 2 }, px: { xs: 1, sm: 2 } }}>
        <Box
          onClick={onLogoClick}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            flexShrink: 0,
            minWidth: 0,
            cursor: "pointer",
            "&:hover": { opacity: 0.8 },
          }}
        >
          <Box component="img" src={`${import.meta.env.BASE_URL}favicon.png`} alt="" sx={{ height: 34, width: 34, flexShrink: 0 }} />
          <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700, fontSize: "1rem", color: "primary.main", letterSpacing: "-0.01em", lineHeight: 1.2 }}>
              {title}
            </Typography>
            <Typography sx={{ fontSize: "0.65rem", color: "text.secondary", lineHeight: 1.3, display: { xs: "none", sm: "block" } }}>
              {byline}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ flex: 1 }} />

        {children}

        {darkModeTooltip ? (
          <Tooltip title={mode === "dark" ? darkModeTooltip.toLight : darkModeTooltip.toDark}>{toggle}</Tooltip>
        ) : (
          toggle
        )}
      </Toolbar>
    </AppBar>
  );
}
