import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useTranslation } from "react-i18next";

import CountryDetail from "./CountryDetail";
import GenerationDetail from "./GenerationDetail";
import { CrossLinkTile, StatTile } from "./Sidebar";
import FlagImg from "../../../shared/components/FlagImg";
import { emberCountry } from "../lib/emberSolar";
import { generationCountry } from "../lib/emberGeneration";
import { jurisdictionName } from "../lib/jurisdictions";
import { valueForMetric } from "../lib/metrics";
import { POPULATION, populationActual } from "../lib/population";

interface Props {
  code: string;
  /** This panel's own colour from `compareColorFor`/`PRIMARY_SERIES_COLOR` - marks its header rule and identity dot, so a reader can tell panels apart at a glance the same way a future shared chart's own series would. */
  color: string;
  /** Omitted for the primary column - there's nothing to remove it back to; removing a comparator just drops it from the row. */
  onRemove?: () => void;
}

/**
 * One country's column in the side-by-side Compare row - a small coloured
 * header (flag, name, remove), the same population/per-capita stat tiles
 * and Policy Explorer/Future Grid Simulator cross-links the single-country
 * view shows, then `CountryDetail`/`GenerationDetail` for its own
 * capacity and generation-share history. `StatTile`/`CrossLinkTile` are
 * imported from `Sidebar.tsx` rather than duplicated - same components,
 * same data, just one country's worth repeated per column. Still omits
 * `LockedMetricsSection` and the "Coming soon" GSC-members teaser - those
 * are marketing chrome, not comparable data, and repeating them across up
 * to 5 columns would bury the two time series the row exists to compare.
 * Added 2026-10-13 per Andrew's own instruction ("when we click a
 * country, we can then... press a plus to add countries to the right
 * hand side of the sidebar"), with the stat tiles and cross-links added
 * back in the same day after he saw the first, lighter version running
 * ("we also need to show the population and solar per capita tiles on
 * each country when compared... and also have links to policy explorer
 * and grid simulator as we have now").
 */
export default function ComparePanel({ code, color, onRemove }: Props) {
  const { t, i18n } = useTranslation();
  const country = emberCountry(code);
  const generation = generationCountry(code);
  const name = jurisdictionName(code, i18n.language);

  // Same population/per-capita derivation as Sidebar.tsx's own single-
  // country branch, just scoped to this one panel's own code rather than
  // `selectedCountry` - every compare panel is always a real country (the
  // "+" picker only ever offers real codes), so there's no Global/Region
  // aggregate case to handle here the way Sidebar's own version does.
  const population = POPULATION[code];
  const populationValue = populationActual(code);
  const capacityPerCapita = valueForMetric(code, "capacityPerCapita");

  return (
    <Box
      sx={{
        flex: "1 1 280px",
        minWidth: 260,
        maxWidth: 360,
        display: "flex",
        flexDirection: "column",
        borderRight: "1px solid",
        borderColor: "divider",
        "&:last-of-type": { borderRight: "none" },
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          p: 2,
          borderBottom: "3px solid",
          borderColor: color,
        }}
      >
        <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: color, flexShrink: 0 }} />
        <FlagImg code={code} size={20} />
        <Typography sx={{ fontWeight: 700, fontSize: "0.9rem", flex: 1, minWidth: 0 }} noWrap>
          {name}
        </Typography>
        {/* Always rendered, just hidden (not omitted) when there's nothing
            to remove (the primary column) - per Andrew's own instruction
            2026-10-14 ("there is still misalignment of the line"): an
            icon button is taller than the flag+text row alone, so a
            header that skips it outright ends up shorter than its
            neighbours and its own colour rule sits higher than theirs.
            `visibility: hidden` reserves the exact same space a real
            button would take without guessing at a pixel height. */}
        <Tooltip title={onRemove ? t("comparePanel.remove") : ""}>
          <span>
            <IconButton
              size="small"
              onClick={onRemove}
              disabled={!onRemove}
              sx={{ visibility: onRemove ? "visible" : "hidden" }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      <Box sx={{ p: 1.5, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 2.5 }}>
        {/* Always two tiles, even when a figure is missing - shown as "No
            data" rather than omitted (2026-10-13, "some countries do not
            have data on population. In these cases still show the box but
            say 'no data'"). A country with no population figure dropping
            this row entirely was also why panels didn't line up with each
            other below it - one column's chart started higher than its
            neighbour's whenever that neighbour had one fewer tile above
            it. */}
        <Box sx={{ display: "flex", gap: 1 }}>
          <StatTile
            label={t("sidebar.populationLabel")}
            value={populationValue !== null ? populationValue.toLocaleString(i18n.language) : t("sidebar.noData")}
            tooltip={population ? t("sidebar.worldBankYear", { year: population.year }) : undefined}
          />
          <StatTile
            label={t("sidebar.perCapitaLabel")}
            value={
              capacityPerCapita !== null
                ? t("map.perCapita", { value: capacityPerCapita.toFixed(capacityPerCapita < 1 ? 2 : 0) })
                : t("sidebar.noData")
            }
          />
        </Box>

        <Box sx={{ display: "flex", gap: 1 }}>
          <CrossLinkTile
            href={`${import.meta.env.BASE_URL}policy/?country=${code}`}
            label={t("sidebar.policyExplorer")}
            accent="#008194"
          />
          <CrossLinkTile
            href="https://futuregridsimulator.globalsolarcouncil.org/"
            label={t("sidebar.futureGridSimulator")}
            accent="#C98600"
          />
        </Box>

        {country && <CountryDetail country={country} color={color} />}
        {generation && <GenerationDetail country={generation} color={color} />}
      </Box>
    </Box>
  );
}
