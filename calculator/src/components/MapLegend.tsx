import { Box, Typography, useMediaQuery, useTheme } from "@mui/material";

import { RAMP_STOPS } from "../lib/mapColor";

interface Props {
  title: string;
}

/**
 * Same shape/position as the sibling apps' own MapLegend.tsx - a floating
 * glass card pinned top-left of the map on desktop, a full-width banner
 * pinned to the map's top edge below `md` on mobile. Per Andrew's own
 * instruction 2026-09-16 ("take the legend/colour style from deployment
 * explorer"). The desktop title dropped its own `textTransform:
 * "uppercase"` 2026-09-18 ("on legend we have Annual irradiance (kWh/kWp)
 * on the map. Lets not capitalise as it messes up the units") - this
 * app's own generation legend title has a mixed-case unit (kWh/kWp) that
 * CSS uppercase mangles into KWH/KWP; titles are already written in the
 * case they should display (see METRIC_LEGEND_TITLES in mapMetrics.ts).
 */
export default function MapLegend({ title }: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const gradient = RAMP_STOPS.map((s) => `${s.color} ${s.stop * 100}%`).join(", ");
  const glassBg = theme.palette.mode === "dark" ? "rgba(32,39,42,0.92)" : "rgba(255,255,255,0.92)";

  if (isMobile) {
    return (
      <Box
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1,
          px: 1.5,
          py: 1,
          bgcolor: glassBg,
          backdropFilter: "blur(8px)",
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Typography sx={{ fontSize: "0.6875rem", fontWeight: 600, color: "text.secondary", mb: 0.5 }}>
          {title}
        </Typography>
        <Box sx={{ height: 8, borderRadius: 4, background: `linear-gradient(90deg, ${gradient})` }} />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        position: "absolute",
        top: 16,
        left: 16,
        zIndex: 1000,
        width: "min(20vw, 240px)",
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
          mb: 0.75,
          lineHeight: 1.3,
        }}
      >
        {title}
      </Typography>
      <Box sx={{ height: 10, borderRadius: "5px", background: `linear-gradient(90deg, ${gradient})` }} />
      <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.5 }}>
        <Typography sx={{ fontSize: "0.625rem", color: "text.disabled" }}>Lower</Typography>
        <Typography sx={{ fontSize: "0.625rem", color: "text.disabled" }}>Higher</Typography>
      </Box>
    </Box>
  );
}
