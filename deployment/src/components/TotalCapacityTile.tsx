import { Box, Typography, useTheme } from "@mui/material";

import { totalInstalledGW } from "../lib/emberSolar";

/**
 * Small floating headline-stat card, bottom-left of the map - opposite
 * corner from MapLegend (top-left) and the zoom controls (top-right), so
 * nothing overlaps. Shows the world total across every country Ember's
 * capacity file covers, not filtered by the active metric - a fact about
 * the world, not a reading of whichever view is currently selected.
 */
export default function TotalCapacityTile() {
  const theme = useTheme();
  const totalGW = totalInstalledGW();
  // Same "glass card" reasoning as MapLegend.tsx - floats over the live
  // map, not a themed app surface.
  const glassBg = theme.palette.mode === "dark" ? "rgba(32,39,42,0.92)" : "rgba(255,255,255,0.92)";

  return (
    <Box
      sx={{
        position: "absolute",
        left: 16,
        bottom: 16,
        zIndex: 1000,
        px: 1.5,
        py: 1.25,
        bgcolor: glassBg,
        backdropFilter: "blur(8px)",
        borderRadius: "8px",
        border: "1px solid rgba(0,0,0,0.08)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
      }}
    >
      <Typography
        sx={{
          fontSize: "0.625rem",
          fontWeight: 600,
          letterSpacing: "0.06em",
          color: "text.secondary",
          textTransform: "uppercase",
          mb: 0.25,
        }}
      >
        World total installed
      </Typography>
      <Typography sx={{ fontSize: "1.375rem", fontWeight: 700, color: "primary.dark", lineHeight: 1.2 }}>
        {totalGW.toLocaleString(undefined, { maximumFractionDigits: 0 })} GW
      </Typography>
    </Box>
  );
}
