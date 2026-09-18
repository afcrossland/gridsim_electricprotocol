import { useState } from "react";
import { Box, IconButton, Tooltip, Typography, useTheme } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

import GenerationTimeseries from "./GenerationTimeseries";
import { Stat } from "./ResultsPanel";
import SankeyDiagram from "./SankeyDiagram";
import StackedAreaChart from "./StackedAreaChart";
import StackedBarChart from "./StackedBarChart";
import type { StackedSeries } from "./StackedBarChart";
import { getDispatchColors } from "../lib/dispatchColors";
import { MONTH_NAMES, MONTH_START_DAY, dailyTotals, dayLabel, dayRangeLabel, hoursForRange, monthlyTotals } from "../lib/timeAggregates";
import type { DispatchHourly, HourlyProfile } from "../lib/types";

const HOUR_TICKS = [0, 6, 12, 18];

type FlowKey = Exclude<keyof DispatchHourly, "batteryLevelPct">;

/**
 * Builds the five stacked series - four positive-sign, one negative - from
 * one already-bucketed set of totals. Battery charge stacks positive (per
 * Andrew's own instruction 2026-09-17, "lets show battery charging as
 * +ve") - charging is an active, positive use of solar (storing it for
 * later), not something to lump in with export as "left the system"; only
 * solar export (energy that left the site entirely, unused) stays
 * negative, below the axis.
 */
function buildSeries(bucketed: Record<FlowKey, number[]>, colors: ReturnType<typeof getDispatchColors>): StackedSeries[] {
  return [
    { label: "Solar to demand", color: colors.solarToDemand, values: bucketed.solarToDemand, sign: 1 },
    { label: "Battery discharge", color: colors.batteryDischarge, values: bucketed.batteryDischarge, sign: 1 },
    { label: "Solar to battery", color: colors.batteryCharge, values: bucketed.batteryCharge, sign: 1 },
    { label: "Grid", color: colors.gridImport, values: bucketed.gridImport, sign: 1 },
    { label: "Solar export", color: colors.solarExport, values: bucketed.solarExport, sign: -1 },
  ];
}

/**
 * On "Monthly total" and every view under "Daily dispatch across the
 * year" (its own un-zoomed daily view AND its hourly drill-down), per
 * Andrew's own instruction 2026-09-18 ("show export above as +ve and with
 * a transparency on it", "same on monthly total", then "on Daily dispatch
 * across the year, exports should be +ve and the same transparent red use
 * elsewhere" - the drill-down had been missed the first time round):
 * solar export stacks on top, positive, at reduced opacity rather than
 * below the axis at full opacity - a deliberate exception everywhere on
 * this tab, not a change to the underlying sign/color convention
 * `buildSeries` itself still returns.
 */
function withExportAboveAxis(series: StackedSeries[]): StackedSeries[] {
  return series.map((s) => (s.label === "Solar export" ? { ...s, sign: 1, opacity: 0.4 } : s));
}

function bucketAll(dispatch: DispatchHourly, bucket: (p: HourlyProfile) => number[]): Record<FlowKey, number[]> {
  return {
    solarToDemand: bucket(dispatch.solarToDemand),
    batteryCharge: bucket(dispatch.batteryCharge),
    batteryDischarge: bucket(dispatch.batteryDischarge),
    gridImport: bucket(dispatch.gridImport),
    solarExport: bucket(dispatch.solarExport),
  };
}

/**
 * Repeated above every chart section on this tab (Monthly total, Daily
 * dispatch across the year - covering both its zoomed and un-zoomed
 * states) rather than shown once at the top, per Andrew's own instruction
 * 2026-09-18 ("i feel it is hard to see the graphs on dispatch... do we
 * need more legends?") - a single legend near the Sankey diagram left
 * anyone scrolled down to a chart further below with no colour key in
 * view, worse now that solar export's own sign/opacity changes between
 * sections (see `withExportAboveAxis`).
 */
function Legend({ series }: { series: StackedSeries[] }) {
  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, mb: 1 }}>
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
 * The Dispatch tab: hour-by-hour breakdown of how solar, the battery and the
 * grid connection cover demand, per Andrew's own instruction 2026-09-16 -
 * solar meeting demand directly, battery charge and discharge, grid
 * import, and solar export, all sharing one signed stacking scheme so
 * their relative sizes are directly comparable across two mark types:
 * "Monthly total" stays a stacked bar chart (StackedBarChart.tsx - per
 * Andrew's own instruction 2026-09-18, "the monthly total to return to a
 * stacked bar chart as it was before"), while the daily-across-the-year
 * view and its hourly drill-down use a smoothed stacked area
 * (StackedAreaChart.tsx, added the same day - "can we do as a stacked
 * area... referring to charts on dispatch, keep bars elsewhere" - the
 * monthly view was later carved back out of that).
 * Solar export is the only negative-sign (below-the-axis) series - battery
 * charge stacks positive (per Andrew's own instruction 2026-09-17, see
 * `buildSeries`'s own doc comment). Same monthly-total + click-to-zoom-hourly
 * structure as the Generation and Demand tabs, for visual consistency
 * across all three. A third chart below shows the battery's own state of
 * charge (%) - a level quantity, not a flow, so it reuses
 * GenerationTimeseries (via its `aggregate="average"`/`unit`/`axisLabel`/
 * `maxValue` options) rather than the signed stacked chart above.
 *
 * The "From solar"/"From grid" tiles and the Sankey diagram (both moved
 * here from the Economics tab, and new respectively, per Andrew's own
 * instruction 2026-09-17) come first - a headline summary of the same
 * annual totals the charts below break down hour by hour.
 */
export default function DispatchPanel({ dispatch }: { dispatch: DispatchHourly }) {
  const theme = useTheme();
  const colors = getDispatchColors(theme.palette.mode);
  const [selectedRange, setSelectedRange] = useState<{ start: number; end: number } | null>(null);

  const monthlySeries = buildSeries(bucketAll(dispatch, monthlyTotals), colors);
  const dailySeries = buildSeries(bucketAll(dispatch, dailyTotals), colors);

  const selfConsumedKWh = Math.round(
    dispatch.solarToDemand.reduce((sum, v) => sum + v, 0) + dispatch.batteryDischarge.reduce((sum, v) => sum + v, 0),
  );
  const fromGridKWh = Math.round(dispatch.gridImport.reduce((sum, v) => sum + v, 0));

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3, width: "100%" }}>
      <Typography variant="h5">
        Dispatch
      </Typography>
      <Typography variant="body2" color="text.secondary">
        How solar, the battery and the grid connection cover the typical home's own demand, hour by hour.
      </Typography>

      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
        <Stat label="From solar" value={`${selfConsumedKWh.toLocaleString()} kWh`} />
        <Stat label="From grid" value={`${fromGridKWh.toLocaleString()} kWh`} />
      </Box>

      <Box>
        <Typography variant="overline" sx={{ display: "block", color: "text.secondary", mb: 1 }}>
          Annual energy flow
        </Typography>
        <SankeyDiagram dispatch={dispatch} />
      </Box>

      <Box>
        <Typography variant="overline" sx={{ display: "block", color: "text.secondary", mb: 1 }}>
          Monthly total
        </Typography>
        <Legend series={monthlySeries} />
        <StackedBarChart
          series={withExportAboveAxis(monthlySeries)}
          bucketCount={12}
          tickLabel={(i) => MONTH_NAMES[i]}
          tooltipLabel={(i) => MONTH_NAMES[i]}
        />
      </Box>

      <Box>
        <Typography variant="overline" sx={{ display: "block", color: "text.secondary", mb: 1 }}>
          Daily dispatch across the year
        </Typography>
        <Legend series={dailySeries} />
        {selectedRange === null ? (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Click or drag to zoom into a day or range of days.
            </Typography>
            <StackedAreaChart
              series={withExportAboveAxis(dailySeries)}
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
            <StackedAreaChart
              key={`${selectedRange.start}-${selectedRange.end}`}
              series={withExportAboveAxis(
                buildSeries(
                  bucketAll(dispatch, (p) => hoursForRange(p, selectedRange.start, selectedRange.end)),
                  colors,
                ),
              )}
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

      <Box>
        <Typography variant="overline" sx={{ display: "block", color: "text.secondary", mb: 1 }}>
          Battery state of charge
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Click or drag to zoom into a day or range of days.
        </Typography>
        <GenerationTimeseries
          profile={dispatch.batteryLevelPct}
          color={colors.batteryDischarge}
          aggregate="average"
          unit="%"
          axisLabel="State of Charge, %"
          maxValue={100}
        />
      </Box>
    </Box>
  );
}
