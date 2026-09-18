import { useEffect, useState } from "react";
import { Box, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";

import FlagImg from "./FlagImg";
import { loadCountryIrradiance } from "../lib/countryIrradiance";
import { countryCodeOf, jurisdictionName } from "../lib/jurisdictions";
import { METRIC_LABELS, formatMetricValue, loadMetricValues, loadSelfSufficiencyTiers } from "../lib/mapMetrics";
import type { Metric } from "../lib/mapMetrics";

interface Row {
  code: string;
  name: string;
  value: number;
  lat: number;
  lon: number;
  /** Only set for the selfSufficiency metric - see `loadSelfSufficiencyTiers`'s own doc comment. */
  lowHighLabel?: string;
}

// kWp per panel for a 500Wp panel - the row value formatMetricValue would
// otherwise show (kWh/kWp/yr, panel-size-agnostic) is scaled down to
// kWh/panel/yr here instead, per Andrew's own instruction 2026-09-18
// ("Update the numbers to be kW/panel/year") - "per panel" is easier to
// picture than the abstract "per kWp" figure, at the cost of only being
// exactly right for a 500Wp panel (hence the header's own "(based on
// 500Wp panel)" qualifier, added the same instruction).
const KWP_PER_PANEL = 0.5;

function formatGenerationRow(kWhPerKWp: number): string {
  return `${Math.round(kWhPerKWp * KWP_PER_PANEL).toLocaleString()} kWh/panel/yr`;
}

/**
 * The default (no-location) sidebar's ranked country list, per Andrew's
 * own instruction 2026-09-16 ("we need a league table of countries like
 * on deployment explorer in the sidebar") - same card-list shape as
 * Deployment Explorer's own `Sidebar.tsx` ranking view (rank number, flag,
 * name, value; sortable ascending/descending; a row click selects that
 * country exactly like a map click). Simpler than deployment's own version
 * - no continent filter, no pinned "Global" row, since neither concept
 * exists here yet. Each row's own displayed value differs by metric:
 * generation shows kWh/panel/yr for a 500Wp panel (`formatGenerationRow`),
 * self-sufficiency shows a low-high range across the three precomputed
 * system tiers rather than the single medium figure the list is actually
 * ranked by (`r.lowHighLabel` - see `loadSelfSufficiencyTiers`'s own doc
 * comment for why).
 *
 * Re-fetches whenever `metric` changes (via `loadMetricValues`, which
 * shares its cache with WorldMap.tsx's own copy for "generation" - see
 * lib/countryIrradiance.ts's own module-level cache - so switching the map
 * metric selector doesn't trigger a second download of the ~10MB
 * irradiance dataset).
 */
export default function CountryLeagueTable({
  metric,
  onSelect,
}: {
  metric: Metric;
  onSelect: (params: { code: string; name: string; lat: number; lon: number }) => void;
}) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [desc, setDesc] = useState(true);

  useEffect(() => {
    let mounted = true;
    Promise.all([loadMetricValues(metric), loadCountryIrradiance()]).then(([values, irradiance]) => {
      if (!mounted) return;
      // Ranked (and coloured on the map) by the medium tier alone, but
      // each row also shows its own low-high range, per Andrew's own
      // instruction 2026-09-18 ("show low-high value instead of mid, but
      // just rank on the mid") - see loadSelfSufficiencyTiers's own doc
      // comment.
      const tiers = metric === "selfSufficiency" ? loadSelfSufficiencyTiers() : null;
      const built: Row[] = [];
      for (const [code, value] of Object.entries(values)) {
        const entry = irradiance[code];
        if (!entry) continue; // no representative point to select/fly to - skip rather than guess
        const lowHighLabel = tiers ? `${tiers[code].low} to ${tiers[code].high}%` : undefined;
        built.push({ code, name: jurisdictionName(code), value, lat: entry.lat, lon: entry.lon, lowHighLabel });
      }
      setRows(built);
    });
    return () => {
      mounted = false;
    };
  }, [metric]);

  const sorted = rows ? [...rows].sort((a, b) => (desc ? b.value - a.value : a.value - b.value)) : null;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 2, pb: 1 }}>
        <Typography variant="subtitle2" color="text.secondary">
          {/* "(based on 500Wp panel)" qualifier added 2026-09-18 per
              Andrew's own instruction - the generation metric's own row
              values are shown per-panel here (see formatGenerationRow
              below), so the header needs to say what "panel" means. */}
          Ranked by {METRIC_LABELS[metric].toLowerCase()}
          {metric === "generation" && " (based on 500Wp panel)"}
        </Typography>
        <Tooltip title={desc ? "Sort ascending" : "Sort descending"}>
          <IconButton size="small" onClick={() => setDesc((d) => !d)}>
            {desc ? <ArrowDownwardIcon fontSize="small" /> : <ArrowUpwardIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Box>

      <Box sx={{ flex: 1, overflowY: "auto", px: 2, pb: 2 }}>
        <Stack spacing={0.75}>
          {sorted?.map((r, i) => (
            <Box
              key={r.code}
              onClick={() => onSelect({ code: r.code, name: r.name, lat: r.lat, lon: r.lon })}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.25,
                pl: 1.25,
                pr: 1,
                py: 0.9,
                borderRadius: "8px",
                border: "1px solid",
                borderColor: "divider",
                cursor: "pointer",
                bgcolor: "action.hover",
                transition: "background-color 120ms ease",
                "&:hover": { bgcolor: "action.selected" },
              }}
            >
              <Typography
                variant="caption"
                sx={{ width: 20, textAlign: "right", fontWeight: 600, flexShrink: 0, color: "text.secondary" }}
              >
                {i + 1}
              </Typography>
              <FlagImg code={countryCodeOf(r.code)} size={16} />
              <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0, fontWeight: 600 }}>
                {r.name}
              </Typography>
              <Typography variant="body2" noWrap sx={{ fontWeight: 700, color: "primary.dark", flexShrink: 0 }}>
                {metric === "generation"
                  ? formatGenerationRow(r.value)
                  : (r.lowHighLabel ?? formatMetricValue(metric, r.value))}
              </Typography>
            </Box>
          ))}
        </Stack>
      </Box>
    </Box>
  );
}
