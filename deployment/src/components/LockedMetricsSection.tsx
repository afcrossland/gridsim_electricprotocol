import { Box, Typography } from "@mui/material";

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
const METRICS: { key: string; title: string; color: string; from: number; to: number }[] = [
  { key: "workforce", title: "Workforce", color: "#00ABBB", from: 2, to: 45 },
  { key: "cost", title: "Cost", color: "#FBB114", from: 4.2, to: 0.6 },
  { key: "solar-target", title: "Solar target", color: "#7AC8C1", from: 1, to: 60 },
  { key: "auction-price", title: "Auction price", color: "#C98600", from: 110, to: 22 },
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
  return (
    <Box>
      <Typography variant="overline" sx={{ display: "block", color: "text.secondary", mb: 1 }}>
        More for GSC members
      </Typography>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
        {METRICS.map((m) => (
          <LockedMetricChart
            key={m.key}
            title={m.title}
            color={m.color}
            points={syntheticSeries(`${countryCode}-${m.key}`, 2010, 2024, m.from, m.to)}
          />
        ))}
      </Box>
    </Box>
  );
}
