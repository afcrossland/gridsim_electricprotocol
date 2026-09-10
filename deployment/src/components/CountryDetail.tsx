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
 */
export default function CountryDetail({ country }: Props) {
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
