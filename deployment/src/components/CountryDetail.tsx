import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

import TimeseriesChart from "./TimeseriesChart";
import type { EmberCountry } from "../lib/emberSolar";
import { monthAbbrev } from "../lib/formatMonth";

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
  const { t, i18n } = useTranslation();

  if (country.granularity === "monthly") {
    const { series } = country;
    const latest = series[series.length - 1];
    const points = series.map((p) => ({
      value: p.gw,
      label: `${monthAbbrev(p.month, i18n.language)} ${p.year}`,
    }));

    return (
      <Box>
        <Typography variant="overline" sx={{ display: "block", color: "text.secondary" }}>
          {t("detail.installedCapacity")}
        </Typography>
        <Typography sx={{ fontSize: "1.75rem", fontWeight: 700, color: "primary.dark", lineHeight: 1.2 }}>
          {latest.gw.toLocaleString()} GW
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t("detail.asOfMonthEmber", { month: monthAbbrev(latest.month, i18n.language), year: latest.year })}
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
        {t("detail.installedCapacity")}
      </Typography>
      <Typography sx={{ fontSize: "1.75rem", fontWeight: 700, color: "primary.dark", lineHeight: 1.2 }}>
        {latest.gw.toLocaleString()} GW
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t("detail.asOfYearEmber", { year: latest.year })}
      </Typography>

      <TimeseriesChart points={points} />
    </Box>
  );
}
