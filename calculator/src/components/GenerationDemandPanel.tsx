import { useState } from "react";
import { Box, IconButton, Tooltip, Typography, useTheme } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

import DualMonthlyBarChart from "./DualMonthlyBarChart";
import MultiLineChart from "./MultiLineChart";
import type { LineSeries } from "./MultiLineChart";
import { MONTH_NAMES, MONTH_START_DAY, dailyTotals, dayLabel, dayRangeLabel, hoursForRange, monthlyTotals } from "../lib/timeAggregates";
import type { HourlyProfile } from "../lib/types";

const HOUR_TICKS = [0, 6, 12, 18];

// Same GSC yellow (Generation) / GSC teal (Demand) as when these were two
// separate tabs (GenerationPanel.tsx/DemandPanel.tsx) - kept identical so
// the merge (per Andrew's own instruction 2026-09-17: "combine generation
// and demand tabs... show generation and demand on the same charts") isn't
// also silently a rebrand.
const GENERATION_COLOR_LIGHT = "#FBB114";
const GENERATION_COLOR_DARK = "#D4960F";
const DEMAND_COLOR_LIGHT = "#00ABBB";
const DEMAND_COLOR_DARK = "#008194";

function Legend({ series }: { series: { label: string; color: string }[] }) {
  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
      {series.map((s) => (
        <Box key={s.label} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Box sx={{ width: 9, height: 9, borderRadius: "2px", bgcolor: s.color, flexShrink: 0 }} />
          <Typography variant="caption" color="text.secondary">
            {s.label}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

/**
 * The merged "Generation & Demand" tab (replacing the two separate
 * Generation/Demand tabs) - per Andrew's own instruction 2026-09-17: a
 * monthly-totals grouped bar chart above a year-long daily line chart you
 * can click or drag to zoom into, both showing generation and demand on
 * the same axes so they're directly comparable, not two separate charts.
 * Demand here is the real profile the calculation's own dispatch ran
 * against (`results.demandProfile`), not the old Demand tab's fixed
 * illustrative 4,000 kWh/yr shape - so the two series are always the same
 * system, never a real generation curve next to an unrelated demand one.
 */
export default function GenerationDemandPanel({
  generationProfile,
  demandProfile,
}: {
  generationProfile: HourlyProfile;
  demandProfile: HourlyProfile;
}) {
  const theme = useTheme();
  const genColor = theme.palette.mode === "dark" ? GENERATION_COLOR_DARK : GENERATION_COLOR_LIGHT;
  const demColor = theme.palette.mode === "dark" ? DEMAND_COLOR_DARK : DEMAND_COLOR_LIGHT;

  const [selectedRange, setSelectedRange] = useState<{ start: number; end: number } | null>(null);

  const monthlySeries: [{ label: string; color: string; monthlyValues: number[] }, { label: string; color: string; monthlyValues: number[] }] = [
    { label: "Generation", color: genColor, monthlyValues: monthlyTotals(generationProfile) },
    { label: "Demand", color: demColor, monthlyValues: monthlyTotals(demandProfile) },
  ];

  const dailySeries: LineSeries[] = [
    { label: "Generation", color: genColor, values: dailyTotals(generationProfile) },
    { label: "Demand", color: demColor, values: dailyTotals(demandProfile) },
  ];

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3, width: "100%" }}>
      <Typography variant="h5">
        Generation &amp; demand
      </Typography>
      <Typography variant="body2" color="text.secondary">
        The 8760-hour output of this system alongside the home's own demand, for the same year.
      </Typography>

      <Legend series={monthlySeries} />

      <Box>
        <Typography variant="overline" sx={{ display: "block", color: "text.secondary", mb: 1 }}>
          Monthly total
        </Typography>
        <DualMonthlyBarChart series={monthlySeries} />
      </Box>

      <Box>
        <Typography variant="overline" sx={{ display: "block", color: "text.secondary", mb: 1 }}>
          Daily across the year
        </Typography>
        {selectedRange === null ? (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Click or drag to zoom into a day or range of days.
            </Typography>
            <MultiLineChart
              series={dailySeries}
              bucketCount={365}
              tickLabel={(i) => (MONTH_START_DAY.includes(i) ? MONTH_NAMES[MONTH_START_DAY.indexOf(i)] : null)}
              tooltipLabel={dayLabel}
              onRangeSelect={(start, end) => setSelectedRange({ start, end })}
            />
          </>
        ) : (
          <>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 1 }}>
              <Tooltip title="Back to year">
                <IconButton size="small" onClick={() => setSelectedRange(null)}>
                  <ArrowBackIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Typography variant="overline" sx={{ display: "block", color: "text.secondary" }}>{dayRangeLabel(selectedRange.start, selectedRange.end)} - hourly</Typography>
            </Box>
            <MultiLineChart
              series={[
                { label: "Generation", color: genColor, values: hoursForRange(generationProfile, selectedRange.start, selectedRange.end) },
                { label: "Demand", color: demColor, values: hoursForRange(demandProfile, selectedRange.start, selectedRange.end) },
              ]}
              bucketCount={(selectedRange.end - selectedRange.start + 1) * 24}
              tickLabel={(i) => {
                const dayCount = selectedRange.end - selectedRange.start + 1;
                if (dayCount <= 1) return HOUR_TICKS.includes(i) ? `${String(i).padStart(2, "0")}:00` : null;
                if (i % 24 !== 0) return null;
                const dayOffset = i / 24;
                const tickEvery = Math.max(1, Math.ceil(dayCount / 8));
                return dayOffset % tickEvery === 0 ? dayLabel(selectedRange.start + dayOffset) : null;
              }}
              tooltipLabel={(i) => {
                const dayCount = selectedRange.end - selectedRange.start + 1;
                const hh = `${String(i % 24).padStart(2, "0")}:00`;
                return dayCount <= 1 ? hh : `${dayLabel(selectedRange.start + Math.floor(i / 24))} ${hh}`;
              }}
              onRangeSelect={
                selectedRange.end - selectedRange.start + 1 > 1
                  ? (a, b) =>
                      setSelectedRange({
                        start: selectedRange.start + Math.floor(a / 24),
                        end: selectedRange.start + Math.floor(b / 24),
                      })
                  : undefined
              }
            />
          </>
        )}
      </Box>
    </Box>
  );
}
