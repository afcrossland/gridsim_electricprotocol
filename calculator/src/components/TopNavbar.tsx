import { AppBar, Box, IconButton, Toolbar, Typography } from "@mui/material";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import type { PaletteMode } from "@mui/material/styles";

/**
 * Same identity-bar shape as the sibling apps' own TopNavbar.tsx - logo,
 * title stacked over the "by GSC · tagline" subtitle, dark-mode toggle on
 * the right. No nav links yet (no Help page, no tour) - ported the chrome,
 * not the full nav surface, per Andrew's own instruction 2026-09-15 ("bring
 * in all of the key formatting from deployment").
 */
export default function TopNavbar({ mode, setMode }: { mode: PaletteMode; setMode: (mode: PaletteMode) => void }) {
  // Unlike the sibling apps (which link back to their shared site root via
  // BASE_URL), this app's own BASE_URL is "/calculator/" - one path segment
  // below the Electric Futures Playbook root it needs to return to, not
  // the root itself, so this is hardcoded rather than derived from it.
  const goHome = () => {
    window.location.href = "/";
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
          <Box component="img" src={`${import.meta.env.BASE_URL}favicon.png`} alt="" sx={{ height: 34, width: 34, flexShrink: 0 }} />
          <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700, fontSize: "1rem", color: "primary.main", letterSpacing: "-0.01em", lineHeight: 1.2 }}>
              Solar Homes Calculator
            </Typography>
            <Typography sx={{ fontSize: "0.65rem", color: "text.secondary", lineHeight: 1.3, display: { xs: "none", sm: "block" } }}>
              by The Global Solar Council&ensp;·&ensp;
              <Box component="span" sx={{ color: "#FBB114", fontStyle: "italic", fontWeight: 600 }}>
                Solar. Storage. Future Secured.
              </Box>
            </Typography>
          </Box>
        </Box>

        <Box sx={{ flex: 1 }} />

        <IconButton onClick={() => setMode(mode === "light" ? "dark" : "light")} size="small">
          {mode === "light" ? <DarkModeOutlinedIcon fontSize="small" /> : <LightModeOutlinedIcon fontSize="small" />}
        </IconButton>
      </Toolbar>
    </AppBar>
  );
}
