import { AppBar, Box, Button, IconButton, Toolbar, Tooltip, Typography } from "@mui/material";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";

import { useProtocolStore } from "../../stores/protocolStore";

/**
 * A nav item's look, matching the sibling gridsim-frontend project's own
 * TopNavbar exactly: a plain underlined link rather than a button - active
 * gets the aqua text + bottom border, everything else is grey until
 * hovered, no background/outline chrome at any state.
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

export default function TopNavbar() {
  const setTourSeen = useProtocolStore((s) => s.setTourSeen);
  const page = useProtocolStore((s) => s.page);
  const setPage = useProtocolStore((s) => s.setPage);
  const mode = useProtocolStore((s) => s.mode);
  const setMode = useProtocolStore((s) => s.setMode);

  // The logo leaves this app entirely, back to the Electric Futures
  // Playbook splash - the site root now (this app itself moved to
  // /policy/, see vite.config.ts). A real page navigation, not SPA state,
  // since that page is a separate static file outside React's own
  // routing. BASE_URL (not a hardcoded "/") so this still resolves
  // correctly under GitHub Pages' repo-name subpath as well as a custom
  // domain served at the root.
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
          {/* The name alone now fits next to the logo on a phone too, once
              the Charter link freed up room in the nav - only the fuller
              "by GSC · tagline" subtitle stays desktop-only. Format, sizing
              and colour match the sibling gridsim-frontend project's own
              header exactly. */}
          <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <Typography
              sx={{
                fontWeight: 700,
                fontSize: "1rem",
                color: "primary.main",
                letterSpacing: "-0.01em",
                lineHeight: 1.2,
              }}
            >
              Solar Policy Explorer
            </Typography>
            <Typography sx={{ fontSize: "0.65rem", color: "text.secondary", lineHeight: 1.3, display: { xs: "none", sm: "block" } }}>
              by The Global Solar Council&ensp;·&ensp;
              <Box component="span" sx={{ color: "#D97706", fontStyle: "italic", fontWeight: 600 }}>
                Solar. Storage. Future Secured.
              </Box>
            </Typography>
          </Box>
        </Box>

        <Box sx={{ flex: 1 }} />

        <Tooltip title={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
          <IconButton size="small" onClick={() => setMode(mode === "dark" ? "light" : "dark")} sx={{ mr: 0.5 }}>
            {mode === "dark" ? <LightModeOutlinedIcon fontSize="small" /> : <DarkModeOutlinedIcon fontSize="small" />}
          </IconButton>
        </Tooltip>

        {/* Plain underlined links, not buttons - see navItemSx. */}
        <Box sx={{ display: "flex", alignItems: "stretch", height: "100%" }}>
          {page !== "admin" && (
            <>
              <Box onClick={() => setTourSeen(false)} sx={navItemSx(false)}>
                <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
                  Take the tour
                </Box>
                <Box component="span" sx={{ display: { xs: "inline", sm: "none" } }}>
                  Tour
                </Box>
              </Box>

              <Box sx={{ width: "1px", height: 20, bgcolor: "divider", mx: 0.5, alignSelf: "center" }} />
            </>
          )}

          <Box data-tour="nav-links" sx={{ display: "flex", alignItems: "center" }}>
            {/* The Charter link used to live here too, but it's already
                reachable from the tour's own "Read the Citizens
                Electrification Charter" pill - a second nav entry pointing
                at the same modal was redundant. Its text now opens the Help
                page instead, so it's still readable without the tour. */}
            {page !== "admin" && (
              <Box onClick={() => setPage(page === "help" ? "map" : "help")} sx={navItemSx(page === "help")}>
                Help
              </Box>
            )}

            {/* Stands in for auth: open to anyone until sign-in exists. A
                filled blue button rather than a plain link like the others -
                it is the one destructive/editing entry point in the nav, so
                it earns more visual weight. Icon-only on a phone - "Admin
                console"/"Admin" text left too little room next to the other
                nav items and the padlock alone is enough to recognise. */}
            <Tooltip title="Admin console">
              <IconButton
                onClick={() => setPage(page === "admin" ? "map" : "admin")}
                sx={{
                  display: { xs: "inline-flex", sm: "none" },
                  ml: 1.5,
                  // A literal, mode-matched fill rather than the primary.main/
                  // primary.dark tokens - those are text-oriented greys in
                  // dark mode now (too light to pair with white text/icons as
                  // a filled background), so this mirrors what FILL_ACCENT
                  // resolves to for the desktop "Admin console" button instead.
                  bgcolor: mode === "dark" ? "#4B5563" : "primary.main",
                  color: "primary.contrastText",
                  "&:hover": { bgcolor: mode === "dark" ? "#5B6570" : "primary.dark" },
                }}
              >
                <LockOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Button
              size="small"
              variant="contained"
              startIcon={<LockOutlinedIcon fontSize="small" />}
              onClick={() => setPage(page === "admin" ? "map" : "admin")}
              sx={{ display: { xs: "none", sm: "inline-flex" }, ml: 1.5 }}
            >
              Admin console
            </Button>
          </Box>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
