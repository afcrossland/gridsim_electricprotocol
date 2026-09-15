import { useMemo, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Checkbox,
  Collapse,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import FilterListIcon from "@mui/icons-material/FilterList";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PublicIcon from "@mui/icons-material/Public";
import { useTranslation } from "react-i18next";

import CountryDetail from "./CountryDetail";
import GenerationDetail from "./GenerationDetail";
import LockedMetricsSection from "./LockedMetricsSection";
import FlagImg from "./FlagImg";
import { emberCountry, latestPointOf } from "../lib/emberSolar";
import { generationCountry } from "../lib/emberGeneration";
import { monthAbbrev } from "../lib/formatMonth";
import { GLOBAL_CODE, GLOBAL_SOLAR, globalLatestSolarMW } from "../lib/globalSolar";
import { jurisdictionName, CONTINENTS, continentOf } from "../lib/jurisdictions";
import { codesForMetric, valueForMetric, type Metric } from "../lib/metrics";
import { POPULATION, populationActual, worldPopulationActual, worldPopulationMillions, worldPopulationYearRange } from "../lib/population";

interface Props {
  metric: Metric;
  selectedCountry: string | null;
  onSelect: (code: string | null) => void;
  /** Hides the "Solar Deployment Explorer" heading below - only on mobile, where it sits directly under TopNavbar's own copy of the same title and reads as an immediate duplicate. On desktop the sidebar is beside the map, not under the header, so the heading still earns its place there. */
  isMobile?: boolean;
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

/**
 * Ranking + filters, same role as ep_policymap's Scoreboard.tsx +
 * ScoreboardFilters.tsx combined into one (this app has no separate
 * per-country detail view yet to justify splitting them) - a country's own
 * row is what drives both browsing and selecting one on the map.
 */
export default function Sidebar({ metric, selectedCountry, onSelect, isMobile }: Props) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const [continents, setContinents] = useState<string[]>([]);
  const [desc, setDesc] = useState(true);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const filtersActive = continents.length > 0;

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

  // A country with a real Ember history for either dataset swaps the whole
  // sidebar over to its timeseries (capacity section, then generation-mix
  // section below it if that data exists too - both shown together
  // regardless of which metric is active on the map, per Andrew's
  // instruction 2026-09-09). A country with neither just stays highlighted
  // in the ranking list below. The pinned "Global" row (GLOBAL_CODE) is
  // structured as its own EmberCountry (see lib/globalSolar.ts) precisely so
  // it can slot into `selectedEmberCountry` here and render through this
  // same CountryDetail path unchanged - it has no generation-mix data of its
  // own, so selectedGenerationCountry always stays undefined for it.
  const selectedEmberCountry = isGlobalSelected
    ? GLOBAL_SOLAR
    : selectedCountry
      ? emberCountry(selectedCountry)
      : undefined;
  const selectedGenerationCountry =
    selectedCountry && !isGlobalSelected ? generationCountry(selectedCountry) : undefined;
  const selectedPopulation = selectedCountry && !isGlobalSelected ? POPULATION[selectedCountry] : undefined;
  const [worldPopMinYear, worldPopMaxYear] = worldPopulationYearRange();
  const selectedPopulationValue = isGlobalSelected
    ? worldPopulationActual()
    : selectedCountry
      ? populationActual(selectedCountry)
      : null;
  const selectedPopulationTooltip = isGlobalSelected
    ? t("sidebar.worldBankYearRange", { from: worldPopMinYear, to: worldPopMaxYear })
    : selectedPopulation
      ? t("sidebar.worldBankYear", { year: selectedPopulation.year })
      : undefined;
  const selectedCapacityPerCapita = isGlobalSelected
    ? globalLatestSolarMW() / worldPopulationMillions()
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
  // Global's own number is a computed aggregate, not something Ember
  // itself publishes - see CountryDetail.tsx's own attributeToEmber prop -
  // so its tooltip drops the "- Ember" credit the real-country keys carry.
  const selectedLatestCapacityTooltip = selectedLatestPoint
    ? selectedLatestPoint.month !== null
      ? t(isGlobalSelected ? "detail.asOfMonth" : "detail.asOfMonthEmber", {
          month: monthAbbrev(selectedLatestPoint.month, i18n.language),
          year: selectedLatestPoint.year,
        })
      : t(isGlobalSelected ? "detail.asOfYear" : "detail.asOfYearEmber", { year: selectedLatestPoint.year })
    : undefined;

  if (selectedCountry && (selectedEmberCountry || selectedGenerationCountry)) {
    return (
      <Box data-tour="country-detail" sx={PANEL_SX}>
        <Box sx={{ p: 2, display: "flex", alignItems: "center", gap: 1, borderBottom: "1px solid", borderColor: "divider" }}>
          <Tooltip title={t("sidebar.backToRanking")}>
            <IconButton size="small" onClick={() => onSelect(null)}>
              <ArrowBackIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {isGlobalSelected ? (
            <PublicIcon sx={{ fontSize: 22, color: "primary.main" }} />
          ) : (
            <FlagImg code={selectedCountry} size={22} />
          )}
          <Typography variant="h2" sx={{ fontSize: "1.125rem", flex: 1, minWidth: 0 }} noWrap>
            {isGlobalSelected ? t("sidebar.global") : jurisdictionName(selectedCountry, i18n.language)}
          </Typography>
        </Box>
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
              sense for the pinned "Global" row - there's no single country
              code to deep-link either tool into - so both this and the
              GSC-members tile below are skipped for it. */}
          {!isGlobalSelected && (
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
            <CountryDetail country={selectedEmberCountry} attributeToEmber={!isGlobalSelected} />
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

        {/* Same collapsed-by-default filter pattern as ep_policymap's
            ScoreboardFilters.tsx - icon + badge dot, "Filter" label, a
            Clear button once something's actually set, sort direction on
            the right. */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Tooltip title={filtersExpanded ? t("sidebar.hideFilters") : t("sidebar.filterThisList")}>
            <IconButton size="small" onClick={() => setFiltersExpanded((v) => !v)}>
              <Badge color="primary" variant="dot" invisible={!filtersActive}>
                <FilterListIcon fontSize="small" />
              </Badge>
            </IconButton>
          </Tooltip>
          <Typography
            variant="body2"
            onClick={() => setFiltersExpanded((v) => !v)}
            sx={{ cursor: "pointer", userSelect: "none" }}
          >
            {t("sidebar.filter")}
          </Typography>
          {filtersActive && (
            <Button size="small" onClick={() => setContinents([])} sx={{ fontWeight: 400 }}>
              {t("sidebar.clear")}
            </Button>
          )}

          <Box sx={{ flex: 1 }} />

          <Tooltip title={desc ? t("sidebar.highToLow") : t("sidebar.lowToHigh")}>
            <IconButton size="small" onClick={() => setDesc((v) => !v)}>
              {desc ? <ArrowDownwardIcon fontSize="small" /> : <ArrowUpwardIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Box>

        <Collapse in={filtersExpanded}>
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
            <TextField
              select
              size="small"
              label={t("sidebar.continent")}
              value={continents}
              onChange={(e) => {
                const value = e.target.value;
                setContinents(typeof value === "string" ? value.split(",") : value);
              }}
              slotProps={{
                select: {
                  multiple: true,
                  // Selected values stay the raw English CONTINENTS strings
                  // (continentOf()/matching logic depends on that), only the
                  // rendered label is translated - t() with no matching key
                  // falls back to the raw key, but every value here always
                  // has one (see the `continents` block in common.json).
                  renderValue: (selected) =>
                    (selected as string[]).length > 0
                      ? (selected as string[]).map((c) => t(`continents.${c}`)).join(", ")
                      : t("sidebar.allContinents"),
                },
              }}
              sx={{ minWidth: 220, width: "100%" }}
            >
              {CONTINENTS.map((c) => (
                <MenuItem key={c} value={c}>
                  <Checkbox
                    icon={<CheckBoxOutlineBlankIcon fontSize="small" />}
                    checkedIcon={<CheckBoxIcon fontSize="small" />}
                    checked={continents.includes(c)}
                    size="small"
                    sx={{ mr: 1 }}
                  />
                  {t(`continents.${c}`)}
                </MenuItem>
              ))}
            </TextField>
          </Box>
        </Collapse>
      </Box>

      <Box data-tour="ranking-list" sx={{ flex: 1, overflowY: "auto", p: 2 }}>
        {/* Pinned "Global" row - the world's own total (or per-capita)
            installed capacity, always first regardless of the sort/filter
            controls above (it isn't part of `rows`, so neither touches it),
            in a soft aqua tint rather than the ranking rows' plain grey so
            it reads as a different kind of thing, not just the current #1
            entry. Shown for "Installed Capacity" and "Per Capita" - both
            are real, additive-then-divided global figures (see
            globalLatestSolarMW/worldPopulationMillions). Skipped for
            "Share of Electricity": a % share is already relative, not
            additive, and there's no computed global generation total to
            divide by the way there is a computed global capacity one. */}
        {metric !== "share" && (
          <Box
            onClick={() => onSelect(GLOBAL_CODE)}
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
              {t("sidebar.global")}
            </Typography>
            <Typography variant="body2" noWrap sx={{ fontWeight: 700, color: "primary.dark", flexShrink: 0 }}>
              {metric === "capacityPerCapita"
                ? `${(globalLatestSolarMW() / worldPopulationMillions()).toFixed(0)} W/cap`
                : `${globalLatestSolarMW().toLocaleString()} MW`}
            </Typography>
          </Box>
        )}

        {/* Light-grey tiles on the sidebar's own white background, matching
            ep_policymap's Scoreboard.tsx row style exactly (#E5E7EB border,
            8px radius, action.hover fill) rather than the plain
            border-left-highlight rows this used before. */}
        <Stack spacing={0.75}>
          {rows.map((r, i) => {
            const selected = r.code === selectedCountry;
            return (
              <Box
                key={r.code}
                onClick={() => onSelect(r.code)}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.25,
                  pl: 1.25,
                  pr: 1,
                  py: 0.9,
                  borderRadius: "8px",
                  border: "1px solid",
                  borderColor: selected ? "primary.main" : "#E5E7EB",
                  cursor: "pointer",
                  overflow: "hidden",
                  bgcolor: selected ? "action.selected" : "action.hover",
                  transition: "background-color 120ms ease, border-color 120ms ease",
                  "&:hover": { bgcolor: selected ? "action.selected" : "#F3F4F6" },
                }}
              >
                <Typography variant="caption" sx={{ width: 16, textAlign: "right", fontWeight: 600, flexShrink: 0 }}>
                  {i + 1}
                </Typography>
                <FlagImg code={r.code} size={16} />
                <Typography variant="subtitle1" noWrap sx={{ flex: 1, minWidth: 0 }}>
                  {r.name}
                </Typography>
                <Typography variant="body2" noWrap sx={{ fontWeight: 700, color: "primary.dark", flexShrink: 0 }}>
                  {metric === "share"
                    ? `${r.value!.toFixed(1)}%`
                    : metric === "capacityPerCapita"
                      ? `${r.value!.toFixed(0)} W/cap`
                      : `${r.value!.toLocaleString()} MW`}
                </Typography>
              </Box>
            );
          })}
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
