import { useRef, useState } from "react";
import { Box, IconButton, Tooltip, Typography, useTheme } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

import { MONTH_NAMES, MONTH_START_DAY, dailyAverages, dailyTotals, dayLabel, dayRangeLabel, hoursForRange } from "../lib/timeAggregates";
import { formatAxisValue, niceTicks } from "../lib/chartFormat";
import type { HourlyProfile } from "../lib/types";

const CHART_WIDTH = 400;
const CHART_HEIGHT = 160;
const PAD = { top: 12, right: 12, bottom: 20, left: 34 };
const HOUR_TICKS = [0, 6, 12, 18];

interface Props {
  profile: HourlyProfile;
  color?: string;
  /** "sum" (default) totals each day's 24 hours - right for a flow (kWh generated/consumed). "average" is right for a level quantity (e.g. battery state of charge), where summing 24 hours would be meaningless. */
  aggregate?: "sum" | "average";
  /** Unit shown in tooltips - "kWh" by default, e.g. "%" for a state-of-charge profile. */
  unit?: string;
  /** Descriptive, rotated y-axis label, e.g. "State of Charge, %" - per Andrew's own instruction 2026-09-17 ("all should have a descriptive label"). */
  axisLabel?: string;
  /** Fixes the chart's own y-scale instead of auto-scaling to the data's own max - e.g. 100 for a 0-100% state-of-charge profile, so an always-full or always-empty battery doesn't look like a flat line at an arbitrary height. When set, the axis still snaps to "nice" round ticks up to this ceiling (see lib/chartFormat.ts's own niceTicks). */
  maxValue?: number;
}

/**
 * A year-long daily (or, via `aggregate="average"`, a level quantity's daily
 * average) line - click a single day, or drag across several, to zoom into
 * their hourly values, per Andrew's own instruction 2026-09-16 ("I want to
 * be able to drag to select some days to zoom in on"). A click is just a
 * zero-distance drag (`start === end`), so single-day and multi-day zoom
 * share one interaction, not two. Generalised beyond the Generation tab's
 * own use (which is why the name stuck) to the Demand and Dispatch tabs too
 * - `aggregate`/`unit`/`maxValue` are what let a level quantity like
 * battery state of charge reuse the exact same chart and interaction as a
 * flow quantity.
 */
export default function GenerationTimeseries({
  profile,
  color = "#00ABBB",
  aggregate = "sum",
  unit = "kWh",
  axisLabel = "Energy, kWh",
  maxValue,
}: Props) {
  const [selectedRange, setSelectedRange] = useState<{ start: number; end: number } | null>(null);

  if (selectedRange) {
    const { start, end } = selectedRange;
    const dayCount = end - start + 1;
    const values = hoursForRange(profile, start, end);
    const tickLabel = (i: number) => {
      if (dayCount <= 1) return HOUR_TICKS.includes(i) ? `${String(i).padStart(2, "0")}:00` : null;
      const dayOffset = Math.floor(i / 24);
      if (i % 24 !== 0) return null;
      const tickEvery = Math.max(1, Math.ceil(dayCount / 8));
      return dayOffset % tickEvery === 0 ? dayLabel(start + dayOffset) : null;
    };
    const tooltipLabel = (i: number) => {
      const hourOfDay = i % 24;
      const hh = `${String(hourOfDay).padStart(2, "0")}:00`;
      return dayCount <= 1 ? hh : `${dayLabel(start + Math.floor(i / 24))} ${hh}`;
    };

    return (
      <Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 1 }}>
          <Tooltip title="Back to year">
            <IconButton size="small" onClick={() => setSelectedRange(null)}>
              <ArrowBackIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Typography variant="overline" sx={{ display: "block", color: "text.secondary" }}>
            {dayRangeLabel(start, end)} - hourly
          </Typography>
        </Box>
        <HourlyChart
          key={`${start}-${end}`}
          values={values}
          color={color}
          unit={unit}
          axisLabel={axisLabel}
          maxValue={maxValue}
          tickLabel={tickLabel}
          tooltipLabel={tooltipLabel}
          onSelectDayRange={
            dayCount > 1
              ? (localStart, localEnd) => setSelectedRange({ start: start + localStart, end: start + localEnd })
              : undefined
          }
        />
      </Box>
    );
  }

  const dailyValues = aggregate === "average" ? dailyAverages(profile) : dailyTotals(profile);
  return (
    <DailyChart
      values={dailyValues}
      color={color}
      unit={unit}
      axisLabel={axisLabel}
      maxValue={maxValue}
      onSelectRange={(start, end) => setSelectedRange({ start, end })}
    />
  );
}

function DailyChart({
  values,
  color,
  unit,
  axisLabel,
  maxValue,
  onSelectRange,
}: {
  values: number[];
  color: string;
  unit: string;
  axisLabel: string;
  maxValue?: number;
  onSelectRange: (start: number, end: number) => void;
}) {
  const theme = useTheme();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ start: number; current: number } | null>(null);

  const innerW = CHART_WIDTH - PAD.left - PAD.right;
  const innerH = CHART_HEIGHT - PAD.top - PAD.bottom;
  const rawMax = maxValue ?? Math.max(...values, 1);
  const ticks = niceTicks(rawMax);
  const max = ticks[ticks.length - 1];

  const plotted = values.map((v, i) => ({
    x: PAD.left + (i / (values.length - 1)) * innerW,
    y: PAD.top + innerH - (v / max) * innerH,
  }));
  const linePath = plotted.map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L ${plotted[plotted.length - 1].x.toFixed(1)} ${(PAD.top + innerH).toFixed(1)} L ${plotted[0].x.toFixed(1)} ${(PAD.top + innerH).toFixed(1)} Z`;

  function indexFromClientX(clientX: number): number {
    const svg = svgRef.current;
    if (!svg) return 0;
    const rect = svg.getBoundingClientRect();
    const localX = ((clientX - rect.left) / rect.width) * CHART_WIDTH;
    const frac = (localX - PAD.left) / innerW;
    return Math.max(0, Math.min(values.length - 1, Math.round(frac * (values.length - 1))));
  }

  function handleMouseDown(e: React.MouseEvent<SVGSVGElement>) {
    const idx = indexFromClientX(e.clientX);
    setDrag({ start: idx, current: idx });

    function handleMove(ev: MouseEvent) {
      const i = indexFromClientX(ev.clientX);
      setDrag((d) => (d ? { ...d, current: i } : d));
      setHoverIndex(i);
    }
    function handleUp(ev: MouseEvent) {
      const i = indexFromClientX(ev.clientX);
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      setDrag((d) => {
        // Deferred a tick - calling straight through here can land while
        // React is still mid-render for this same mouseup (StrictMode's own
        // dev-mode double-render surfaces it as a "setState while rendering
        // a different component" warning), even though this callback is
        // itself a native `window` listener, not a React event handler.
        if (d) setTimeout(() => onSelectRange(Math.min(d.start, i), Math.max(d.start, i)), 0);
        return null;
      });
    }
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  }

  const hovered = hoverIndex !== null ? { index: hoverIndex, point: plotted[hoverIndex] } : null;
  const tooltipAnchor = hovered && hovered.point.x > CHART_WIDTH * 0.7 ? "end" : "start";
  const dragDayCount = drag ? Math.abs(drag.current - drag.start) + 1 : 0;

  return (
    <Box sx={{ position: "relative" }}>
      <Box
        component="svg"
        ref={svgRef}
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        sx={{ width: "100%", height: "auto", display: "block", cursor: "pointer", userSelect: "none" }}
        onMouseDown={handleMouseDown}
        onMouseMove={(e) => {
          if (!drag) setHoverIndex(indexFromClientX(e.clientX));
        }}
        onMouseLeave={() => {
          if (!drag) setHoverIndex(null);
        }}
      >
        <text
          x={10}
          y={PAD.top + innerH / 2}
          fontSize={5}
          fill="currentColor"
          opacity={0.55}
          textAnchor="middle"
          transform={`rotate(-90, 10, ${PAD.top + innerH / 2})`}
        >
          {axisLabel}
        </text>

        {ticks.map((tickValue) => {
          const y = PAD.top + innerH * (1 - tickValue / max);
          return (
            <g key={tickValue}>
              <line
                x1={PAD.left}
                x2={CHART_WIDTH - PAD.right}
                y1={y}
                y2={y}
                stroke="currentColor"
                strokeOpacity={tickValue === 0 ? 0.15 : 0.08}
                strokeWidth={1}
              />
              <text x={PAD.left - 4} y={y} dy={2} fontSize={5} fill="currentColor" opacity={0.55} textAnchor="end">
                {formatAxisValue(tickValue)}
              </text>
            </g>
          );
        })}
        <path d={areaPath} fill={color} fillOpacity={0.12} stroke="none" />
        <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {MONTH_START_DAY.map((day, i) => (
          <text
            key={i}
            x={PAD.left + (day / (values.length - 1)) * innerW}
            y={CHART_HEIGHT - 6}
            fontSize={5}
            fill="currentColor"
            opacity={0.55}
            textAnchor={i === 0 ? "start" : "middle"}
          >
            {MONTH_NAMES[i]}
          </text>
        ))}

        {drag && (
          <rect
            x={Math.min(plotted[drag.start].x, plotted[drag.current].x)}
            width={Math.max(1, Math.abs(plotted[drag.current].x - plotted[drag.start].x))}
            y={PAD.top}
            height={innerH}
            fill={color}
            fillOpacity={0.15}
          />
        )}

        {hovered && !drag && (
          <>
            <line
              x1={hovered.point.x}
              x2={hovered.point.x}
              y1={PAD.top}
              y2={PAD.top + innerH}
              stroke="currentColor"
              strokeOpacity={0.25}
              strokeWidth={1}
            />
            <circle
              cx={hovered.point.x}
              cy={hovered.point.y}
              r={4.5}
              fill={color}
              stroke={theme.palette.background.paper}
              strokeWidth={1.5}
            />
          </>
        )}
      </Box>

      {drag && (
        <Box
          sx={{
            position: "absolute",
            top: 4,
            left: `${((plotted[drag.start].x + plotted[drag.current].x) / 2 / CHART_WIDTH) * 100}%`,
            transform: "translateX(-50%)",
            pointerEvents: "none",
            bgcolor: "background.paper",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: "6px",
            boxShadow: 2,
            px: 1,
            py: 0.5,
            whiteSpace: "nowrap",
          }}
        >
          <Box sx={{ fontSize: "0.6875rem", fontWeight: 700, lineHeight: 1.3 }}>
            {dragDayCount} day{dragDayCount === 1 ? "" : "s"} selected
          </Box>
        </Box>
      )}

      {hovered && !drag && (
        <Box
          sx={{
            position: "absolute",
            top: 4,
            left: `${(hovered.point.x / CHART_WIDTH) * 100}%`,
            transform: tooltipAnchor === "end" ? "translateX(-100%)" : "translateX(0)",
            ml: tooltipAnchor === "end" ? "-6px" : "6px",
            pointerEvents: "none",
            bgcolor: "background.paper",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: "6px",
            boxShadow: 2,
            px: 1,
            py: 0.5,
            whiteSpace: "nowrap",
          }}
        >
          <Box sx={{ fontSize: "0.6875rem", fontWeight: 700, lineHeight: 1.3 }}>
            {values[hovered.index].toFixed(1)} {unit}
          </Box>
          <Box sx={{ fontSize: "0.625rem", color: "text.secondary", lineHeight: 1.3 }}>
            {dayLabel(hovered.index)} - click or drag to zoom in
          </Box>
        </Box>
      )}
    </Box>
  );
}

function HourlyChart({
  values,
  color,
  unit,
  axisLabel,
  maxValue,
  tickLabel,
  tooltipLabel,
  onSelectDayRange,
}: {
  values: number[];
  color: string;
  unit: string;
  axisLabel: string;
  maxValue?: number;
  tickLabel: (index: number) => string | null;
  tooltipLabel: (index: number) => string;
  /** When set (a multi-day range is showing), dragging narrows further - offsets are in whole days from this view's own start, so the caller can add them to its own absolute start day. Omitted for a single-day view, where there's nothing finer to zoom to. */
  onSelectDayRange?: (startDayOffset: number, endDayOffset: number) => void;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ start: number; current: number } | null>(null);

  const innerW = CHART_WIDTH - PAD.left - PAD.right;
  const innerH = CHART_HEIGHT - PAD.top - PAD.bottom;
  const rawMax = maxValue ?? Math.max(...values, 1);
  const ticks = niceTicks(rawMax);
  const max = ticks[ticks.length - 1];
  const bucketCount = values.length;
  const rawSlot = innerW / bucketCount;
  const barGap = Math.min(bucketCount > 48 ? 0.5 : 3, rawSlot * 0.3);
  const barWidth = Math.max(0.1, rawSlot - barGap);

  function indexFromClientX(clientX: number): number {
    const svg = svgRef.current;
    if (!svg) return 0;
    const rect = svg.getBoundingClientRect();
    const localX = ((clientX - rect.left) / rect.width) * CHART_WIDTH;
    const frac = (localX - PAD.left) / innerW;
    return Math.max(0, Math.min(bucketCount - 1, Math.floor(frac * bucketCount)));
  }

  function handleMouseDown(e: React.MouseEvent<SVGSVGElement>) {
    const selectDayRange = onSelectDayRange;
    if (!selectDayRange) return;
    const idx = indexFromClientX(e.clientX);
    setDrag({ start: idx, current: idx });

    function handleMove(ev: MouseEvent) {
      const i = indexFromClientX(ev.clientX);
      setDrag((d) => (d ? { ...d, current: i } : d));
      setHoverIndex(i);
    }
    function handleUp(ev: MouseEvent) {
      const i = indexFromClientX(ev.clientX);
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      setDrag((d) => {
        if (d) {
          const a = Math.min(d.start, i);
          const b = Math.max(d.start, i);
          setTimeout(() => selectDayRange!(Math.floor(a / 24), Math.floor(b / 24)), 0);
        }
        return null;
      });
    }
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  }

  const hovered = hoverIndex !== null ? hoverIndex : null;
  const rangeStart = drag ? Math.min(drag.start, drag.current) : 0;
  const rangeCount = drag ? Math.abs(drag.current - drag.start) + 1 : 0;

  return (
    <Box sx={{ position: "relative" }}>
      <Box
        component="svg"
        ref={svgRef}
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        sx={{ width: "100%", height: "auto", display: "block", cursor: onSelectDayRange ? "pointer" : "default", userSelect: "none" }}
        onMouseDown={handleMouseDown}
        onMouseLeave={() => {
          if (!drag) setHoverIndex(null);
        }}
      >
        <text
          x={10}
          y={PAD.top + innerH / 2}
          fontSize={5}
          fill="currentColor"
          opacity={0.55}
          textAnchor="middle"
          transform={`rotate(-90, 10, ${PAD.top + innerH / 2})`}
        >
          {axisLabel}
        </text>

        {ticks.map((tickValue) => {
          const y = PAD.top + innerH * (1 - tickValue / max);
          return (
            <g key={tickValue}>
              <line
                x1={PAD.left}
                x2={CHART_WIDTH - PAD.right}
                y1={y}
                y2={y}
                stroke="currentColor"
                strokeOpacity={tickValue === 0 ? 0.15 : 0.08}
                strokeWidth={1}
              />
              <text x={PAD.left - 4} y={y} dy={2} fontSize={5} fill="currentColor" opacity={0.55} textAnchor="end">
                {formatAxisValue(tickValue)}
              </text>
            </g>
          );
        })}

        {values.map((v, i) => {
          const x = PAD.left + i * (innerW / bucketCount) + barGap / 2;
          const barH = Math.max(1, (v / max) * innerH);
          const y = PAD.top + innerH - barH;
          return (
            <g key={i}>
              <rect
                x={x}
                y={PAD.top}
                width={barWidth}
                height={innerH}
                fill="transparent"
                onMouseEnter={() => setHoverIndex(i)}
              />
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barH}
                rx={2}
                ry={2}
                fill={color}
                opacity={hovered === i ? 1 : 0.85}
                style={{ pointerEvents: "none" }}
              />
            </g>
          );
        })}

        {drag && (
          <rect
            x={PAD.left + rangeStart * (innerW / bucketCount)}
            width={rangeCount * (innerW / bucketCount)}
            y={PAD.top}
            height={innerH}
            fill="currentColor"
            fillOpacity={0.08}
          />
        )}

        {Array.from({ length: bucketCount }, (_, i) => tickLabel(i)).map((label, i) =>
          label === null ? null : (
            <text
              key={i}
              x={PAD.left + i * (innerW / bucketCount)}
              y={CHART_HEIGHT - 6}
              fontSize={5}
              fill="currentColor"
              opacity={0.55}
              textAnchor="start"
            >
              {label}
            </text>
          ),
        )}
      </Box>

      {drag && (
        <Box
          sx={{
            position: "absolute",
            top: 4,
            left: `${((rangeStart + rangeCount / 2) / bucketCount) * 100}%`,
            transform: "translateX(-50%)",
            pointerEvents: "none",
            bgcolor: "background.paper",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: "6px",
            boxShadow: 2,
            px: 1,
            py: 0.5,
            whiteSpace: "nowrap",
          }}
        >
          <Box sx={{ fontSize: "0.6875rem", fontWeight: 700, lineHeight: 1.3 }}>
            {Math.floor(rangeStart / 24) === Math.floor((rangeStart + rangeCount - 1) / 24)
              ? "1 day selected"
              : `${Math.floor((rangeStart + rangeCount - 1) / 24) - Math.floor(rangeStart / 24) + 1} days selected`}
          </Box>
        </Box>
      )}

      {hovered !== null && !drag && (
        <Box
          sx={{
            position: "absolute",
            top: 4,
            left: `${((hovered + 0.5) / bucketCount) * 100}%`,
            transform: "translateX(-50%)",
            pointerEvents: "none",
            bgcolor: "background.paper",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: "6px",
            boxShadow: 2,
            px: 1,
            py: 0.5,
            whiteSpace: "nowrap",
          }}
        >
          <Box sx={{ fontSize: "0.6875rem", fontWeight: 700, lineHeight: 1.3 }}>
            {values[hovered].toFixed(2)} {unit}
          </Box>
          <Box sx={{ fontSize: "0.625rem", color: "text.secondary", lineHeight: 1.3 }}>{tooltipLabel(hovered)}</Box>
        </Box>
      )}
    </Box>
  );
}
