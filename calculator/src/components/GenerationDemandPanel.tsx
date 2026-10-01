import { useState } from "react";
import { Box, IconButton, Tooltip, Typography, useTheme } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

import GenerationTimeseries from "./GenerationTimeseries";
import GroupedBarChart from "./GroupedBarChart";
import MultiLineChart from "./MultiLineChart";
import { Stat } from "./ResultsPanel";
import SankeyDiagram from "./SankeyDiagram";
import StackedAreaChart from "./StackedAreaChart";
import StackedBarChart from "./StackedBarChart";
import type { StackedSeries } from "./StackedBarChart";
import { getDispatchColors } from "../lib/dispatchColors";
import {
  MONTH_NAMES,
  MONTH_START_DAY,
  daysInMonth,
  dayLabel,
  dayRangeLabel,
  hoursForRange,
  monthlyTotals,
} from "../lib/timeAggregates";
import type { DispatchHourly, HourlyProfile } from "../lib/types";

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

type FlowKey = Exclude<keyof DispatchHourly, "batteryLevelPct">;

/**
 * Drill state for both chart pairs on this tab - `null` is the top-level
 * monthly view, `"hour"` is a month's full hourly view (reached by clicking
 * a month's bars, no intermediate daily level). Replaces the former
 * always-both "Monthly total" + "Daily across the year" pair of charts
 * with one click-to-drill chart, per Andrew's own instruction 2026-09-30
 * ("combine Monthly total and daily... click on a month and it loads up
 * the view for that month"), then simplified to skip an intermediate daily
 * level entirely - a month's bars jump straight to its hourly view - per a
 * same-day follow-up instruction ("skip the day by day review when we
 * click month and go straight to a line") that applied the generation/
 * demand pair's own shortcut to the dispatch pair too, once a stacked-bar
 * daily level had briefly existed there for comparison. The hourly chart
 * type itself still differs per pair: generation/demand uses a plain line
 * chart (`MultiLineChart`, two independent magnitudes - nothing to stack);
 * dispatch went line chart -> stacked area chart the same day ("it should
 * be a stacked area") since its five flows genuinely sum to a meaningful
 * total, unlike generation vs demand.
 */
type DrillState = { level: "hour"; start: number; end: number } | null;

/** Tick/tooltip label helpers for the hourly drill-down view - identical shape needed by both chart pairs, so pulled out rather than duplicated. */
function hourTickLabel(start: number, end: number) {
  return (i: number) => {
    const dayCount = end - start + 1;
    if (dayCount <= 1) return HOUR_TICKS.includes(i) ? `${String(i).padStart(2, "0")}:00` : null;
    if (i % 24 !== 0) return null;
    const dayOffset = i / 24;
    const tickEvery = Math.max(1, Math.ceil(dayCount / 8));
    return dayOffset % tickEvery === 0 ? dayLabel(start + dayOffset) : null;
  };
}
function hourTooltipLabel(start: number, end: number) {
  return (i: number) => {
    const dayCount = end - start + 1;
    const hh = `${String(i % 24).padStart(2, "0")}:00`;
    return dayCount <= 1 ? hh : `${dayLabel(start + Math.floor(i / 24))} ${hh}`;
  };
}
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
 * Builds the five stacked series - four positive-sign, one negative - from
 * one already-bucketed set of totals. Battery charge stacks positive (per
 * Andrew's own instruction 2026-09-17, "lets show battery charging as
 * +ve") - charging is an active, positive use of solar (storing it for
 * later), not something to lump in with export as "left the system"; only
 * solar export (energy that left the site entirely, unused) stays
 * negative, below the axis.
 */
function buildDispatchSeries(bucketed: Record<FlowKey, number[]>, colors: ReturnType<typeof getDispatchColors>): StackedSeries[] {
  return [
    { label: "Solar to demand", color: colors.solarToDemand, values: bucketed.solarToDemand, sign: 1 },
    { label: "Battery discharge", color: colors.batteryDischarge, values: bucketed.batteryDischarge, sign: 1 },
    { label: "Solar to battery", color: colors.batteryCharge, values: bucketed.batteryCharge, sign: 1 },
    { label: "Grid", color: colors.gridImport, values: bucketed.gridImport, sign: 1 },
    { label: "Solar export", color: colors.solarExport, values: bucketed.solarExport, sign: -1 },
  ];
}

/**
 * On every view of the dispatch chart (monthly and hourly), per Andrew's
 * own instruction 2026-09-18 ("show export above as +ve and with a
 * transparency on it", "same on monthly total", then "on Daily dispatch
 * across the year, exports should be +ve and the same transparent red use
 * elsewhere" - the drill-down had been missed the first time round): solar
 * export stacks on top, positive, at reduced opacity rather than below the
 * axis at full opacity - a deliberate exception everywhere this shows up,
 * not a change to the underlying sign/color convention `buildDispatchSeries`
 * itself still returns. The hourly view uses a noticeably higher
 * transparency than the monthly view's default (`exportOpacity`, per
 * Andrew's own instruction 2026-09-30, "a relatively high transparence") -
 * at hourly resolution the export peaks are tall and frequent, so a more
 * transparent fill keeps the stack underneath (what the home actually
 * used) legible rather than visually dominating it.
 */
function withExportAboveAxis(series: StackedSeries[], exportOpacity = 0.4): StackedSeries[] {
  return series.map((s) => (s.label === "Solar export" ? { ...s, sign: 1, opacity: exportOpacity } : s));
}

function bucketAllDispatch(dispatch: DispatchHourly, bucket: (p: HourlyProfile) => number[]): Record<FlowKey, number[]> {
  return {
    solarToDemand: bucket(dispatch.solarToDemand),
    batteryCharge: bucket(dispatch.batteryCharge),
    batteryDischarge: bucket(dispatch.batteryDischarge),
    gridImport: bucket(dispatch.gridImport),
    solarExport: bucket(dispatch.solarExport),
  };
}

/**
 * The merged "Generation & Demand" tab - originally just the monthly/daily
 * generation-vs-demand comparison (per Andrew's own instruction
 * 2026-09-17: "combine generation and demand tabs... show generation and
 * demand on the same charts"), then absorbed the whole former Dispatch tab
 * on top of that per Andrew's own instruction 2026-09-30 ("move all of
 * dispatch to generation and demand and remove dispatch") - the headline
 * tiles, Sankey diagram, monthly/daily dispatch breakdown and battery
 * state-of-charge chart all moved here verbatim from the deleted
 * DispatchPanel.tsx, with its own "From solar"/"From grid" tiles replaced
 * by the three Andrew asked for instead (used in home / imported from grid
 * / exported - a full annual energy balance at a glance, not just the two
 * self-consumption-focused numbers Dispatch used to open with).
 *
 * Per Andrew's own instruction the same day: everything below the
 * generation/demand chart (monthly dispatch, dispatch across the year, the
 * Sankey diagram and battery state of charge) is member-only, fully
 * hidden rather than a locked teaser - a non-member still gets the full
 * generation/demand picture and the three headline tiles, just not the
 * hour-by-hour dispatch breakdown. The Sankey diagram ("Annual energy
 * flow") was also moved below "Dispatch across the year" in this same
 * pass.
 *
 * Both chart pairs (generation/demand, dispatch) were further merged from
 * two always-visible charts ("Monthly total" + "Daily across the year")
 * into one click-to-drill chart per Andrew's own instruction the same day
 * - see `DrillState`'s own doc comment for the full history (a daily-bar
 * level was tried for dispatch, then dropped in favour of jumping straight
 * from a month's bars to its full hourly line chart, matching generation/
 * demand's own shortcut).
 */
export default function GenerationDemandPanel({
  generationProfile,
  demandProfile,
  dispatch,
  member,
}: {
  generationProfile: HourlyProfile;
  demandProfile: HourlyProfile;
  dispatch: DispatchHourly;
  member: boolean;
}) {
  const theme = useTheme();
  const genColor = theme.palette.mode === "dark" ? GENERATION_COLOR_DARK : GENERATION_COLOR_LIGHT;
  const demColor = theme.palette.mode === "dark" ? DEMAND_COLOR_DARK : DEMAND_COLOR_LIGHT;
  const dispatchColors = getDispatchColors(theme.palette.mode);

  const [genZoom, setGenZoom] = useState<DrillState>(null);
  const [dispatchZoom, setDispatchZoom] = useState<DrillState>(null);

  const monthlySeries = [
    { label: "Generation", color: genColor, values: monthlyTotals(generationProfile) },
    { label: "Demand", color: demColor, values: monthlyTotals(demandProfile) },
  ];

  const monthlyDispatchSeries = buildDispatchSeries(bucketAllDispatch(dispatch, monthlyTotals), dispatchColors);

  const usedInHomeKWh = Math.round(
    dispatch.solarToDemand.reduce((sum, v) => sum + v, 0) +
      dispatch.batteryDischarge.reduce((sum, v) => sum + v, 0) +
      dispatch.gridImport.reduce((sum, v) => sum + v, 0),
  );
  const importedKWh = Math.round(dispatch.gridImport.reduce((sum, v) => sum + v, 0));
  const exportedKWh = Math.round(dispatch.solarExport.reduce((sum, v) => sum + v, 0));

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3, width: "100%" }}>
      <Typography variant="h5">
        Generation &amp; demand
      </Typography>
      <Typography variant="body2" color="text.secondary">
        The 8760-hour output of this system alongside the home's own demand, and how solar, the battery and the grid connection cover it, hour by hour.
      </Typography>

      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
        <Stat label="Used in home" value={`${usedInHomeKWh.toLocaleString()} kWh`} />
        <Stat label="Imported from grid" value={`${importedKWh.toLocaleString()} kWh`} />
        <Stat label="Exported" value={`${exportedKWh.toLocaleString()} kWh`} />
      </Box>

      <Legend series={monthlySeries} />

      <Box data-tour="generation-demand-chart">
        {genZoom === null ? (
          <>
            <Typography variant="overline" sx={{ display: "block", color: "text.secondary", mb: 1 }}>
              Monthly total
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Click a month to see its own hourly breakdown.
            </Typography>
            <GroupedBarChart
              series={monthlySeries}
              bucketCount={12}
              tickLabel={(i) => MONTH_NAMES[i]}
              tooltipLabel={(i) => MONTH_NAMES[i]}
              onRangeSelect={(start) => setGenZoom({ level: "hour", start: MONTH_START_DAY[start], end: MONTH_START_DAY[start] + daysInMonth(start) - 1 })}
            />
          </>
        ) : (
          <>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 1 }}>
              <Tooltip title="Back to year">
                <IconButton size="small" onClick={() => setGenZoom(null)}>
                  <ArrowBackIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Typography variant="overline" sx={{ display: "block", color: "text.secondary" }}>{dayRangeLabel(genZoom.start, genZoom.end)} - hourly</Typography>
            </Box>
            <MultiLineChart
              series={[
                { label: "Generation", color: genColor, values: hoursForRange(generationProfile, genZoom.start, genZoom.end) },
                { label: "Demand", color: demColor, values: hoursForRange(demandProfile, genZoom.start, genZoom.end) },
              ]}
              bucketCount={(genZoom.end - genZoom.start + 1) * 24}
              tickLabel={hourTickLabel(genZoom.start, genZoom.end)}
              tooltipLabel={hourTooltipLabel(genZoom.start, genZoom.end)}
            />
          </>
        )}
      </Box>

      {member && (
        <>
          <Box>
            {dispatchZoom === null ? (
              <>
                <Typography variant="overline" sx={{ display: "block", color: "text.secondary", mb: 1 }}>
                  Monthly dispatch
                </Typography>
                <Legend series={monthlyDispatchSeries} />
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Click a month to see its own hourly breakdown.
                </Typography>
                <StackedBarChart
                  series={withExportAboveAxis(monthlyDispatchSeries)}
                  bucketCount={12}
                  tickLabel={(i) => MONTH_NAMES[i]}
                  tooltipLabel={(i) => MONTH_NAMES[i]}
                  onRangeSelect={(start) => setDispatchZoom({ level: "hour", start: MONTH_START_DAY[start], end: MONTH_START_DAY[start] + daysInMonth(start) - 1 })}
                />
              </>
            ) : (
              <>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 1 }}>
                  <Tooltip title="Back to year">
                    <IconButton size="small" onClick={() => setDispatchZoom(null)}>
                      <ArrowBackIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Typography variant="overline" sx={{ display: "block", color: "text.secondary" }}>{dayRangeLabel(dispatchZoom.start, dispatchZoom.end)} - hourly</Typography>
                </Box>
                <Legend series={monthlyDispatchSeries} />
                {dispatchZoom.end - dispatchZoom.start + 1 > 1 && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Click or drag to zoom into a day or range of days.
                  </Typography>
                )}
                <StackedAreaChart
                  key={`${dispatchZoom.start}-${dispatchZoom.end}`}
                  series={withExportAboveAxis(
                    buildDispatchSeries(
                      bucketAllDispatch(dispatch, (p) => hoursForRange(p, dispatchZoom.start, dispatchZoom.end)),
                      dispatchColors,
                    ),
                    0.2,
                  )}
                  bucketCount={(dispatchZoom.end - dispatchZoom.start + 1) * 24}
                  tickLabel={hourTickLabel(dispatchZoom.start, dispatchZoom.end)}
                  tooltipLabel={hourTooltipLabel(dispatchZoom.start, dispatchZoom.end)}
                  onRangeSelect={
                    dispatchZoom.end - dispatchZoom.start + 1 > 1
                      ? (a, b) =>
                          setDispatchZoom({
                            level: "hour",
                            start: dispatchZoom.start + Math.floor(a / 24),
                            end: dispatchZoom.start + Math.floor(b / 24),
                          })
                      : undefined
                  }
                />
              </>
            )}
          </Box>

          <Box>
            <Typography variant="overline" sx={{ display: "block", color: "text.secondary", mb: 1 }}>
              Annual energy flow
            </Typography>
            <SankeyDiagram dispatch={dispatch} />
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
              color={dispatchColors.batteryDischarge}
              aggregate="average"
              unit="%"
              axisLabel="State of Charge, %"
              maxValue={100}
            />
          </Box>
        </>
      )}
    </Box>
  );
}
