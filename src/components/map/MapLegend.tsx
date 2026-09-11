import { Box, Paper, Typography, useMediaQuery, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";

import { SCORE_RAMP } from "../../lib/scoring";
import { useProtocolStore } from "../../stores/protocolStore";

/**
 * Reads which measure is currently painted so its title and "not enough
 * data" swatch stay accurate - the score/completeness choice itself is made
 * in the bottom toolbar (see App.tsx), not here.
 */
export default function MapLegend() {
  const { t } = useTranslation();
  const metric = useProtocolStore((s) => s.mapMetric);
  const showingScore = metric === "score";
  const theme = useTheme();
  // The floating bottom-left card assumes a wide, tall map - on the short,
  // full-width map used below `md` it would either overlap most of the
  // visible countries or get clipped, so it becomes a single-row banner
  // pinned to the top of the map instead.
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const gradient = SCORE_RAMP.map((s) => `${s.color} ${s.stop * 100}%`).join(", ");
  // Floating glass card over the live map, not a themed app surface - a
  // literal rgba (rather than theme.palette.background.paper) so it stays
  // translucent over whatever the map is showing underneath, in both modes.
  const glassBg = theme.palette.mode === "dark" ? "rgba(32,39,42,0.92)" : "rgba(255,255,255,0.92)";

  if (isMobile) {
    return (
      <Paper
        elevation={2}
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1,
          px: 1.5,
          py: 1,
          display: "flex",
          alignItems: "center",
          gap: 1.25,
          bgcolor: glassBg,
          backdropFilter: "blur(8px)",
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box
            sx={{
              height: 8,
              borderRadius: 4,
              background: `linear-gradient(90deg, ${gradient})`,
            }}
          />
          <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.25 }}>
            <Typography variant="caption" sx={{ fontSize: "0.6rem", lineHeight: 1 }}>
              0%
            </Typography>
            <Typography variant="caption" sx={{ fontSize: "0.6rem", lineHeight: 1 }}>
              100%
            </Typography>
          </Box>
        </Box>
      </Paper>
    );
  }

  return (
    <Box
      sx={{
        position: "absolute",
        top: 16,
        left: 16,
        zIndex: 1000,
        width: "min(20vw, 100%)",
        px: 1.5,
        py: 1.25,
        bgcolor: glassBg,
        backdropFilter: "blur(8px)",
        borderRadius: "8px",
        border: "1px solid",
        borderColor: "divider",
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
          mb: 0.75,
          lineHeight: 1.3,
        }}
      >
        {showingScore ? t("legend.protocolScore") : t("legend.questionsAnswered")}
      </Typography>

      {/* Smooth gradient bar, matching Deployment Explorer's own MapLegend.tsx
          (changed 2026-09-11 per Andrew's instruction, replacing the
          previous segmented-block version) - the map itself already reads
          a score as a continuous interpolation between SCORE_RAMP's stops
          (see PolicyMap.tsx's FILL_COLOR), so a smooth bar matches what's
          actually painted more closely than discrete blocks did. */}
      <Box sx={{ height: 10, borderRadius: "5px", background: `linear-gradient(90deg, ${gradient})` }} />

      {/* Ticks at each quartile rather than just the two ends, so a colour on
          the map can be read against a value without guessing between them. */}
      <Box sx={{ position: "relative", height: 16, mt: 0.5 }}>
        {[0, 25, 50, 75, 100].map((pct) => (
          <Typography
            key={pct}
            sx={{
              position: "absolute",
              fontSize: "0.625rem",
              color: "text.disabled",
              lineHeight: 1,
              top: 2,
              left: pct === 100 ? undefined : `${pct}%`,
              right: pct === 100 ? 0 : undefined,
              transform: pct > 0 && pct < 100 ? "translateX(-50%)" : undefined,
            }}
          >
            {pct}%
          </Typography>
        ))}
      </Box>
    </Box>
  );
}
