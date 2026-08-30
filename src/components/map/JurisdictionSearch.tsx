import { useMemo } from "react";
import { Autocomplete, Box, Paper, TextField, Typography } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";

import { jurisdictions } from "../../lib/jurisdictions";
import { scoreBand, scoreLabel } from "../../lib/scoring";
import type { CountryScore } from "../../lib/types";
import FlagImg from "../ui/FlagImg";

interface Option {
  code: string;
  label: string;
  group: string;
  score: CountryScore | undefined;
}

interface Props {
  scores: CountryScore[];
  selected: string | null;
  onSelect: (code: string) => void;
  /**
   * Default true - see the note on the Autocomplete below. A caller that
   * embeds this inside its own portalled/scrollable surface (a Popover, say)
   * should pass false instead: a disabled-portal dropdown is a normal
   * absolutely-positioned child of this Paper, so it gets clipped by
   * whatever overflow rule that surface's own Paper applies rather than
   * floating freely above everything the way a portalled one does.
   */
  disablePortal?: boolean;
}

/**
 * Search and select any jurisdiction on the map. Sits in PolicyMap's bottom
 * bar rather than a sidebar control, so it stays reachable while looking at
 * the map instead of requiring a trip to the list.
 *
 * Lists everything drawable, not just what has been scored - the point is to
 * reach an empty country in order to start filling it in, so restricting the
 * list to countries with data would defeat it.
 */
export default function JurisdictionSearch({ scores, selected, onSelect, disablePortal = true }: Props) {
  const scoreByCode = useMemo(() => new Map(scores.map((s) => [s.code, s])), [scores]);

  const options = useMemo<Option[]>(
    () =>
      jurisdictions
        .filter((j) => j.mappable)
        .map((j) => ({
          code: j.code,
          label: j.name,
          group: j.region ?? "Other",
          score: scoreByCode.get(j.code),
        }))
        // Jurisdictions with data first, then alphabetically within a group.
        .sort(
          (a, b) =>
            a.group.localeCompare(b.group) ||
            Number(Boolean(b.score?.answered)) - Number(Boolean(a.score?.answered)) ||
            a.label.localeCompare(b.label),
        ),
    [scoreByCode],
  );

  const value = options.find((o) => o.code === selected) ?? null;

  return (
    <Paper
      elevation={0}
      data-tour="jurisdiction-search"
      sx={{
        px: 1,
        py: 0.5,
        width: "100%",
        // The dropdown below needs a positioned ancestor to anchor to - see
        // the `disablePortal` note on the Autocomplete itself.
        position: "relative",
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      <Autocomplete
        size="small"
        options={options}
        value={value}
        // Left at its MUI default (disablePortal false), the dropdown
        // portals to <body> and positions itself against the viewport -
        // inside this app's nested flex/scroll containers (the sidebar's own
        // scroll area, sitting next to the map) that math can misfire and
        // land the list pinned near the top-left of the screen instead of
        // under the input, which is what the bottom-bar usage passes
        // disablePortal=true to avoid: it keeps the dropdown a normal child
        // of this Paper, positioned relative to it instead of the viewport.
        // The trade-off is that a disabled-portal dropdown gets clipped by
        // an ancestor's own overflow rule rather than floating free - a real
        // problem once this component is embedded inside something that
        // clips, like a Popover's own Paper (see the `disablePortal` prop
        // doc above).
        slotProps={{ popper: { disablePortal } }}
        groupBy={(o) => o.group}
        getOptionLabel={(o) => o.label}
        isOptionEqualToValue={(a, b) => a.code === b.code}
        onChange={(_, option) => option && onSelect(option.code)}
        renderOption={(props, option) => {
          const { key, ...liProps } = props as typeof props & { key: string };
          return (
            <Box
              component="li"
              key={key}
              {...liProps}
              sx={{ display: "flex", alignItems: "center", gap: 1 }}
            >
              <FlagImg code={option.code} />
              <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }}>
                {option.label}
              </Typography>
              {option.score && option.score.answered > 0 && (
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 600,
                    color: option.score.ranked
                      ? scoreBand(option.score.score).color
                      : "text.disabled",
                  }}
                >
                  {option.score.ranked
                    ? scoreLabel(option.score.score)
                    : `${option.score.answered}/${option.score.total}`}
                </Typography>
              )}
            </Box>
          );
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder="Search countries and states"
            variant="standard"
            slotProps={{
              input: {
                ...params.InputProps,
                disableUnderline: true,
                startAdornment: (
                  <>
                    {selected ? (
                      <Box sx={{ mr: 0.75, display: "flex" }}>
                        <FlagImg code={selected} />
                      </Box>
                    ) : (
                      <SearchIcon
                        sx={{ fontSize: 18, color: "text.disabled", mr: 0.75, flexShrink: 0 }}
                      />
                    )}
                    {params.InputProps.startAdornment}
                  </>
                ),
              },
            }}
          />
        )}
      />
    </Paper>
  );
}
