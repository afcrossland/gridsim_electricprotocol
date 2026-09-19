import type { ReactNode } from "react";
import { Box, Typography, useTheme } from "@mui/material";

interface Props {
  /** Rank number (1-based) - omitted for a nested/child row (e.g. policy's own indented sub-jurisdiction rows), which show no rank of their own. */
  rank?: number;
  flag: ReactNode;
  name: string;
  /**
   * The metric's own value for this row - a fully-styled `ReactNode`, not
   * a bare string: deployment's and calculator's own usages pass a plain
   * `<Typography>` (bold, `primary.dark`, `flexShrink: 0`), but policy's
   * own needs a fixed width, dynamic colour and conditional `noWrap` (see
   * its own `tileDisplay()`), which don't fit one shared default style -
   * so every caller supplies its own, same as `flag`/`trailing` already do.
   */
  value: ReactNode;
  selected?: boolean;
  onClick: () => void;
  /** Appended after the value - e.g. policy's own expand/collapse chevron for a subdivided-country group. Omit for a plain leaf row. */
  trailing?: ReactNode;
}

/**
 * One row of a default (no-selection) ranked list - confirmed near-
 * identical between deployment's own `Sidebar.tsx` and calculator's own
 * `CountryLeagueTable.tsx` before this shared copy was written 2026-09-19;
 * policy's own `Scoreboard.tsx` row matches the same tile shape plus a
 * `trailing` expand/collapse chevron for its own subdivided-country
 * grouping (US/CA/AU) - the grouping/expansion logic itself stays in
 * whichever app needs it, only this leaf tile is shared.
 */
export default function RankedRow({ rank, flag, name, value, selected, onClick, trailing }: Props) {
  const theme = useTheme();
  // Found 2026-09-19 testing policy's own port in dark mode: this hover
  // shade was already a hardcoded light hex (`#F3F4F6`) in every app's
  // own pre-existing row, unnoticed since none of them had been tested
  // hovered in dark mode before - light-on-light-adjacent text next to a
  // theme-dark row background made the name unreadable while hovering.
  // Not introduced by sharing this component, but fixed here now that
  // sharing it made every app's own row get the same real test coverage.
  const hoverBg = theme.palette.mode === "dark" ? "rgba(255,255,255,0.08)" : "#F3F4F6";
  return (
    <Box
      onClick={onClick}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        pl: 1.25,
        pr: 1,
        py: 0.9,
        borderRadius: "8px",
        border: "1px solid",
        borderColor: selected ? "primary.main" : "#E5E7EB",
        cursor: "pointer",
        overflow: "hidden",
        bgcolor: selected ? "action.selected" : "action.hover",
        transition: "background-color 120ms ease, border-color 120ms ease",
        "&:hover": { bgcolor: selected ? "action.selected" : hoverBg },
        // Policy's own trailing chevron (a plain leaf row's disclosure
        // hint, distinct from the expand/collapse IconButton a *group*
        // row gets instead) brightens and nudges right on row hover - a
        // no-op for any row that doesn't render an element with this
        // className, so harmless for deployment/calculator's own rows.
        "&:hover .row-chevron": { color: "primary.main", transform: "translateX(2px)" },
      }}
    >
      {rank !== undefined && (
        <Typography variant="caption" sx={{ width: 16, textAlign: "right", fontWeight: 600, flexShrink: 0 }}>
          {rank}
        </Typography>
      )}
      {flag}
      <Typography variant="subtitle1" noWrap sx={{ flex: 1, minWidth: 0 }}>
        {name}
      </Typography>
      {value}
      {trailing}
    </Box>
  );
}
