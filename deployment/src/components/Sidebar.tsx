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
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import FilterListIcon from "@mui/icons-material/FilterList";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

import CountryDetail from "./CountryDetail";
import GenerationDetail from "./GenerationDetail";
import FlagImg from "./FlagImg";
import { emberCountry } from "../lib/emberSolar";
import { generationCountry } from "../lib/emberGeneration";
import { jurisdictionName, CONTINENTS, continentOf } from "../lib/jurisdictions";
import { codesForMetric, valueForMetric, type Metric } from "../lib/metrics";
import { POPULATION } from "../lib/population";

interface Props {
  metric: Metric;
  selectedCountry: string | null;
  onSelect: (code: string | null) => void;
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
        Open
        <OpenInNewIcon sx={{ fontSize: 14 }} />
      </Box>
    </Box>
  );
}

/**
 * Full-width, below the two CrossLinkTile cards - dashed border and muted
 * text rather than the solid brand-accent tile style above it, so it
 * reads as "not built yet" rather than a second working link at a glance.
 * Same "Coming soon" wording convention as the Playbook homepage's own
 * greyed-out Solar Economics Explorer tile (`index.html`'s `.tile.economics`).
 */
function ComingSoonTile({ label }: { label: string }) {
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
        Coming Soon: {label}
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
export default function Sidebar({ metric, selectedCountry, onSelect }: Props) {
  const [continents, setContinents] = useState<string[]>([]);
  const [desc, setDesc] = useState(true);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const filtersActive = continents.length > 0;

  const rows = useMemo(() => {
    return codesForMetric(metric)
      .map((code) => ({
        code,
        name: jurisdictionName(code),
        continent: continentOf(code),
        value: valueForMetric(code, metric),
      }))
      .filter((r) => continents.length === 0 || (r.continent && continents.includes(r.continent)))
      .filter((r) => r.value !== null)
      .sort((a, b) => (desc ? b.value! - a.value! : a.value! - b.value!));
  }, [metric, continents, desc]);

  // A country with a real Ember history for either dataset swaps the whole
  // sidebar over to its timeseries (capacity section, then generation-mix
  // section below it if that data exists too - both shown together
  // regardless of which metric is active on the map, per Andrew's
  // instruction 2026-09-09). A country with neither just stays highlighted
  // in the ranking list below.
  const selectedEmberCountry = selectedCountry ? emberCountry(selectedCountry) : undefined;
  const selectedGenerationCountry = selectedCountry ? generationCountry(selectedCountry) : undefined;
  const selectedPopulation = selectedCountry ? POPULATION[selectedCountry] : undefined;

  if (selectedCountry && (selectedEmberCountry || selectedGenerationCountry)) {
    return (
      <Box data-tour="country-detail" sx={PANEL_SX}>
        <Box sx={{ p: 2, display: "flex", alignItems: "center", gap: 1, borderBottom: "1px solid", borderColor: "divider" }}>
          <Tooltip title="Back to ranking">
            <IconButton size="small" onClick={() => onSelect(null)}>
              <ArrowBackIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <FlagImg code={selectedCountry} size={22} />
          <Typography variant="h2" sx={{ fontSize: "1.125rem", flex: 1, minWidth: 0 }} noWrap>
            {jurisdictionName(selectedCountry)}
          </Typography>
          {/* The population figure the per-capita metric actually divides
              by - shown here rather than only implied by the map, since a
              per-capita reading is meaningless without knowing the
              assumption behind it. See lib/population.ts / World Bank. */}
          {selectedPopulation && (
            <Tooltip title={`World Bank, ${selectedPopulation.year}`}>
              <Typography
                variant="caption"
                sx={{ color: "text.secondary", flexShrink: 0, whiteSpace: "nowrap" }}
              >
                Pop. {selectedPopulation.populationMillions.toLocaleString()}M
              </Typography>
            </Tooltip>
          )}
        </Box>
        <Box sx={{ p: 2, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
          {/* Same country, elsewhere - Deployment Explorer only shows
              uptake, not the policy environment behind it or the grid
              context around it, so these link straight out to both other
              tools instead of leaving that as a dead end. Policy Explorer
              actually opens on this country (?country=<code>, added to
              that app 2026-09-10); Future Grid Simulator only links to its
              homepage for now - it's an external site with no documented
              per-country URL of its own to deep-link into. */}
          <Box sx={{ display: "flex", gap: 1 }}>
            <CrossLinkTile
              href={`${import.meta.env.BASE_URL}policy/?country=${selectedCountry}`}
              label="Solar Policy Explorer"
              accent="#008194"
            />
            <CrossLinkTile
              href="https://futuregridsimulator.globalsolarcouncil.org/"
              label="Future Grid Simulator"
              accent="#C98600"
            />
          </Box>

          <ComingSoonTile label="Connect with GSC Members" />

          {selectedEmberCountry && <CountryDetail country={selectedEmberCountry} />}
          {selectedGenerationCountry && <GenerationDetail country={selectedGenerationCountry} />}
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={PANEL_SX}>
      <Box sx={{ p: 2, pb: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
        {/* No "Solar Deployment Explorer" heading here any more - dropped
            2026-09-10 per Andrew's instruction, it duplicated the app's own
            title in TopNavbar.tsx right above it. */}
        <Typography variant="body2" sx={{ mb: 1.5 }}>
          <strong>Pick a country on the map or in this list</strong> to see{" "}
          {metric === "share"
            ? "what share of that country's own electricity generation solar provides, year by year."
            : "how much solar capacity is actually installed there, and how it compares per capita."}
        </Typography>

        {/* Same collapsed-by-default filter pattern as ep_policymap's
            ScoreboardFilters.tsx - icon + badge dot, "Filter" label, a
            Clear button once something's actually set, sort direction on
            the right. */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Tooltip title={filtersExpanded ? "Hide filters" : "Filter this list"}>
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
            Filter
          </Typography>
          {filtersActive && (
            <Button size="small" onClick={() => setContinents([])} sx={{ fontWeight: 400 }}>
              Clear
            </Button>
          )}

          <Box sx={{ flex: 1 }} />

          <Tooltip title={desc ? "High to low" : "Low to high"}>
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
              label="Continent"
              value={continents}
              onChange={(e) => {
                const value = e.target.value;
                setContinents(typeof value === "string" ? value.split(",") : value);
              }}
              slotProps={{
                select: {
                  multiple: true,
                  renderValue: (selected) =>
                    (selected as string[]).length > 0 ? (selected as string[]).join(", ") : "All continents",
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
                  {c}
                </MenuItem>
              ))}
            </TextField>
          </Box>
        </Collapse>
      </Box>

      <Box data-tour="ranking-list" sx={{ flex: 1, overflowY: "auto", p: 2 }}>
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
            No jurisdictions match this filter.
          </Typography>
        )}
      </Box>
    </Box>
  );
}
