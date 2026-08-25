import { useMemo, useState } from "react";
import {
  Box,
  Button,
  Checkbox,
  Divider,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Popover,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import SearchIcon from "@mui/icons-material/Search";

import { jurisdictions } from "../../lib/jurisdictions";
import type { CountryScore } from "../../lib/types";
import FlagImg from "../ui/FlagImg";

export interface CompareEntry {
  code: string;
  color: string;
  score?: CountryScore;
}

interface Props {
  primaryCode: string;
  allScores: CountryScore[];
  compareEntries: CompareEntry[];
  maxCount: number;
  onAdd: (code: string) => void;
  onRemove: (code: string) => void;
}

/**
 * One button opens a checklist that stays open across picks - checking or
 * unchecking a jurisdiction adds or removes it immediately without closing
 * the list, so building up to MAX_COMPARE_COUNTRIES comparators is a run of
 * clicks in one place rather than reopening a picker each time. Currently-
 * compared jurisdictions are pinned at the top, each checked and coloured to
 * match its windrose line and rubric-tile flags, so unchecking the right one
 * is obvious even with several picked.
 */
export default function ComparePicker({ primaryCode, allScores, compareEntries, maxCount, onAdd, onRemove }: Props) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [query, setQuery] = useState("");

  const scoreByCode = useMemo(() => new Map(allScores.map((s) => [s.code, s])), [allScores]);
  const comparedCodes = useMemo(() => new Set(compareEntries.map((e) => e.code)), [compareEntries]);

  const candidates = useMemo(
    () =>
      jurisdictions
        .filter((j) => j.mappable && j.code !== primaryCode && !comparedCodes.has(j.code))
        .filter((j) => j.name.toLowerCase().includes(query.trim().toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [primaryCode, comparedCodes, query],
  );

  const atMax = compareEntries.length >= maxCount;

  const close = () => {
    setAnchor(null);
    setQuery("");
  };

  return (
    <>
      <Tooltip title={compareEntries.length === 0 ? "" : `${compareEntries.length}/${maxCount} being compared`}>
        <Button
          size="small"
          data-tour="compare-button"
          startIcon={<CompareArrowsIcon fontSize="small" />}
          onClick={(e) => setAnchor(e.currentTarget)}
        >
          {compareEntries.length === 0 ? "Compare" : `Comparing (${compareEntries.length})`}
        </Button>
      </Tooltip>

      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={close}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Box sx={{ width: 320, maxHeight: 420, display: "flex", flexDirection: "column" }}>
          <Box sx={{ p: 1.5, pb: 1 }}>
            <TextField
              size="small"
              variant="standard"
              fullWidth
              autoFocus
              placeholder="Search countries and states"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              slotProps={{
                input: {
                  disableUnderline: true,
                  startAdornment: <SearchIcon sx={{ fontSize: 18, color: "text.disabled", mr: 0.75 }} />,
                },
              }}
            />
          </Box>
          <Divider />

          <Box sx={{ overflowY: "auto", flex: 1 }}>
            {compareEntries.length > 0 && (
              <>
                {compareEntries.map((entry) => (
                  <ListItemButton key={entry.code} dense onClick={() => onRemove(entry.code)}>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <Checkbox
                        edge="start"
                        checked
                        size="small"
                        tabIndex={-1}
                        disableRipple
                        sx={{ color: entry.color, "&.Mui-checked": { color: entry.color } }}
                      />
                    </ListItemIcon>
                    <Box sx={{ mr: 1, display: "flex" }}>
                      <FlagImg code={entry.code} />
                    </Box>
                    <ListItemText
                      primary={entry.score?.name ?? entry.code}
                      slotProps={{ primary: { sx: { fontWeight: 600, color: entry.color } } }}
                    />
                  </ListItemButton>
                ))}
                <Divider />
              </>
            )}

            {candidates.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                No matches.
              </Typography>
            ) : (
              candidates.map((j) => {
                const s = scoreByCode.get(j.code);
                return (
                  <ListItemButton key={j.code} dense disabled={atMax} onClick={() => onAdd(j.code)}>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <Checkbox edge="start" checked={false} size="small" tabIndex={-1} disableRipple disabled={atMax} />
                    </ListItemIcon>
                    <Box sx={{ mr: 1, display: "flex" }}>
                      <FlagImg code={j.code} />
                    </Box>
                    <ListItemText primary={s?.name ?? j.name} />
                  </ListItemButton>
                );
              })
            )}
          </Box>

          {atMax && (
            <>
              <Divider />
              <Typography variant="caption" color="text.secondary" sx={{ p: 1.5, display: "block" }}>
                Up to {maxCount} at once - remove one above to add another.
              </Typography>
            </>
          )}
        </Box>
      </Popover>
    </>
  );
}
