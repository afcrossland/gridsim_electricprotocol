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
      <Toolbar variant="dense" sx={{ gap: 2 }}>
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
          <Typography variant="h5">Solar Policy Wiki</Typography>
        </Box>

        <Box sx={{ flex: 1 }} />

        {/* The theme's MuiButton override sets a 600 weight everywhere by
            default, which reads as shouting for a plain nav link - dialled
            back to regular weight for just these two. */}
        <Button
          size="small"
          onClick={() => setWelcomeSeen(false)}
          sx={{ fontWeight: 400 }}
        >
          About
        </Button>
        {/* Stands in for auth: open to anyone until sign-in exists. */}
        <Button
          size="small"
          variant={page === "admin" ? "outlined" : "text"}
          onClick={() => setPage(page === "admin" ? "map" : "admin")}
          sx={{ fontWeight: 400 }}
        >
          Admin console
        </Button>
      </Toolbar>
    </AppBar>
  );
}
