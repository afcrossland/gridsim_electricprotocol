import type { ReactNode } from "react";
import { Box, Typography } from "@mui/material";

interface Props {
  icon: ReactNode;
  /** Colour for the icon chip, the value, and the fill of the bar beneath. */
  color: string;
  label: string;
  value: string;
  /** Small text under the value, e.g. "17/39 answered". */
  detail?: string;
  /** 0..1. Undefined hides the bar rather than drawing an empty one. */
  fill?: number;
}

/**
 * Compact KPI-style tile - icon in a tinted square, a big value, and a thin
 * progress bar underneath coloured to match. Adapted from GridSim's KpiCard,
 * the same visual language used across the rest of the GSC family of tools.
 */
export default function StatTile({ icon, color, label, value, detail, fill }: Props) {
  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 0,
        display: "flex",
        gap: 1.25,
        alignItems: "flex-start",
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        p: 1.5,
      }}
    >
      <Box
        sx={{
          width: 32,
          height: 32,
          flexShrink: 0,
          borderRadius: 1.5,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: `${color}1F`, // ~12% alpha over the tile background
          color,
        }}
      >
        {icon}
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="overline" sx={{ display: "block", lineHeight: 1.3 }}>
          {label}
        </Typography>
        <Typography variant="h4" sx={{ color, lineHeight: 1.15 }}>
          {value}
        </Typography>
        {detail && (
          <Typography variant="caption" sx={{ display: "block", mb: 0.75 }}>
            {detail}
          </Typography>
        )}

        {fill !== undefined && (
          <Box sx={{ bgcolor: "grey.100", height: 4, borderRadius: 2, mt: detail ? 0 : 0.75 }}>
            <Box
              sx={{
                bgcolor: color,
                height: "100%",
                borderRadius: 2,
                width: `${Math.min(Math.max(fill, 0), 1) * 100}%`,
                transition: "width 300ms ease",
              }}
            />
          </Box>
        )}
      </Box>
    </Box>
  );
}
