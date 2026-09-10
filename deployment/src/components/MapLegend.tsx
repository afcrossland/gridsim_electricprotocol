import { Box, Typography, useMediaQuery, useTheme } from "@mui/material";

import { RAMP_STOPS } from "../lib/metrics";

interface Props {
  title: string;
}

/**
 * Same position/behaviour as ep_policymap's MapLegend.tsx: a floating card
 * pinned top-left of the map on desktop, a full-width banner pinned to the
 * map's top edge below `md` (a fixed floating card would either overlap
 * most of a short, full-width mobile map or get clipped).
 */
export default function MapLegend({ title }: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const gradient = RAMP_STOPS.map((s) => `${s.color} ${s.stop * 100}%`).join(", ");
  // Floating glass card over the live map, not a themed app surface - see
  // ep_policymap's MapLegend.tsx for the same reasoning.
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
          textTransform: "uppercase",
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
