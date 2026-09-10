import { AppBar, Box, IconButton, Toolbar, Tooltip, Typography } from "@mui/material";
import type { PaletteMode } from "@mui/material/styles";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";

import EmberBadge from "./EmberBadge";

interface Props {
  mode: PaletteMode;
  setMode: (mode: PaletteMode) => void;
  page: "map" | "help";
  setPage: (page: "map" | "help") => void;
  onStartTour: () => void;
}

/**
 * Plain underlined-link look, ported from ep_policymap's own
 * TopNavbar.tsx's navItemSx - active gets the aqua text + bottom border,
 * everything else grey until hovered.
 */
function navItemSx(active: boolean) {
  return {
    display: "flex",
    alignItems: "center",
    height: "100%",
    px: { xs: 1, sm: 2 },
    cursor: "pointer",
    color: active ? "primary.main" : "text.secondary",
    fontWeight: active ? 500 : 400,
    fontSize: "0.875rem",
    borderBottom: active ? "2px solid" : "2px solid transparent",
    borderColor: active ? "primary.main" : "transparent",
    transition: "color 0.15s ease, border-color 0.15s ease",
    userSelect: "none" as const,
    "&:hover": { color: "primary.main" },
  };
}

/**
 * Same identity-bar shape as ep_policymap's TopNavbar.tsx - logo, then
 * title stacked over the "by GSC · tagline" subtitle. Now with a Help nav
 * link too (added 2026-09-10, same navItemSx style as Policy Explorer's
 * own), plus the Ember badge and the dark-mode toggle.
 */
export default function TopNavbar({ mode, setMode, page, setPage, onStartTour }: Props) {
  // Same as ep_policymap's own TopNavbar.tsx: the logo leaves this app
  // entirely, back to the Electric Futures Playbook splash at the site
  // root - a real page navigation (this app's own React routing doesn't
  // cover that page, it's a separate static file). BASE_URL rather than a
  // hardcoded "/" so it still resolves under a GitHub Pages subpath.
  const goHome = () => {
    window.location.href = import.meta.env.BASE_URL;
  };

  return (
    <AppBar position="static" color="inherit" elevation={1}>
      <Toolbar variant="dense" sx={{ gap: { xs: 0.5, sm: 2 }, px: { xs: 1, sm: 2 } }}>
        <Box
          onClick={goHome}
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
          <Box
            component="img"
            src={`${import.meta.env.BASE_URL}favicon.png`}
            alt=""
            sx={{ height: 34, width: 34, flexShrink: 0 }}
          />
          <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 0 }}>
            <Typography
              sx={{
                fontWeight: 700,
                fontSize: "1rem",
                color: "primary.main",
                letterSpacing: "-0.01em",
                lineHeight: 1.2,
              }}
            >
              Solar Deployment Explorer
            </Typography>
            <Typography
              sx={{
                fontSize: "0.65rem",
                color: "text.secondary",
                lineHeight: 1.3,
                display: { xs: "none", sm: "block" },
              }}
            >
              by The Global Solar Council&ensp;·&ensp;
              <Box component="span" sx={{ color: "#FBB114", fontStyle: "italic", fontWeight: 600 }}>
                Solar. Storage. Future Secured.
              </Box>
            </Typography>
          </Box>
        </Box>

        <Box sx={{ flex: 1 }} />

        <EmberBadge
          sx={{
            // Hidden below `sm` - the mobile layout shows this same badge
            // in the footer instead (see App.tsx), added there 2026-09-10.
            // This row (logo+title, Ember badge, Take the tour, Help,
            // dark-mode toggle) overflowed on a phone with nothing set to
            // hide, so it's never both places at once.
            display: { xs: "none", sm: "flex" },
            flexShrink: 0,
          }}
        />

        <Box onClick={onStartTour} sx={navItemSx(false)}>
          {/* Abbreviated below `sm`, same as Policy Explorer's own nav -
              "Take the tour" alone was part of the header's mobile overflow. */}
          <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
            Take the tour
          </Box>
          <Box component="span" sx={{ display: { xs: "inline", sm: "none" } }}>
            Tour
          </Box>
        </Box>

        <Box onClick={() => setPage(page === "help" ? "map" : "help")} sx={navItemSx(page === "help")}>
          Help
        </Box>

        <Tooltip title={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
          <IconButton size="small" onClick={() => setMode(mode === "dark" ? "light" : "dark")} sx={{ ml: 0.5 }}>
            {mode === "dark" ? <LightModeOutlinedIcon fontSize="small" /> : <DarkModeOutlinedIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Toolbar>
    </AppBar>
  );
}
