import { Box, Typography } from "@mui/material";

import TimeseriesChart from "./TimeseriesChart";
import type { GenerationCountry } from "../lib/emberGeneration";

interface Props {
  country: GenerationCountry;
}

/** 2dp under 10 TWh (where a decimal actually matters), whole numbers above it. */
function formatTWh(value: number): string {
  return value < 10
    ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

/**
 * Generation-mix section of a country's detail panel - stacked below
 * CountryDetail (installed capacity) in Sidebar.tsx when both exist for a
 * country, per Andrew's instruction 2026-09-09, rather than the two being
 * alternative full-panel views switched by the active map metric.
 */
export default function GenerationDetail({ country }: Props) {
  const { series } = country;
  const latest = series[series.length - 1];
  const points = series.map((p) => ({ value: p.sharePct, label: String(p.year) }));

  return (
    <Box>
      <Typography variant="overline" sx={{ display: "block", color: "text.secondary" }}>
        Solar share of generation
      </Typography>
      <Typography sx={{ fontSize: "1.75rem", fontWeight: 700, color: "primary.dark", lineHeight: 1.2 }}>
        {latest.sharePct.toFixed(1)}%
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        of {latest.year}'s electricity generation ({formatTWh(latest.solarTWh)} of{" "}
        {formatTWh(latest.totalTWh)} TWh) - Ember
      </Typography>

      <TimeseriesChart points={points} />
    </Box>
  );
}
