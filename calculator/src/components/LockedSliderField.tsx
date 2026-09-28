import { Box, Typography } from "@mui/material";
import LockIcon from "@mui/icons-material/Lock";

interface Props {
  heading: string;
  value: number;
  unit: string;
  precision?: number;
}

/**
 * A member-only Design-tab slider, added 2026-09-28 per Andrew's own
 * instruction ("make panel size, battery size and demand members only...
 * fade and put members only over them") - "Number of panels" stays free to
 * adjust, the other three fields on this tab become a locked teaser once a
 * location is selected. Same "blur the real content, overlay a lock +
 * Members only label" convention as deployment's own
 * `LockedMetricChart.tsx` and this app's own `WorldMap.tsx` global-simulator
 * teaser - no real per-field gating exists, this just shows the current
 * value/heading (matching the free slider's own look) rather than a live,
 * draggable control.
 */
export default function LockedSliderField({ heading, value, unit, precision = 0 }: Props) {
  return (
    <Box sx={{ position: "relative", borderRadius: "12px", border: "1px solid", borderColor: "divider" }}>
      <Box sx={{ p: 2, filter: "blur(4px)", pointerEvents: "none", userSelect: "none" }} aria-hidden>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {heading}
        </Typography>
        <Typography sx={{ fontWeight: 700, fontSize: "1.0625rem", mb: 1 }}>
          {value.toLocaleString(undefined, { minimumFractionDigits: precision, maximumFractionDigits: precision })}
          {unit ? ` ${unit}` : ""}
        </Typography>
        <Box sx={{ height: 4, borderRadius: 2, bgcolor: "action.disabledBackground" }} />
      </Box>
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 0.25,
          borderRadius: "12px",
          bgcolor: (theme) => (theme.palette.mode === "dark" ? "rgba(32,39,42,0.45)" : "rgba(255,255,255,0.55)"),
        }}
      >
        <LockIcon sx={{ fontSize: 18, color: "text.secondary" }} />
        <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>
          Members only
        </Typography>
      </Box>
    </Box>
  );
}
