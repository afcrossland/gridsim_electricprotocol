import { useMemo, useState } from "react";
import {
  Autocomplete,
  Badge,
  Box,
  Button,
  Checkbox,
  Chip,
  Collapse,
  IconButton,
  MenuItem,
  Slider,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import FilterListIcon from "@mui/icons-material/FilterList";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";

import { CONTINENTS } from "../../lib/jurisdictions";
import { SCORE_BANDS } from "../../lib/scoring";
import {
  NOT_ENOUGH_DATA_BAND,
  continentOfGroup,
  isCompletenessSort,
  isDefaultFilters,
  type ScoreboardSort,
} from "../../lib/scoreboardFilters";
import type { GroupedScore } from "../../lib/types";
import { useProtocolStore } from "../../stores/protocolStore";

interface Props {
  groups: GroupedScore[];
}

const ALL_BANDS = [...SCORE_BANDS.map((b) => b.label), NOT_ENOUGH_DATA_BAND];

/**
 * Continent, country and score filters for the Scoreboard list. Collapsed
 * behind a single icon by default - the controls are wide enough to crowd a
 * sidebar list that is mostly meant to be scrolled and clicked, not
 * configured, so they only take space once someone actually asks for them.
 *
 * Reads and writes the filters directly from the store rather than taking
 * them as props, the same way MapLegend and AdminConsole talk to the store -
 * filter state is a view preference shared across the whole app session, not
 * something Scoreboard owns.
 */
export default function ScoreboardFilters({ groups }: Props) {
  const filters = useProtocolStore((s) => s.scoreboardFilters);
  const setFilters = useProtocolStore((s) => s.setScoreboardFilters);
  const resetFilters = useProtocolStore((s) => s.resetScoreboardFilters);
  const sort = useProtocolStore((s) => s.scoreboardSort);
  const setSort = useProtocolStore((s) => s.setScoreboardSort);
  const active = !isDefaultFilters(filters);

  const [expanded, setExpanded] = useState(false);

  // The slider is dragged continuously but should not spam the store (and
  // therefore every consumer of it) on every pixel of movement - local state
  // tracks the drag, and the store only updates once the user lets go.
  const [rangeDraft, setRangeDraft] = useState<[number, number]>([
    filters.minScore,
    filters.maxScore,
  ]);

  const countryOptions = useMemo(
    () =>
      [...groups]
        // Narrowed to the selected continent(s), if any - picking Europe
        // first means the country picker only offers European countries to
        // pick from next, rather than the whole world.
        .filter((g) => filters.continents.length === 0 || filters.continents.includes(continentOfGroup(g) ?? ""))
        .map((g) => ({ code: g.code, name: g.name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [groups, filters.continents],
  );
  const selectedCountries = countryOptions.filter((c) => filters.countries.includes(c.code));

  const toggleBand = (band: string) => {
    const bands = filters.bands.includes(band)
      ? filters.bands.filter((b) => b !== band)
      : [...filters.bands, band];
    setFilters({ bands });
  };

  return (
    <Box data-tour="scoreboard-filters" sx={{ mb: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
        <Tooltip title={expanded ? "Hide filters" : "Filter this list"}>
          <IconButton size="small" onClick={() => setExpanded((v) => !v)}>
            <Badge color="primary" variant="dot" invisible={!active}>
              <FilterListIcon fontSize="small" />
            </Badge>
          </IconButton>
        </Tooltip>
        <Typography
          variant="body2"
          onClick={() => setExpanded((v) => !v)}
          sx={{ cursor: "pointer", userSelect: "none" }}
        >
          Filter
        </Typography>
        {active && (
          <Button
            size="small"
            onClick={() => {
              resetFilters();
              setRangeDraft([0, 100]);
            }}
            sx={{ fontWeight: 400 }}
          >
            Clear
          </Button>
        )}

        <Box sx={{ flex: 1 }} />

        <TextField
          select
          size="small"
          variant="standard"
          label="Sort by"
          value={isCompletenessSort(sort) ? "completeness" : "score"}
          onChange={(e) => {
            const direction = sort.endsWith("-desc") ? "desc" : "asc";
            setSort(`${e.target.value}-${direction}` as ScoreboardSort);
          }}
          sx={{
            minWidth: 180,
            "& .MuiInputBase-input": { fontSize: "0.875rem" },
            "& .MuiInputLabel-root": { fontSize: "0.875rem" },
          }}
        >
          <MenuItem value="completeness">Data completeness</MenuItem>
          <MenuItem value="score">Policy environment score</MenuItem>
        </TextField>
        <Tooltip title={sort.endsWith("-desc") ? "High to low" : "Low to high"}>
          <IconButton
            size="small"
            onClick={() => {
              const topic = isCompletenessSort(sort) ? "completeness" : "score";
              const direction = sort.endsWith("-desc") ? "asc" : "desc";
              setSort(`${topic}-${direction}` as ScoreboardSort);
            }}
          >
            {sort.endsWith("-desc") ? <ArrowDownwardIcon fontSize="small" /> : <ArrowUpwardIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Box>

      <Collapse in={expanded}>
        <Box
          sx={{
            p: 1.5,
            mt: 1,
            borderRadius: 1.5,
            bgcolor: "background.paper",
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, mb: 1.5 }}>
            <TextField
              select
              size="small"
              label="Continent"
              value={filters.continents}
              onChange={(e) => {
                const value = e.target.value;
                setFilters({ continents: typeof value === "string" ? value.split(",") : value });
              }}
              slotProps={{
                select: {
                  multiple: true,
                  renderValue: (selected) =>
                    (selected as string[]).length > 0
                      ? (selected as string[]).join(", ")
                      : "All continents",
                },
              }}
              sx={{ minWidth: 160, flex: 1 }}
            >
              {CONTINENTS.map((c) => (
                <MenuItem key={c} value={c}>
                  <Checkbox
                    icon={<CheckBoxOutlineBlankIcon fontSize="small" />}
                    checkedIcon={<CheckBoxIcon fontSize="small" />}
                    checked={filters.continents.includes(c)}
                    size="small"
                    sx={{ mr: 1 }}
                  />
                  {c}
                </MenuItem>
              ))}
            </TextField>

            <Autocomplete
              multiple
              disableCloseOnSelect
              size="small"
              options={countryOptions}
              value={selectedCountries}
              getOptionLabel={(o) => o.name}
              isOptionEqualToValue={(a, b) => a.code === b.code}
              onChange={(_, next) => setFilters({ countries: next.map((o) => o.code) })}
              sx={{ minWidth: 220, flex: 2 }}
              renderOption={(props, option, { selected }) => {
                const { key, ...optionProps } = props;
                return (
                  <li key={key} {...optionProps}>
                    <Checkbox
                      icon={<CheckBoxOutlineBlankIcon fontSize="small" />}
                      checkedIcon={<CheckBoxIcon fontSize="small" />}
                      checked={selected}
                      size="small"
                      sx={{ mr: 1 }}
                    />
                    {option.name}
                  </li>
                );
              }}
              renderInput={(params) => <TextField {...params} label="Countries" />}
            />
          </Box>

          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
            Score
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 1.5 }}>
            {ALL_BANDS.map((band) => (
              <Chip
                key={band}
                label={band}
                size="small"
                onClick={() => toggleBand(band)}
                color={filters.bands.includes(band) ? "primary" : "default"}
                variant={filters.bands.includes(band) ? "filled" : "outlined"}
              />
            ))}
          </Box>

          <Box sx={{ px: 0.5, pt: 2 }}>
            <Slider
              size="small"
              value={rangeDraft}
              min={0}
              max={100}
              onChange={(_, next) => setRangeDraft(next as [number, number])}
              onChangeCommitted={(_, next) => {
                const [minScore, maxScore] = next as [number, number];
                setFilters({ minScore, maxScore });
              }}
              valueLabelDisplay="on"
              valueLabelFormat={(v) => `${v}%`}
            />
            <Box sx={{ display: "flex", justifyContent: "space-between", mt: -0.5 }}>
              <Typography variant="caption" color="text.secondary">
                0%
              </Typography>
              <Typography variant="caption" color="text.secondary">
                100%
              </Typography>
            </Box>
          </Box>
        </Box>
      </Collapse>
    </Box>
  );
}
