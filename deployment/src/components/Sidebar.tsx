import { useMemo, useState } from "react";
import { Autocomplete, Box, Checkbox, Stack, TextField, Tooltip, Typography, useTheme } from "@mui/material";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PublicIcon from "@mui/icons-material/Public";
import { useTranslation } from "react-i18next";

import CountryDetail from "./CountryDetail";
import GenerationDetail from "./GenerationDetail";
import LockedMetricsSection from "./LockedMetricsSection";
import ContinentFilter from "../../../shared/components/ContinentFilter";
import DetailHeader from "../../../shared/components/DetailHeader";
import FilterBar from "../../../shared/components/FilterBar";
import FlagImg from "../../../shared/components/FlagImg";
import RankedRow from "../../../shared/components/RankedRow";
import { aggregateEmberCountries } from "../lib/aggregateSolar";
import { emberCountry, latestPointOf } from "../lib/emberSolar";
import { generationCountry } from "../lib/emberGeneration";
import { monthAbbrev } from "../lib/formatMonth";
import { GLOBAL_CODE, GLOBAL_SOLAR, globalLatestSolarMW } from "../lib/globalSolar";
import { jurisdictionName, continentOf } from "../lib/jurisdictions";
import { codesForMetric, valueForMetric, type Metric } from "../lib/metrics";
import { POPULATION, populationActual, regionPopulationActual, regionPopulationMillions, regionPopulationYearRange } from "../lib/population";

interface Props {
  metric: Metric;
  selectedCountry: string | null;
  onSelect: (code: string | null) => void;
  /** Hides the "Solar Deployment Explorer" heading below - only on mobile, where it sits directly under TopNavbar's own copy of the same title and reads as an immediate duplicate. On desktop the sidebar is beside the map, not under the header, so the heading still earns its place there. */
  isMobile?: boolean;
  /** Shows the member-only "Compare countries" multi-select in the filter panel - see its own doc comment below. */
  member: boolean;
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
function CrossLinkTile({ href, label, accent }: { href: string; label: string; accent: string }) {
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
        textAlign: "center",
        gap: 1,
      }}
    >
      <Typography sx={{ fontWeight: 800, fontSize: "0.8125rem", color: accent, lineHeight: 1.25 }}>
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
 */
function StatTile({ label, value, tooltip }: { label: string; value: string; tooltip?: string }) {
  const content = (
    <Box
      sx={{
        flex: 1,
        borderRadius: "12px",
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
        p: 1.5,
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
        }}
      >
        {label}
      </Typography>
      <Typography sx={{ fontWeight: 800, fontSize: "1rem", color: "text.primary", lineHeight: 1.2 }}>
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

/** Pseudo-jurisdiction code for the continent filter's own pinned aggregate row - see `GLOBAL_CODE`'s own doc comment for the same reasoning, just scoped to whatever the filter currently matches instead of every country. */
const REGION_CODE = "REGION";

/** Pseudo-jurisdiction code for the member-only "Compare countries" multi-select's own pinned aggregate row - see `GLOBAL_CODE`'s own doc comment for the same reasoning, just scoped to a hand-picked set of countries instead of a continent. */
const MULTI_CODE = "SELECTION";

/**
 * The pinned "Global" row and the continent filter's own "Region" row share
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
export default function Sidebar({ metric, selectedCountry, onSelect, isMobile, member }: Props) {
  const { t, i18n } = useTranslation();
  const [continents, setContinents] = useState<string[]>([]);
  // Member-only "Compare countries" multi-select (added 2026-09-30, per
  // Andrew's own instruction "we should also be able to select multiple
  // countries... a member-only country multi-select, sitting right next to
  // the existing continent dropdown") - any hand-picked set of countries
  // gets the exact same pinned-aggregate-row treatment as the continent
  // filter's own "Region" row (`aggregateEmberCountries`,
  // `regionPopulationActual`), just fed a chosen code list instead of a
  // continent-filtered one. Kept deliberately distinct from the footer's
  // own single-country "Search countries" box (a *different* action - jump
  // straight to one country's own page, not build an aggregate of several)
  // rather than merged into it, so the two don't read as duplicates of each
  // other.
  const [multiCodes, setMultiCodes] = useState<string[]>([]);
  const [desc, setDesc] = useState(true);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const filtersActive = continents.length > 0 || multiCodes.length > 0;

  const rows = useMemo(() => {
    return codesForMetric(metric)
      .map((code) => ({
        code,
        name: jurisdictionName(code, i18n.language),
        continent: continentOf(code),
        value: valueForMetric(code, metric),
      }))
      .filter((r) => continents.length === 0 || (r.continent && continents.includes(r.continent)))
      .filter((r) => r.value !== null)
      .sort((a, b) => (desc ? b.value! - a.value! : a.value! - b.value!));
  }, [metric, continents, desc, i18n.language]);

  const isGlobalSelected = selectedCountry === GLOBAL_CODE;
  const isRegionSelected = selectedCountry === REGION_CODE;
  const isMultiSelected = selectedCountry === MULTI_CODE;

  // The continent filter's own aggregate - every EMBER_SOLAR code the
  // filter currently matches (independent of `rows` above, which is
  // further filtered to whatever has a non-null value for the *current*
  // metric - the region aggregate always draws from the full capacity
  // universe, same as Global does, since "share" hides both rows anyway).
  // Only computed when a filter is actually active; `[]` otherwise, so
  // `regionEmberCountry` below is `null` and the pinned row/detail branch
  // simply don't render.
  const regionCodes = useMemo(
    () => (continents.length === 0 ? [] : codesForMetric("capacity").filter((code) => continents.includes(continentOf(code) ?? ""))),
    [continents],
  );
  const regionLabel = continents.length === 1 ? t(`continents.${continents[0]}`) : t("sidebar.region");
  const regionEmberCountry = useMemo(
    () => (regionCodes.length > 0 ? aggregateEmberCountries(regionCodes, regionLabel) : null),
    [regionCodes, regionLabel],
  );

  // The "Compare countries" multi-select's own aggregate - same mechanism
  // as the region one above, just fed `multiCodes` (hand-picked, member
  // only) instead of a continent-filtered list. `multiCountryOptions` is
  // the same "every EMBER_SOLAR code, alphabetical" universe policy's own
  // ScoreboardFilters.tsx country Autocomplete uses for the same control.
  const multiCountryOptions = useMemo(
    () =>
      codesForMetric("capacity")
        .map((code) => ({ code, name: jurisdictionName(code, i18n.language) }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [i18n.language],
  );
  const selectedMultiOptions = multiCountryOptions.filter((o) => multiCodes.includes(o.code));
  const multiLabel =
    multiCodes.length === 0
      ? ""
      : multiCodes.length <= 2
        ? multiCodes.map((c) => jurisdictionName(c, i18n.language)).join(", ")
        : t("sidebar.countriesSelected", { count: multiCodes.length });
  const multiEmberCountry = useMemo(
    () => (multiCodes.length > 0 ? aggregateEmberCountries(multiCodes, multiLabel) : null),
    [multiCodes, multiLabel],
  );

  // A country with a real Ember history for either dataset swaps the whole
  // sidebar over to its timeseries (capacity section, then generation-mix
  // section below it if that data exists too - both shown together
  // regardless of which metric is active on the map, per Andrew's
  // instruction 2026-09-09). A country with neither just stays highlighted
  // in the ranking list below. The pinned "Global" row (GLOBAL_CODE), the
  // continent filter's own "Region" row (REGION_CODE) and the "Compare
  // countries" multi-select's own row (MULTI_CODE, added 2026-09-30) are
  // all structured as their own EmberCountry (lib/globalSolar.ts,
  // lib/aggregateSolar.ts) precisely so any of them can slot into
  // `selectedEmberCountry` here and render through this same CountryDetail
  // path unchanged - none has generation-mix data of its own, so
  // selectedGenerationCountry always stays undefined for all three.
  const isAggregateSelected = isGlobalSelected || isRegionSelected || isMultiSelected;
  const selectedEmberCountry = isGlobalSelected
    ? GLOBAL_SOLAR
    : isRegionSelected
      ? (regionEmberCountry ?? undefined)
      : isMultiSelected
        ? (multiEmberCountry ?? undefined)
        : selectedCountry
          ? emberCountry(selectedCountry)
          : undefined;
  const selectedGenerationCountry =
    selectedCountry && !isAggregateSelected ? generationCountry(selectedCountry) : undefined;
  const selectedPopulation = selectedCountry && !isAggregateSelected ? POPULATION[selectedCountry] : undefined;
  const [aggregatePopMinYear, aggregatePopMaxYear] = isRegionSelected
    ? regionPopulationYearRange(regionCodes)
    : isMultiSelected
      ? regionPopulationYearRange(multiCodes)
      : regionPopulationYearRange();
  const selectedPopulationValue = isGlobalSelected
    ? regionPopulationActual()
    : isRegionSelected
      ? regionPopulationActual(regionCodes)
      : isMultiSelected
        ? regionPopulationActual(multiCodes)
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
      : isMultiSelected && multiEmberCountry
        ? (latestPointOf(multiEmberCountry).gw * 1000) / regionPopulationMillions(multiCodes)
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
    return (
      <Box data-tour="country-detail" sx={PANEL_SX}>
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
                : isMultiSelected
                  ? multiLabel
                  : jurisdictionName(selectedCountry, i18n.language)
          }
          sx={{ borderBottom: "1px solid", borderColor: "divider" }}
        />
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
              sense for the pinned "Global" row or the continent filter's
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
          onClear={() => {
            setContinents([]);
            setMultiCodes([]);
          }}
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
            value={continents}
            onChange={setContinents}
            label={t("sidebar.continent")}
            allLabel={t("sidebar.allContinents")}
            // Selected values stay the raw English CONTINENTS strings
            // (continentOf()/matching logic depends on that), only the
            // rendered label is translated - t() with no matching key
            // falls back to the raw key, but every value here always has
            // one (see the `continents` block in common.json).
            translate={(c) => t(`continents.${c}`)}
          />

          {/* Member-only "Compare countries" - see this component's own
              state comment above for why this lives here rather than
              merged into the footer's own single-country search. Hidden
              entirely for a non-member rather than shown locked/blurred -
              a filter-panel control is minor enough that a persistent
              "Members only" teaser here would just be clutter for the
              majority of visitors, unlike the map's own Global Simulator
              view. */}
          {member && (
            <Autocomplete
              multiple
              disableCloseOnSelect
              size="small"
              options={multiCountryOptions}
              value={selectedMultiOptions}
              getOptionLabel={(o) => o.name}
              isOptionEqualToValue={(a, b) => a.code === b.code}
              onChange={(_, next) => setMultiCodes(next.map((o) => o.code))}
              sx={{ mt: 1.5, width: "100%" }}
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
              renderInput={(params) => <TextField {...params} label={t("sidebar.compareCountries")} />}
            />
          )}
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

        {/* The continent filter's own aggregate row - same tile, same
            pinned position, one country's worth of it built live from
            whatever the filter currently matches (lib/aggregateSolar.ts)
            rather than every country. Added 2026-09-30 per Andrew's own
            instruction ("when we filter we want a new sidebar element
            (same style as global) that shows the deployment metrics for
            the filtered region"). Same "share" skip as Global, plus its
            own: nothing to show while no filter is active, or if the
            filter matched no EMBER_SOLAR-covered country at all. */}
        {metric !== "share" && continents.length > 0 && regionEmberCountry && (
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

        {/* The "Compare countries" multi-select's own aggregate row - same
            tile again, built from a hand-picked set of countries instead of
            a continent. Member-only (the control that populates
            `multiCodes` is itself hidden for a non-member, so this simply
            never has anything to show for one). Added 2026-09-30. */}
        {metric !== "share" && member && multiCodes.length > 0 && multiEmberCountry && (
          <PinnedAggregateRow
            onClick={() => onSelect(MULTI_CODE)}
            label={multiLabel}
            value={
              metric === "capacityPerCapita"
                ? `${((latestPointOf(multiEmberCountry).gw * 1000) / regionPopulationMillions(multiCodes)).toFixed(0)} W/cap`
                : `${(latestPointOf(multiEmberCountry).gw * 1000).toLocaleString()} MW`
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
