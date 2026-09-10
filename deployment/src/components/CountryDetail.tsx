import { Box, Typography } from "@mui/material";

import TimeseriesChart from "./TimeseriesChart";
import type { EmberCountry } from "../lib/emberSolar";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface Props {
  country: EmberCountry;
}

/**
 * Installed-capacity section of a country's detail panel - one of up to
 * two sections Sidebar.tsx stacks (this one, then GenerationDetail below
 * it if that data exists too), not a standalone view of its own any more.
 *
 * Renders one of two shapes depending on `country.granularity` (see
 * lib/emberSolar.ts) - a monthly country gets a "Mon YYYY" x-axis and its
 * headline date is a specific month; an annual country gets a plain "YYYY"
 * x-axis (same convention as GenerationDetail's own chart) and its
 * headline reads "as of YYYY", not a specific month it doesn't have.
 */
export default function CountryDetail({ country }: Props) {
  if (country.granularity === "monthly") {
    const { series } = country;
    const latest = series[series.length - 1];
    const points = series.map((p) => ({ value: p.gw, label: `${MONTHS[p.month - 1]} ${p.year}` }));

    return (
      <Box>
        <Typography variant="overline" sx={{ display: "block", color: "text.secondary" }}>
          Installed solar capacity
        </Typography>
        <Typography sx={{ fontSize: "1.75rem", fontWeight: 700, color: "primary.dark", lineHeight: 1.2 }}>
          {latest.gw.toLocaleString()} GW
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          as of {MONTHS[latest.month - 1]} {latest.year} - Ember
        </Typography>

        <TimeseriesChart points={points} />
      </Box>
    );
  }

  const { annualSeries } = country;
  const latest = annualSeries[annualSeries.length - 1];
  const points = annualSeries.map((p) => ({ value: p.gw, label: String(p.year) }));

  return (
    <Box>
      <Typography variant="overline" sx={{ display: "block", color: "text.secondary" }}>
        Installed solar capacity
      </Typography>
      <Typography sx={{ fontSize: "1.75rem", fontWeight: 700, color: "primary.dark", lineHeight: 1.2 }}>
        {latest.gw.toLocaleString()} GW
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        as of {latest.year} - Ember
      </Typography>

      <TimeseriesChart points={points} />
    </Box>
  );
}
