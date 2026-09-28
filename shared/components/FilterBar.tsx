import type { ReactNode } from "react";
import { Badge, Box, Button, Collapse, IconButton, Tooltip, Typography } from "@mui/material";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import FilterListIcon from "@mui/icons-material/FilterList";

interface Labels {
  filter: string;
  hideFilters: string;
  clear: string;
  sortAscending: string;
  sortDescending: string;
}

const DEFAULT_LABELS: Labels = {
  filter: "Filter",
  hideFilters: "Hide filters",
  clear: "Clear",
  sortAscending: "Sort ascending",
  sortDescending: "Sort descending",
};

interface Props {
  active: boolean;
  expanded: boolean;
  onToggleExpanded: () => void;
  onClear: () => void;
  sortDesc: boolean;
  onToggleSort: () => void;
  labels?: Partial<Labels>;
  /** The actual filter controls (e.g. a `ContinentFilter`, plus whatever else a given list needs), shown inside the collapsed panel. */
  children: ReactNode;
}

/**
 * The collapsed-by-default filter row + panel shell used above a ranked
 * list - a filter icon with a badge dot when something's set, a clickable
 * "Filter" label, a "Clear" button once `active`, a flex spacer, then the
 * list's own sort-direction toggle; expanding it reveals a bordered panel
 * around whatever filter controls the caller passes as `children`.
 * Confirmed byte-identical in shape between policy's own
 * `ScoreboardFilters.tsx` and deployment's own `Sidebar.tsx` filter block
 * before this shared copy was written 2026-09-28 (each kept its own extra
 * filter controls - policy's own country/band/range on top of the
 * continent select both already shared - as `children`, only the shell
 * itself moved here), and calculator's own list gained this same shell at
 * the same time, having had no filter box at all before.
 */
export default function FilterBar({ active, expanded, onToggleExpanded, onClear, sortDesc, onToggleSort, labels, children }: Props) {
  const L = { ...DEFAULT_LABELS, ...labels };
  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
        <Tooltip title={expanded ? L.hideFilters : L.filter}>
          <IconButton size="small" onClick={onToggleExpanded}>
            <Badge color="primary" variant="dot" invisible={!active}>
              <FilterListIcon fontSize="small" />
            </Badge>
          </IconButton>
        </Tooltip>
        <Typography variant="body2" onClick={onToggleExpanded} sx={{ cursor: "pointer", userSelect: "none" }}>
          {L.filter}
        </Typography>
        {active && (
          <Button size="small" onClick={onClear} sx={{ fontWeight: 400 }}>
            {L.clear}
          </Button>
        )}

        <Box sx={{ flex: 1 }} />

        <Tooltip title={sortDesc ? L.sortAscending : L.sortDescending}>
          <IconButton size="small" onClick={onToggleSort}>
            {sortDesc ? <ArrowDownwardIcon fontSize="small" /> : <ArrowUpwardIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Box>

      <Collapse in={expanded}>
        <Box sx={{ p: 1.5, mt: 1, borderRadius: 1.5, bgcolor: "background.paper", border: "1px solid", borderColor: "divider" }}>
          {children}
        </Box>
      </Collapse>
    </Box>
  );
}
