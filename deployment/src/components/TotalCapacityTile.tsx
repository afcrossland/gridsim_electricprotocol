import { Box, Tooltip, Typography, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";

import { latestSolarMonth, totalInstalledGW } from "../lib/emberSolar";
import { monthAbbrev } from "../lib/formatMonth";

/**
 * Small floating headline-stat card, bottom-left of the map - opposite
 * corner from MapLegend (top-left) and the zoom controls (top-right), so
 * nothing overlaps. Shows the world total across every country Ember's
 * capacity file covers, not filtered by the active metric - a fact about
 * the world, not a reading of whichever view is currently selected.
 */
export default function TotalCapacityTile() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const totalGW = totalInstalledGW();
  const { year, month } = latestSolarMonth();
  // Same "glass card" reasoning as MapLegend.tsx - floats over the live
  // map, not a themed app surface.
  const glassBg = theme.palette.mode === "dark" ? "rgba(32,39,42,0.92)" : "rgba(255,255,255,0.92)";

  return (
    <Box
      sx={{
        position: "absolute",
        left: 16,
        // Extra clearance on mobile, added 2026-09-10 - MapLibre's own
        // attribution control renders full "© MapTiler © OpenStreetMap
        // contributors" text (not just the collapsed icon) on first load
        // any time the map container is <=640px wide, and only collapses
        // after the visitor's first drag on the map. `bottom: 16` put this
        // card's own bottom edge right in that same row, overlapping the
        // attribution text horizontally - confirmed via a Playwright +
        // system Chrome screenshot at 390 and 375px wide. 40px clears the
        // attribution row entirely regardless of its expanded/collapsed
        // state, so this doesn't depend on that first-drag timing at all.
        bottom: { xs: 40, sm: 16 },
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
        {t("totalTile.title")}
      </Typography>
      <Typography sx={{ fontSize: "1.375rem", fontWeight: 700, color: "primary.dark", lineHeight: 1.2 }}>
        {t("totalTile.value", { value: totalGW.toLocaleString(undefined, { maximumFractionDigits: 0 }) })}
      </Typography>
      {/* Not every country's own latest figure is this recent - Ember
          doesn't publish all 25 on the same schedule - so this is the
          freshest the total ever gets, not a guarantee for every country's
          contribution. Worth a tooltip, not a paragraph on the tile itself. */}
      <Tooltip title={t("totalTile.freshnessTooltip")}>
        <Typography sx={{ fontSize: "0.6875rem", color: "text.secondary", mt: 0.25, cursor: "default" }}>
          {t("totalTile.asOf", { month: monthAbbrev(month, i18n.language), year })}
        </Typography>
      </Tooltip>
    </Box>
  );
}
