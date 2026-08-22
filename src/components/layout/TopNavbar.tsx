import { AppBar, Box, Button, Toolbar, Typography } from "@mui/material";

import { useProtocolStore } from "../../stores/protocolStore";

export default function TopNavbar() {
  const setWelcomeSeen = useProtocolStore((s) => s.setWelcomeSeen);
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
            sx={{ height: 28, width: 28 }}
          />
          {/* Full name only where there is room for it and three nav buttons
              too - a phone gets the icon alone rather than a wrapped title. */}
          <Typography variant="h5" sx={{ display: { xs: "none", sm: "block" } }}>
            Solar Policy Wiki
          </Typography>
        </Box>

        <Box sx={{ flex: 1 }} />

        {/* The theme's MuiButton override sets a 600 weight everywhere by
            default, which reads as shouting for a plain nav link - dialled
            back to regular weight for just these two. Padding is tightened
            on narrow screens so three buttons plus the logo fit without
            wrapping the toolbar onto a second line. */}
        <Button
          size="small"
          onClick={() => setWelcomeSeen(false)}
          sx={{ fontWeight: 400, minWidth: 0, px: { xs: 1, sm: 2 } }}
        >
          About
        </Button>
        <Button
          size="small"
          variant={page === "help" ? "outlined" : "text"}
          onClick={() => setPage(page === "help" ? "map" : "help")}
          sx={{ fontWeight: 400, minWidth: 0, px: { xs: 1, sm: 2 } }}
        >
          Help
        </Button>
        {/* Stands in for auth: open to anyone until sign-in exists. */}
        <Button
          size="small"
          variant={page === "admin" ? "outlined" : "text"}
          onClick={() => setPage(page === "admin" ? "map" : "admin")}
          sx={{ fontWeight: 400, minWidth: 0, px: { xs: 1, sm: 2 } }}
        >
          <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
            Admin console
          </Box>
          <Box component="span" sx={{ display: { xs: "inline", sm: "none" } }}>
            Admin
          </Box>
        </Button>
      </Toolbar>
    </AppBar>
  );
}
