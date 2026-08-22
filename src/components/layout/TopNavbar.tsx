import {
  AppBar,
  Box,
  Button,
  ToggleButton,
  ToggleButtonGroup,
  Toolbar,
  Typography,
} from "@mui/material";

import type { Role } from "../../lib/types";
import { protocol, useProtocolStore } from "../../stores/protocolStore";

export default function TopNavbar() {
  const role = useProtocolStore((s) => s.role);
  const setRole = useProtocolStore((s) => s.setRole);
  const resetToSeed = useProtocolStore((s) => s.resetToSeed);
  const setWelcomeSeen = useProtocolStore((s) => s.setWelcomeSeen);
  const page = useProtocolStore((s) => s.page);
  const setPage = useProtocolStore((s) => s.setPage);
  const selectCountry = useProtocolStore((s) => s.selectCountry);

  // Home: clear the selected jurisdiction and leave Settings, which also
  // returns the map to its opening view and zoom via the same effect that
  // runs when a selection is cleared any other way.
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
        <Typography variant="body2" sx={{ flexShrink: 0, display: { xs: "none", md: "block" } }}>
          Scored against The {protocol.title}
        </Typography>

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
        <Button
          size="small"
          variant={page === "settings" ? "outlined" : "text"}
          onClick={() => setPage(page === "settings" ? "map" : "settings")}
          sx={{ fontWeight: 400 }}
        >
          Settings
        </Button>

        {/* Stands in for auth: roles are a UI switch until sign-in exists. */}
        <ToggleButtonGroup
          size="small"
          exclusive
          value={role}
          onChange={(_, next: Role | null) => next && setRole(next)}
        >
          <ToggleButton value="registered">Registered</ToggleButton>
          <ToggleButton value="admin">Admin</ToggleButton>
        </ToggleButtonGroup>

        {role === "admin" && (
          <Button
            size="small"
            color="warning"
            onClick={() => {
              if (confirm("Discard all local edits and reload the spreadsheet data?")) {
                resetToSeed();
              }
            }}
          >
            Reset to seed
          </Button>
        )}
      </Toolbar>
    </AppBar>
  );
}
