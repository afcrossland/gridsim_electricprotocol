import type { ReactNode } from "react";
import { Box, Typography } from "@mui/material";

interface Props {
  icon: ReactNode;
  /** Colour for the icon, the value, and the fill of the bar beneath. */
  color: string;
  label: string;
  value: string;
  /** Small text under the value, e.g. "17/39 answered". */
  detail?: string;
  /** 0..1. Undefined hides the bar rather than drawing an empty one. */
  fill?: number;
}

/**
 * Compact KPI tile, matching the sibling gridsim-frontend project's own
 * `KpiCard` (compact variant) exactly - same colours, spacing and stacked
 * icon/label/value/bar layout, used there for its "Renewable energy share"
 * row of cards and here for a jurisdiction's Score and Data completeness.
 */
export default function StatTile({ icon, color, label, value, detail, fill }: Props) {
  return (
    <Box
      sx={{
        bgcolor: "#F9FAFB",
        borderRadius: "8px",
        p: "12px",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        flex: 1,
        minWidth: 0,
        border: "0.5px solid #E5E7EB",
      }}
    >
      <Box
        sx={{
          bgcolor: `${color}1F`, // ~12% alpha over the tile background
          borderRadius: "6px",
          width: 28,
          height: 28,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color,
        }}
      >
        {icon}
      </Box>

      <Typography
        sx={{
          fontSize: "0.6875rem",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "#9CA3AF",
          fontWeight: 500,
          lineHeight: 1,
        }}
      >
        {label}
      </Typography>

      <Typography sx={{ fontSize: "1.5rem", fontWeight: 700, color, lineHeight: 1 }}>{value}</Typography>

      {detail && <Typography sx={{ fontSize: "0.6875rem", color: "#9CA3AF" }}>{detail}</Typography>}

      {fill !== undefined && (
        <Box sx={{ bgcolor: "#F3F4F6", height: "3px", borderRadius: "2px", width: "100%" }}>
          <Box
            sx={{
              bgcolor: color,
              height: "100%",
              borderRadius: "2px",
              width: `${Math.min(Math.max(fill, 0), 1) * 100}%`,
              transition: "width 0.4s ease",
            }}
          />
        </Box>
      )}
    </Box>
  );
}
