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

  return (
    <AppBar position="static" color="inherit" elevation={1}>
      <Toolbar variant="dense" sx={{ gap: 2 }}>
        <Typography variant="h5" sx={{ flexShrink: 0 }}>
          {protocol.title}
        </Typography>
        <Typography variant="body2" sx={{ flexShrink: 0 }}>
          Policy Map
        </Typography>

        <Box sx={{ flex: 1 }} />

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
