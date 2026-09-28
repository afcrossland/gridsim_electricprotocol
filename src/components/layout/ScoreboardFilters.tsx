import { useMemo, useState } from "react";
import { Autocomplete, Box, Checkbox, Chip, Slider, TextField, Typography } from "@mui/material";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import { useTranslation } from "react-i18next";

import ContinentFilter from "../../../shared/components/ContinentFilter";
import FilterBar from "../../../shared/components/FilterBar";
import { SCORE_BANDS, bandLabelText } from "../../lib/scoring";
import {
  NOT_ENOUGH_DATA_BAND,
  continentOfGroup,
  isDefaultFilters,
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
  const { t, i18n } = useTranslation();
  const filters = useProtocolStore((s) => s.scoreboardFilters);
  const setFilters = useProtocolStore((s) => s.setScoreboardFilters);
  const resetFilters = useProtocolStore((s) => s.resetScoreboardFilters);
  const sortDirection = useProtocolStore((s) => s.scoreboardSortDirection);
  const setSortDirection = useProtocolStore((s) => s.setScoreboardSortDirection);
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
      {/* Ported onto the shared `FilterBar`/`ContinentFilter` 2026-09-28,
          per Andrew's own instruction ("this should use a common element")
          when calculator gained its own filter box - confirmed
          byte-identical shell to deployment's own Sidebar.tsx filter block
          before this. The country/band/range controls below stay this
          app's own - neither sibling app has an equivalent concept. */}
      <FilterBar
        active={active}
        expanded={expanded}
        onToggleExpanded={() => setExpanded((v) => !v)}
        onClear={() => {
          resetFilters();
          setRangeDraft([0, 100]);
        }}
        sortDesc={sortDirection === "desc"}
        onToggleSort={() => setSortDirection(sortDirection === "desc" ? "asc" : "desc")}
        labels={{
          filter: t("scoreboard.filter"),
          hideFilters: t("scoreboard.hideFilters"),
          clear: t("scoreboard.clear"),
          sortAscending: t("scoreboard.lowToHigh"),
          sortDescending: t("scoreboard.highToLow"),
        }}
      >
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, mb: 1.5 }}>
          <ContinentFilter
            value={filters.continents}
            onChange={(continents) => setFilters({ continents })}
            label={t("scoreboard.continent")}
            allLabel={t("scoreboard.allContinents")}
            // Selected values stay the raw English CONTINENTS strings
            // (continentOfGroup()/matching logic depends on that), only
            // the rendered label is translated.
            translate={(c) => t(`continents.${c}`)}
            sx={{ minWidth: 160, flex: 1 }}
          />

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
            renderInput={(params) => <TextField {...params} label={t("scoreboard.countries")} />}
          />
        </Box>

        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
          {t("scoreboard.score")}
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 1.5 }}>
          {ALL_BANDS.map((band) => (
            <Chip
              key={band}
              label={bandLabelText(band, i18n.language)}
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
      </FilterBar>
    </Box>
  );
}
