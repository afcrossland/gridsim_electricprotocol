import type { ReactNode } from "react";
import { Box, Typography } from "@mui/material";

interface Props {
  /** Cursor position (map-container-relative pixels) the tooltip floats next to - same `{code, x, y}` shape every app's own map hover state already tracked. */
  x: number;
  y: number;
  flag: ReactNode;
  name: string;
  /** The metric's own value line - a fully-styled `ReactNode`, not a bare string, same reasoning as `RankedRow`'s own `value` prop (policy's "not enough data" branch, deployment's translated unit string, and calculator's formatted figure don't fit one shared default). */
  value: ReactNode;
  /** "Click to explore →" by default - override for i18n (deployment/policy) or different call-to-action copy. */
  exploreLabel?: string;
}

/**
 * The map hover tooltip - design lifted from the sibling gridsim-frontend
 * project's own `map.tsx` (flag + name, a value line, a "Click to explore"
 * hint), applied as one shared component across policy, deployment and
 * calculator 2026-09-29 per Andrew's own instruction ("apply this as a
 * common UI piece... show the flag, country name and value... do show
 * click to explore"). Colours use this product's own theme tokens
 * (`background.paper`/`divider`/`text.primary`/`text.secondary`/
 * `primary.main`) rather than gridsim's own hardcoded light-only hex
 * values, so it still reads correctly in dark mode - the layout/spacing
 * (14px/10px padding, 4px stack gap, 160px min width, the exact type
 * scale) matches gridsim's own version.
 *
 * Deliberately NOT included yet: gridsim's own categorical badge next to
 * its value (there, a colour-coded "Low/Moderate/High" carbon-intensity
 * pill) - tracked as a TODO in ROADMAP.md rather than guessed at here,
 * since each app's own equivalent (calculator's low/medium/high
 * self-sufficiency tiers, policy's own score band) would need its own
 * design pass, not a blind copy of gridsim's carbon-specific colours.
 */
export default function MapHoverTooltip({ x, y, flag, name, value, exploreLabel = "Click to explore →" }: Props) {
  return (
    <Box sx={{ position: "absolute", left: x + 12, top: y - 10, pointerEvents: "none", zIndex: 1000 }}>
      <Box
        sx={{
          bgcolor: "background.paper",
          border: "0.5px solid",
          borderColor: "divider",
          borderRadius: "8px",
          px: "14px",
          py: "10px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
          display: "flex",
          flexDirection: "column",
          gap: "4px",
          minWidth: 160,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          {flag}
          <Typography sx={{ fontSize: "0.875rem", fontWeight: 500, color: "text.primary" }}>{name}</Typography>
        </Box>
        <Box sx={{ fontSize: "0.75rem", color: "text.secondary" }}>{value}</Box>
        <Typography sx={{ fontSize: "0.625rem", color: "primary.main", fontWeight: 500 }}>{exploreLabel}</Typography>
      </Box>
    </Box>
  );
}
