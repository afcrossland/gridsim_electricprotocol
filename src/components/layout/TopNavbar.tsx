import { AppBar, Box, Button, Toolbar, Typography } from "@mui/material";
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
  const setWelcomeSeen = useProtocolStore((s) => s.setWelcomeSeen);
  const setTourSeen = useProtocolStore((s) => s.setTourSeen);
  const page = useProtocolStore((s) => s.page);
  const setPage = useProtocolStore((s) => s.setPage);
  const selectCountry = useProtocolStore((s) => s.selectCountry);

  // Home: clear the selected jurisdiction and leave whatever full-screen view
  // is open, which also returns the map to its opening view and zoom via the
  // same effect that runs when a selection is cleared any other way.
  const goHome = () => {
    setPage("map");
    selectCountry(null);
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
          {/* Full name/subtitle only where there is room for it and three nav
              buttons too - a phone gets the icon alone rather than a wrapped
              title. Format, sizing and colour match the sibling gridsim-
              frontend project's own header exactly. */}
          <Box
            sx={{
              display: { xs: "none", sm: "flex" },
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
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
            <Typography sx={{ fontSize: "0.65rem", color: "text.secondary", lineHeight: 1.3 }}>
              by The Global Solar Council&ensp;·&ensp;
              <Box component="span" sx={{ color: "#D97706", fontStyle: "italic", fontWeight: 600 }}>
                Solar. Storage. Future Secured.
              </Box>
            </Typography>
          </Box>
        </Box>

        <Box sx={{ flex: 1 }} />

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
            {page !== "admin" && (
              <>
                <Box onClick={() => setWelcomeSeen(false)} sx={navItemSx(false)}>
                  Charter
                </Box>
                <Box onClick={() => setPage(page === "help" ? "map" : "help")} sx={navItemSx(page === "help")}>
                  Help
                </Box>
              </>
            )}

            {/* Stands in for auth: open to anyone until sign-in exists. A
                filled blue button rather than a plain link like the others -
                it is the one destructive/editing entry point in the nav, so
                it earns more visual weight. */}
            <Button
              size="small"
              variant="contained"
              startIcon={<LockOutlinedIcon fontSize="small" />}
              onClick={() => setPage(page === "admin" ? "map" : "admin")}
              sx={{ minWidth: 0, px: { xs: 1.25, sm: 2 }, ml: 1.5 }}
            >
              <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
                Admin console
              </Box>
              <Box component="span" sx={{ display: { xs: "inline", sm: "none" } }}>
                Admin
              </Box>
            </Button>
          </Box>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
