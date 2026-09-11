import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

import LockedMetricChart from "./LockedMetricChart";
import { syntheticSeries } from "../lib/lockedMetrics";

interface Props {
  countryCode: string;
}

// Direction of each metric's placeholder trend is deliberate, not just
// decorative - workforce and solar targets climb, cost and auction price
// fall, matching the real-world shape each of these has actually had
// wherever solar has scaled up. Added 2026-09-11 per Andrew's instruction;
// see lib/lockedMetrics.ts for why the numbers themselves aren't real.
// `titleKey` looks up the translated title in the `locked` namespace
// (common.json) - the metric key itself stays a stable English id used
// for the synthetic series seed, translation is display-only.
const METRICS: { key: string; titleKey: string; color: string; from: number; to: number }[] = [
  { key: "workforce", titleKey: "locked.workforce", color: "#00ABBB", from: 2, to: 45 },
  { key: "cost", titleKey: "locked.cost", color: "#FBB114", from: 4.2, to: 0.6 },
  { key: "solar-target", titleKey: "locked.solarTarget", color: "#7AC8C1", from: 1, to: 60 },
  { key: "auction-price", titleKey: "locked.auctionPrice", color: "#C98600", from: 110, to: 22 },
];

/**
 * Four member-only teaser charts on a country's detail panel, below the
 * real Ember/World Bank ones - Workforce, Cost, Solar target, Auction
 * price. Deployment Explorer has no real data source for any of these yet,
 * so each one is a synthetic, deliberately-blurred line chart (see
 * LockedMetricChart.tsx) rather than a real reading - the point is to show
 * GSC members get more data here, not to actually chart these four things.
 */
export default function LockedMetricsSection({ countryCode }: Props) {
  const { t } = useTranslation();
  return (
    <Box>
      <Typography variant="overline" sx={{ display: "block", color: "text.secondary", mb: 1 }}>
        {t("locked.heading")}
      </Typography>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
        {METRICS.map((m) => (
          <LockedMetricChart
            key={m.key}
            title={t(m.titleKey)}
            color={m.color}
            points={syntheticSeries(`${countryCode}-${m.key}`, 2010, 2024, m.from, m.to)}
          />
        ))}
      </Box>
    </Box>
  );
}
