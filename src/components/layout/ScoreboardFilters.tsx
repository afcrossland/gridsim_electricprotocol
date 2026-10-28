import { useState } from "react";
import { Box, Chip, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

import ContinentFilter from "../../../shared/components/ContinentFilter";
import FilterBar from "../../../shared/components/FilterBar";
import { SUBREGIONS, continentOfRegion } from "../../../shared/lib/continents";
import { SCORE_BANDS, bandLabelText, bandSunCount } from "../../lib/scoring";
import { Suns } from "../ui/Suns";
import { NOT_ENOUGH_DATA_BAND, isDefaultFilters } from "../../lib/scoreboardFilters";
import { useProtocolStore } from "../../stores/protocolStore";

const ALL_BANDS = [...SCORE_BANDS.map((b) => b.label), NOT_ENOUGH_DATA_BAND];

/**
 * Region and score-band filters for the Scoreboard list. The region filter is the Deployment Explorer's own (the UN geoscheme's
 * sub-regions, grouped under continent headings, one at a time) so the three apps filter the same way. Collapsed
 * behind a single icon by default - the controls are wide enough to crowd a
 * sidebar list that is mostly meant to be scrolled and clicked, not
 * configured, so they only take space once someone actually asks for them.
 *
 * Reads and writes the filters directly from the store rather than taking
 * them as props, the same way MapLegend and AdminConsole talk to the store -
 * filter state is a view preference shared across the whole app session, not
 * something Scoreboard owns.
 */
export default function ScoreboardFilters() {
  const { t, i18n } = useTranslation();
  const filters = useProtocolStore((s) => s.scoreboardFilters);
  const setFilters = useProtocolStore((s) => s.setScoreboardFilters);
  const resetFilters = useProtocolStore((s) => s.resetScoreboardFilters);
  const sortDirection = useProtocolStore((s) => s.scoreboardSortDirection);
  const setSortDirection = useProtocolStore((s) => s.setScoreboardSortDirection);
  const active = !isDefaultFilters(filters);

  const [expanded, setExpanded] = useState(false);

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
        <Box sx={{ mb: 1.5 }}>
          <ContinentFilter
            value={filters.subregions}
            onChange={(subregions) => setFilters({ subregions })}
            label={t("scoreboard.region")}
            allLabel={t("scoreboard.allRegions")}
            // The UN geoscheme's own 22 sub-regions, one at a time, grouped under their continent - exactly as the
            // Deployment Explorer's filter is. Selected values stay the raw English sub-region names (the matching
            // logic depends on that); only the label is translated.
            options={SUBREGIONS}
            translate={(c) => t(`subregions.${c}`)}
            multiple={false}
            groupLabel={(subregion) => {
              const continent = continentOfRegion(subregion);
              return continent ? t(`continents.${continent}`) : "";
            }}
            sx={{ width: "100%" }}
          />
        </Box>

        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
          {t("scoreboard.score")}
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 1.5 }}>
          {ALL_BANDS.map((band) => (
            <Chip
              key={band}
              label={bandSunCount(band) !== null ? <Suns count={bandSunCount(band)!} size={13} /> : bandLabelText(band, i18n.language)}
              size="small"
              onClick={() => toggleBand(band)}
              color={filters.bands.includes(band) ? "primary" : "default"}
              variant={filters.bands.includes(band) ? "filled" : "outlined"}
            />
          ))}
        </Box>
      </FilterBar>
    </Box>
  );
}
