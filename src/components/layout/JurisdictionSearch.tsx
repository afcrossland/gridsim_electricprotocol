import { useMemo } from "react";
import { Autocomplete, Box, Paper, TextField, Typography } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";

import { jurisdictions } from "../../lib/jurisdictions";
import { scoreColor } from "../../lib/scoring";
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
}

/**
 * Search and select any jurisdiction on the map.
 *
 * Lists everything drawable, not just what has been scored - the point is to
 * reach an empty country in order to start filling it in, so restricting the
 * list to countries with data would defeat it.
 */
export default function JurisdictionSearch({ scores, selected, onSelect }: Props) {
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
      variant="outlined"
      sx={{
        px: 1,
        py: 0.5,
        width: "100%",
      }}
    >
      <Autocomplete
        size="small"
        options={options}
        value={value}
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
                      ? scoreColor(option.score.score)
                      : "text.disabled",
                  }}
                >
                  {option.score.ranked
                    ? `${Math.round(option.score.score * 100)}%`
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
