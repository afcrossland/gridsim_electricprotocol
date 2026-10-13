import { useMemo, useState } from "react";
import { Box, IconButton, Stack, Tooltip, Typography, useTheme } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PublicIcon from "@mui/icons-material/Public";
import { useTranslation } from "react-i18next";

import ComparePanel from "./ComparePanel";
import ComparePicker from "./ComparePicker";
import CountryDetail from "./CountryDetail";
import GenerationDetail from "./GenerationDetail";
import LockedMetricsSection from "./LockedMetricsSection";
import ContinentFilter from "../../../shared/components/ContinentFilter";
import DetailHeader from "../../../shared/components/DetailHeader";
import FilterBar from "../../../shared/components/FilterBar";
import FlagImg from "../../../shared/components/FlagImg";
import RankedRow from "../../../shared/components/RankedRow";
import { aggregateEmberCountries } from "../lib/aggregateSolar";
import { compareColorFor, MAX_COMPARE_COUNTRIES, PRIMARY_SERIES_COLOR } from "../lib/compareColors";
import { emberCountry, latestPointOf } from "../lib/emberSolar";
import { generationCountry } from "../lib/emberGeneration";
import { monthAbbrev } from "../lib/formatMonth";
import { GLOBAL_CODE, GLOBAL_SOLAR, globalLatestSolarMW } from "../lib/globalSolar";
import { jurisdictionName, subregionOf, SUBREGIONS } from "../lib/jurisdictions";
import { codesForMetric, valueForMetric, type Metric } from "../lib/metrics";
import { POPULATION, populationActual, regionPopulationActual, regionPopulationMillions, regionPopulationYearRange } from "../lib/population";

interface Props {
  metric: Metric;
  selectedCountry: string | null;
  onSelect: (code: string | null) => void;
  /** Hides the "Solar Deployment Explorer" heading below - only on mobile, where it sits directly under TopNavbar's own copy of the same title and reads as an immediate duplicate. On desktop the sidebar is beside the map, not under the header, so the heading still earns its place there. */
  isMobile?: boolean;
  /** Shows the member-only "+" Compare entry point next to the selected country's own header - see the detail-view branch below. */
  member: boolean;
  /** Countries added to the compare row alongside `selectedCountry` (the primary/first column) - lifted to App.tsx, same reasoning as `selectedCountry` itself. */
  compareCountries: string[];
  onAddCompare: (code: string) => void;
  onRemoveCompare: (code: string) => void;
  /**
   * The UN geoscheme sub-region filter (Northern Africa, Caribbean, ... -
   * see `shared/lib/continents.ts`'s own `SUBREGIONS`), lifted to App.tsx
   * (2026-10-14) so `DeploymentMap` can zoom to fit it too; same reasoning
   * as `compareCountries`. Replaced this app's own six-continent filter
   * the same day, per Andrew's own instruction ("implement a filter not
   * on continent but on United Nations geoscheme") - still built on the
   * shared `ContinentFilter` component (policy's and calculator's own
   * filters still use it for the coarser six-continent list; this app's
   * own usage just passes the finer `SUBREGIONS` list via its `options`
   * prop instead).
   */
  subregions: string[];
  onSubregionsChange: (next: string[]) => void;
}

/**
 * One of the two "see this country elsewhere" tiles at the top of the
 * detail panel - a small version of the Electric Futures Playbook's own
 * tile cards (index.html's `.tile`/`.cta` classes): a bold, brand-coloured
 * title matching that tool's own accent on the homepage (aqua-dark for
 * Policy Explorer, citrus-dark for Grid Simulator - see index.html's
 * `--aqua-dark`/`--citrus-dark`), a rounded-pill CTA button in that same
 * colour. Opens in a new tab since it leaves this app entirely.
 */
export function CrossLinkTile({ href, label, accent }: { href: string; label: string; accent: string }) {
  const { t } = useTranslation();
  return (
    <Box
      sx={{
        flex: 1,
        borderRadius: "12px",
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
        p: 1.5,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: 1,
      }}
    >
      {/* Reserves two lines' worth of height unconditionally, same reasoning
          as `StatTile`'s own `minHeight` just below - defensive here since
          this label's text is the same in every panel, but keeps the row
          height from depending on any one panel's own text-wrap outcome. */}
      <Typography
        sx={{
          fontWeight: 800,
          fontSize: "0.8125rem",
          color: accent,
          lineHeight: 1.25,
          minHeight: "2.5em",
          display: "flex",
          alignItems: "center",
        }}
      >
        {label}
      </Typography>
      <Box
        component="a"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 0.5,
          fontWeight: 700,
          fontSize: "0.6875rem",
          color: "#fff",
          bgcolor: accent,
          px: 1.5,
          py: 0.5,
          borderRadius: "999px",
          textDecoration: "none",
          transition: "filter 120ms ease",
          "&:hover": { filter: "brightness(1.08)" },
        }}
      >
        {t("sidebar.open")}
        <OpenInNewIcon sx={{ fontSize: 14 }} />
      </Box>
    </Box>
  );
}

/**
 * A pair of these sit at the top of the detail panel body - population and
 * solar-per-capita, the two figures that give the headline capacity number
 * below them some context. Same card shell as CrossLinkTile (border, radius,
 * padding) but no accent colour or CTA button, since there's nothing to
 * click through to - just a label/value pair, optionally with a tooltip for
 * the source/year (population's World Bank year).
 *
 * The value's own `minHeight` reserves room for two lines regardless of
 * whether this particular value actually wraps - per Andrew's own
 * instruction 2026-10-14 ("there are occasions where the charts do not
 * align. force top align"): in Compare mode's narrow tiles, a real
 * per-capita figure ("1758 W per capita") wraps to two lines while a
 * short "No data" stays on one, so a country with no data got a shorter
 * stat-tile row than its neighbours and everything below it - the header,
 * cross-links, both charts - started that much higher. Reserving the
 * taller case's height unconditionally, rather than depending on whatever
 * a given value happens to need, is what makes every panel's own row the
 * same height regardless of content.
 */
export function StatTile({ label, value, tooltip }: { label: string; value: string; tooltip?: string }) {
  const content = (
    <Box
      sx={{
        flex: 1,
        borderRadius: "12px",
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
        p: 1.5,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        textAlign: "center",
      }}
    >
      <Typography
        sx={{
          fontSize: "0.6875rem",
          fontWeight: 600,
          letterSpacing: "0.04em",
          color: "text.secondary",
          textTransform: "uppercase",
          mb: 0.5,
          minHeight: "2.4em",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          fontWeight: 800,
          fontSize: "1rem",
          color: "text.primary",
          lineHeight: 1.2,
          minHeight: "2.4em",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {value}
      </Typography>
    </Box>
  );
  return tooltip ? <Tooltip title={tooltip}>{content}</Tooltip> : content;
}

/**
 * Full-width, below the two CrossLinkTile cards - dashed border and muted
 * text rather than the solid brand-accent tile style above it, so it
 * reads as "not built yet" rather than a second working link at a glance.
 * Same "Coming soon" wording convention as the Playbook homepage's own
 * greyed-out Solar Economics Explorer tile (`index.html`'s `.tile.economics`).
 */
function ComingSoonTile({ label }: { label: string }) {
  const { t } = useTranslation();
  return (
    <Box
      sx={{
        borderRadius: "12px",
        border: "1px dashed",
        borderColor: "divider",
        bgcolor: "action.hover",
        p: 1.5,
        textAlign: "center",
      }}
    >
      <Typography sx={{ fontWeight: 700, fontSize: "0.75rem", color: "text.disabled" }}>
        {t("sidebar.comingSoonLabel", { label })}
      </Typography>
    </Box>
  );
}

// Width and border are the caller's job now, not this component's own -
// 2026-09-10, part of building a real mobile layout (see App.tsx): on
// desktop this sits at a fixed width next to the map with a left border,
// on mobile it fills the full screen on its own with no border, and this
// component has no way to know which case it's in. Matches Policy
// Explorer's own Scoreboard.tsx/CountryPanel.tsx, which are equally
// width-agnostic for the same reason.
const PANEL_SX = {
  display: "flex",
  flexDirection: "column",
  bgcolor: "background.paper",
  height: "100%",
} as const;

/** Pseudo-jurisdiction code for the sub-region filter's own pinned aggregate row - see `GLOBAL_CODE`'s own doc comment for the same reasoning, just scoped to whatever the filter currently matches instead of every country. */
const REGION_CODE = "REGION";

/**
 * The pinned "Global" row and the sub-region filter's own "Region" row share
 * this exact tile - a soft aqua tint (not selected/hover-driven, unlike the
 * ranking rows below) and an icon instead of a flag, since neither
 * represents one real jurisdiction. Extracted 2026-09-30 when the region
 * row was added, rather than duplicating this a second time.
 */
function PinnedAggregateRow({ onClick, label, value }: { onClick: () => void; label: string; value: string }) {
  const theme = useTheme();
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
        mb: 0.75,
        borderRadius: "8px",
        border: "1px solid",
        borderColor: "primary.main",
        cursor: "pointer",
        overflow: "hidden",
        bgcolor: theme.palette.mode === "dark" ? "rgba(0,171,187,0.18)" : "rgba(0,171,187,0.08)",
        transition: "background-color 120ms ease",
        "&:hover": { bgcolor: theme.palette.mode === "dark" ? "rgba(0,171,187,0.26)" : "rgba(0,171,187,0.14)" },
      }}
    >
      <PublicIcon sx={{ fontSize: 16, color: "primary.main", flexShrink: 0 }} />
      <Typography variant="subtitle1" noWrap sx={{ flex: 1, minWidth: 0, fontWeight: 700 }}>
        {label}
      </Typography>
      <Typography variant="body2" noWrap sx={{ fontWeight: 700, color: "primary.dark", flexShrink: 0 }}>
        {value}
      </Typography>
    </Box>
  );
}

/**
 * Ranking + filters, same role as ep_policymap's Scoreboard.tsx +
 * ScoreboardFilters.tsx combined into one (this app has no separate
 * per-country detail view yet to justify splitting them) - a country's own
 * row is what drives both browsing and selecting one on the map.
 */
export default function Sidebar({
  metric,
  selectedCountry,
  onSelect,
  isMobile,
  member,
  compareCountries,
  onAddCompare,
  onRemoveCompare,
  subregions,
  onSubregionsChange,
}: Props) {
  const { t, i18n } = useTranslation();
  const [desc, setDesc] = useState(true);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const filtersActive = subregions.length > 0;

  const rows = useMemo(() => {
    return codesForMetric(metric)
      .map((code) => ({
        code,
        name: jurisdictionName(code, i18n.language),
        subregion: subregionOf(code),
        value: valueForMetric(code, metric),
      }))
      .filter((r) => subregions.length === 0 || (r.subregion && subregions.includes(r.subregion)))
      .filter((r) => r.value !== null)
      .sort((a, b) => (desc ? b.value! - a.value! : a.value! - b.value!));
  }, [metric, subregions, desc, i18n.language]);

  const isGlobalSelected = selectedCountry === GLOBAL_CODE;
  const isRegionSelected = selectedCountry === REGION_CODE;

  // The sub-region filter's own aggregate - every EMBER_SOLAR code the
  // filter currently matches (independent of `rows` above, which is
  // further filtered to whatever has a non-null value for the *current*
  // metric - the region aggregate always draws from the full capacity
  // universe, same as Global does, since "share" hides both rows anyway).
  // Only computed when a filter is actually active; `[]` otherwise, so
  // `regionEmberCountry` below is `null` and the pinned row/detail branch
  // simply don't render.
  const regionCodes = useMemo(
    () => (subregions.length === 0 ? [] : codesForMetric("capacity").filter((code) => subregions.includes(subregionOf(code) ?? ""))),
    [subregions],
  );
  const regionLabel = subregions.length === 1 ? t(`subregions.${subregions[0]}`) : t("sidebar.region");
  const regionEmberCountry = useMemo(
    () => (regionCodes.length > 0 ? aggregateEmberCountries(regionCodes, regionLabel) : null),
    [regionCodes, regionLabel],
  );

  // A country with a real Ember history for either dataset swaps the whole
  // sidebar over to its timeseries (capacity section, then generation-mix
  // section below it if that data exists too - both shown together
  // regardless of which metric is active on the map, per Andrew's
  // instruction 2026-09-09). A country with neither just stays highlighted
  // in the ranking list below. The pinned "Global" row (GLOBAL_CODE) and
  // the sub-region filter's own "Region" row (REGION_CODE) are both
  // structured as their own EmberCountry (lib/globalSolar.ts,
  // lib/aggregateSolar.ts) precisely so either can slot into
  // `selectedEmberCountry` here and render through this same CountryDetail
  // path unchanged - neither has generation-mix data of its own, so
  // selectedGenerationCountry always stays undefined for both.
  const isAggregateSelected = isGlobalSelected || isRegionSelected;
  const selectedEmberCountry = isGlobalSelected
    ? GLOBAL_SOLAR
    : isRegionSelected
      ? (regionEmberCountry ?? undefined)
      : selectedCountry
        ? emberCountry(selectedCountry)
        : undefined;
  const selectedGenerationCountry =
    selectedCountry && !isAggregateSelected ? generationCountry(selectedCountry) : undefined;
  const selectedPopulation = selectedCountry && !isAggregateSelected ? POPULATION[selectedCountry] : undefined;
  const [aggregatePopMinYear, aggregatePopMaxYear] = isRegionSelected
    ? regionPopulationYearRange(regionCodes)
    : regionPopulationYearRange();
  const selectedPopulationValue = isGlobalSelected
    ? regionPopulationActual()
    : isRegionSelected
      ? regionPopulationActual(regionCodes)
      : selectedCountry
        ? populationActual(selectedCountry)
        : null;
  const selectedPopulationTooltip = isAggregateSelected
    ? t("sidebar.worldBankYearRange", { from: aggregatePopMinYear, to: aggregatePopMaxYear })
    : selectedPopulation
      ? t("sidebar.worldBankYear", { year: selectedPopulation.year })
      : undefined;
  const selectedCapacityPerCapita = isGlobalSelected
    ? globalLatestSolarMW() / regionPopulationMillions()
    : isRegionSelected && regionEmberCountry
      ? (latestPointOf(regionEmberCountry).gw * 1000) / regionPopulationMillions(regionCodes)
      : selectedCountry
        ? valueForMetric(selectedCountry, "capacityPerCapita")
        : null;
  // Same latest-point logic CountryDetail.tsx's own headline number and
  // "as of" caption use, read off the same selectedEmberCountry object so
  // this tile and that headline can never disagree - see lib/emberSolar.ts's
  // latestPointOf. `month` is null for an annual-granularity country (or
  // the Global row, always annual), so the tooltip falls back to a
  // year-only "as of" the same way CountryDetail.tsx's own annual branch
  // does.
  const selectedLatestPoint = selectedEmberCountry ? latestPointOf(selectedEmberCountry) : null;
  // Global's, a region's and a compared selection's own numbers are all a
  // computed aggregate, not something Ember itself publishes - see
  // CountryDetail.tsx's own attributeToEmber prop - so their tooltip drops
  // the "- Ember" credit the real-country keys carry.
  const selectedLatestCapacityTooltip = selectedLatestPoint
    ? selectedLatestPoint.month !== null
      ? t(isAggregateSelected ? "detail.asOfMonth" : "detail.asOfMonthEmber", {
          month: monthAbbrev(selectedLatestPoint.month, i18n.language),
          year: selectedLatestPoint.year,
        })
      : t(isAggregateSelected ? "detail.asOfYear" : "detail.asOfYearEmber", { year: selectedLatestPoint.year })
    : undefined;

  if (selectedCountry && (selectedEmberCountry || selectedGenerationCountry)) {
    // Compare mode's own row of panels replaces the single-country body
    // below once at least one comparator has been added. The outer
    // `DetailHeader` (flag + name + back arrow) is dropped for that case
    // rather than kept above the row - per Andrew's own instruction
    // 2026-10-13 ("the block that contains the country name and x is not
    // the same as the original one"): keeping both meant the primary
    // country's name appeared twice, in two differently-padded header
    // blocks that didn't line up with each other or with the comparator
    // panels' own headers below them. A bare back arrow replaces it
    // instead, so every panel's own header (same padding as the old
    // `DetailHeader`, including the primary's) is the only place a name
    // appears, and all of them - headers and the charts below them -
    // start at the same height. The "+" entry point itself still moves
    // from the header's own trailing slot (nothing compared yet) to the
    // end of the panel row (something already is) - see ComparePicker's
    // own doc comment for why it stays an add-only control either place.
    const canCompare = member && !isAggregateSelected;
    const comparing = canCompare && compareCountries.length > 0;
    return (
      <Box data-tour="country-detail" sx={PANEL_SX}>
        {comparing ? (
          <Box sx={{ display: "flex", alignItems: "center", p: 1, borderBottom: "1px solid", borderColor: "divider" }}>
            <Tooltip title={t("sidebar.backToRanking")}>
              <IconButton size="small" onClick={() => onSelect(null)}>
                <ArrowBackIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        ) : (
          <DetailHeader
            onBack={() => onSelect(null)}
            backTooltip={t("sidebar.backToRanking")}
            flag={
              isAggregateSelected ? (
                <PublicIcon sx={{ fontSize: 22, color: "primary.main" }} />
              ) : (
                <FlagImg code={selectedCountry} size={22} />
              )
            }
            name={
              isGlobalSelected
                ? t("sidebar.global")
                : isRegionSelected
                  ? regionLabel
                  : jurisdictionName(selectedCountry, i18n.language)
            }
            sx={{ borderBottom: "1px solid", borderColor: "divider" }}
          >
            {canCompare && (
              <ComparePicker
                excludeCodes={[selectedCountry]}
                maxCount={MAX_COMPARE_COUNTRIES}
                atMax={compareCountries.length >= MAX_COMPARE_COUNTRIES}
                onAdd={onAddCompare}
              />
            )}
          </DetailHeader>
        )}

        {comparing ? (
          <Box sx={{ flex: 1, overflow: "hidden", display: "flex" }}>
            <Box sx={{ flex: 1, overflowX: "auto", display: "flex", alignItems: "flex-start" }}>
              <ComparePanel code={selectedCountry} color={PRIMARY_SERIES_COLOR} />
              {compareCountries.map((code, i) => (
                <ComparePanel key={code} code={code} color={compareColorFor(i)} onRemove={() => onRemoveCompare(code)} />
              ))}
              {compareCountries.length < MAX_COMPARE_COUNTRIES && (
                <Box sx={{ p: 2, display: "flex", alignItems: "center", flexShrink: 0 }}>
                  <ComparePicker
                    excludeCodes={[selectedCountry, ...compareCountries]}
                    maxCount={MAX_COMPARE_COUNTRIES}
                    atMax={compareCountries.length >= MAX_COMPARE_COUNTRIES}
                    onAdd={onAddCompare}
                  />
                </Box>
              )}
            </Box>
          </Box>
        ) : (
        <Box sx={{ p: 2, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
          {/* Population, the "capacityPerCapita" metric the map itself can
              show, and the latest installed-capacity figure, as a row of
              stat tiles - so a visitor sees all three regardless of which
              metric is active on the map. A per-capita reading is
              meaningless without knowing the population it's dividing by,
              hence showing that pair together rather than either alone. See
              lib/population.ts / World Bank; map.perCapita's copy is reused
              for consistency with the map's own tooltip. The capacity
              tile's tooltip carries the Ember "as of" date - the one place
              in this row a reader might reasonably ask how current a
              number is, so that's where it's surfaced rather than as a
              separate label of its own. */}
          {(selectedPopulationValue !== null || selectedCapacityPerCapita !== null || selectedLatestPoint) && (
            <Box sx={{ display: "flex", gap: 1 }}>
              {selectedPopulationValue !== null && (
                <StatTile
                  label={t("sidebar.populationLabel")}
                  value={selectedPopulationValue.toLocaleString(i18n.language)}
                  tooltip={selectedPopulationTooltip}
                />
              )}
              {selectedCapacityPerCapita !== null && (
                <StatTile
                  label={t("sidebar.perCapitaLabel")}
                  value={t("map.perCapita", { value: selectedCapacityPerCapita.toFixed(selectedCapacityPerCapita < 1 ? 2 : 0) })}
                />
              )}
              {selectedLatestPoint && (
                <StatTile
                  label={t("sidebar.latestCapacityLabel")}
                  value={`${selectedLatestPoint.gw.toLocaleString()} GW`}
                  tooltip={selectedLatestCapacityTooltip}
                />
              )}
            </Box>
          )}

          {/* Same country, elsewhere - Deployment Explorer only shows
              uptake, not the policy environment behind it or the grid
              context around it, so these link straight out to both other
              tools instead of leaving that as a dead end. Policy Explorer
              actually opens on this country (?country=<code>, added to
              that app 2026-09-10); Future Grid Simulator only links to its
              homepage for now - it's an external site with no documented
              per-country URL of its own to deep-link into. Neither makes
              sense for the pinned "Global" row or the sub-region filter's
              own "Region" row - there's no single country code to
              deep-link either tool into - so both this and the GSC-members
              tile below are skipped for both. */}
          {!isAggregateSelected && (
            <>
              <Box sx={{ display: "flex", gap: 1 }}>
                <CrossLinkTile
                  href={`${import.meta.env.BASE_URL}policy/?country=${selectedCountry}`}
                  label={t("sidebar.policyExplorer")}
                  accent="#008194"
                />
                <CrossLinkTile
                  href="https://futuregridsimulator.globalsolarcouncil.org/"
                  label={t("sidebar.futureGridSimulator")}
                  accent="#C98600"
                />
              </Box>

              <ComingSoonTile label={t("sidebar.connectWithGscMembers")} />
            </>
          )}

          {selectedEmberCountry && (
            <CountryDetail country={selectedEmberCountry} attributeToEmber={!isAggregateSelected} />
          )}
          {selectedGenerationCountry && <GenerationDetail country={selectedGenerationCountry} />}

          <LockedMetricsSection countryCode={selectedCountry} />
        </Box>
        )}
      </Box>
    );
  }

  return (
    <Box sx={PANEL_SX}>
      <Box sx={{ p: 2, pb: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
        {/* Hidden on mobile only - dropped there 2026-09-10 per Andrew's
            instruction (it duplicated TopNavbar.tsx's own title right
            above it on that layout); kept on desktop, where the sidebar
            sits beside the map rather than under the header, so it isn't
            an immediate duplicate there. Restored 2026-09-11 after being
            dropped from both layouts by mistake. */}
        {!isMobile && (
          <Typography sx={{ fontSize: "1.375rem", fontWeight: 700, color: "text.primary", lineHeight: 1.2, mb: 0.5 }}>
            {t("sidebar.heading")}
          </Typography>
        )}
        <Typography variant="body2" sx={{ mb: 1.5 }}>
          <strong>{t("sidebar.descriptionIntro")}</strong>{" "}
          {metric === "share" ? t("sidebar.descriptionShare") : t("sidebar.descriptionCapacity")}
        </Typography>

        {/* Ported onto the shared `FilterBar`/`ContinentFilter` 2026-09-28,
            per Andrew's own instruction ("this should use a common
            element") when calculator gained its own filter box - confirmed
            byte-identical shell to policy's own ScoreboardFilters.tsx
            before this. */}
        <FilterBar
          active={filtersActive}
          expanded={filtersExpanded}
          onToggleExpanded={() => setFiltersExpanded((v) => !v)}
          onClear={() => onSubregionsChange([])}
          sortDesc={desc}
          onToggleSort={() => setDesc((v) => !v)}
          labels={{
            filter: t("sidebar.filter"),
            hideFilters: t("sidebar.hideFilters"),
            clear: t("sidebar.clear"),
            sortAscending: t("sidebar.lowToHigh"),
            sortDescending: t("sidebar.highToLow"),
          }}
        >
          <ContinentFilter
            value={subregions}
            onChange={onSubregionsChange}
            label={t("sidebar.regionFilterLabel")}
            allLabel={t("sidebar.allRegions")}
            // The UN geoscheme's own 22 sub-regions, not the six-continent
            // list `ContinentFilter` otherwise defaults to - per Andrew's
            // own instruction 2026-10-14 ("implement a filter not on
            // continent but on United Nations geoscheme").
            options={SUBREGIONS}
            // Selected values stay the raw English SUBREGIONS strings
            // (subregionOf()/matching logic depends on that), only the
            // rendered label is translated - t() with no matching key
            // falls back to the raw key, but every value here always has
            // one (see the `subregions` block in common.json).
            translate={(c) => t(`subregions.${c}`)}
            // Single sub-region at a time - the map zooms to fit whatever's
            // selected (DeploymentMap.tsx), and that only reads as "zoom in
            // here" for one region, not a scattered union of several.
            // Per Andrew's own instruction 2026-10-14 ("this means we can
            // only filter to one item at a time").
            multiple={false}
          />
        </FilterBar>
      </Box>

      <Box data-tour="ranking-list" sx={{ flex: 1, overflowY: "auto", p: 2 }}>
        {/* Pinned "Global" row - the world's own total (or per-capita)
            installed capacity, always first regardless of the sort/filter
            controls above (it isn't part of `rows`, so neither touches it).
            Shown for "Installed Capacity" and "Per Capita" - both are real,
            additive-then-divided global figures (see
            globalLatestSolarMW/regionPopulationMillions). Skipped for
            "Share of Electricity": a % share is already relative, not
            additive, and there's no computed global generation total to
            divide by the way there is a computed global capacity one. */}
        {metric !== "share" && (
          <PinnedAggregateRow
            onClick={() => onSelect(GLOBAL_CODE)}
            label={t("sidebar.global")}
            value={
              metric === "capacityPerCapita"
                ? `${(globalLatestSolarMW() / regionPopulationMillions()).toFixed(0)} W/cap`
                : `${globalLatestSolarMW().toLocaleString()} MW`
            }
          />
        )}

        {/* The sub-region filter's own aggregate row - same tile, same
            pinned position, one country's worth of it built live from
            whatever the filter currently matches (lib/aggregateSolar.ts)
            rather than every country. Added 2026-09-30 per Andrew's own
            instruction ("when we filter we want a new sidebar element
            (same style as global) that shows the deployment metrics for
            the filtered region"). Same "share" skip as Global, plus its
            own: nothing to show while no filter is active, or if the
            filter matched no EMBER_SOLAR-covered country at all. */}
        {metric !== "share" && subregions.length > 0 && regionEmberCountry && (
          <PinnedAggregateRow
            onClick={() => onSelect(REGION_CODE)}
            label={regionLabel}
            value={
              metric === "capacityPerCapita"
                ? `${((latestPointOf(regionEmberCountry).gw * 1000) / regionPopulationMillions(regionCodes)).toFixed(0)} W/cap`
                : `${(latestPointOf(regionEmberCountry).gw * 1000).toLocaleString()} MW`
            }
          />
        )}

        {/* Ported onto the shared `RankedRow` 2026-09-19, per Andrew's own
            instruction ("the tiles used to rank countries should be the
            same") - matches ep_policymap's Scoreboard.tsx row style
            exactly (#E5E7EB border, 8px radius, action.hover fill). */}
        <Stack spacing={0.75}>
          {rows.map((r, i) => (
            <RankedRow
              key={r.code}
              rank={i + 1}
              flag={<FlagImg code={r.code} size={16} />}
              name={r.name}
              value={
                <Typography variant="body2" noWrap sx={{ fontWeight: 700, color: "primary.dark", flexShrink: 0 }}>
                  {metric === "share"
                    ? `${r.value!.toFixed(1)}%`
                    : metric === "capacityPerCapita"
                      ? `${r.value!.toFixed(0)} W/cap`
                      : `${r.value!.toLocaleString()} MW`}
                </Typography>
              }
              selected={r.code === selectedCountry}
              onClick={() => onSelect(r.code)}
            />
          ))}
        </Stack>
        {rows.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
            {t("sidebar.noMatches")}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
