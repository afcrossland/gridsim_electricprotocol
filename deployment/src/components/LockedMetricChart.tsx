import { Box, Typography } from "@mui/material";
import LockIcon from "@mui/icons-material/Lock";
import { useTranslation } from "react-i18next";

import TimeseriesChart, { type TimeseriesPoint } from "./TimeseriesChart";

interface Props {
  title: string;
  points: TimeseriesPoint[];
  color: string;
}

/**
 * A teaser for a metric Deployment Explorer doesn't have real data for yet
 * - Workforce, Cost, Solar target, Auction price (added 2026-09-11 per
 * Andrew's instruction). The title stays legible; only the chart itself is
 * blurred, with a lock + "Members only" overlay on top of it - the point
 * is to show a member-only data card exists, not to leak a readable trend
 * out of synthetic data (see lib/lockedMetrics.ts) that was never real to
 * begin with.
 */
export default function LockedMetricChart({ title, points, color }: Props) {
  const { t } = useTranslation();
  return (
    <Box sx={{ borderRadius: "12px", border: "1px solid", borderColor: "divider", p: 1.5 }}>
      <Typography variant="overline" sx={{ display: "block", color: "text.secondary" }}>
        {title}
      </Typography>
      <Box sx={{ position: "relative", mt: 0.5 }}>
        <Box sx={{ filter: "blur(5px)", pointerEvents: "none", userSelect: "none" }} aria-hidden>
          <TimeseriesChart points={points} color={color} />
        </Box>
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 0.25,
            bgcolor: (theme) => (theme.palette.mode === "dark" ? "rgba(32,39,42,0.45)" : "rgba(255,255,255,0.55)"),
          }}
        >
          <LockIcon sx={{ fontSize: 18, color: "text.secondary" }} />
          <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>
            {t("locked.membersOnly")}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
