import { useRef, useState } from "react";
import { Box } from "@mui/material";

import { formatAxisValue, niceTicks } from "../lib/chartFormat";

export interface StackedSeries {
  label: string;
  color: string;
  /** Non-negative magnitudes, one per bucket - `sign` decides which side of the zero axis they stack on. */
  values: number[];
  sign: 1 | -1;
  /** Per-series fill-opacity override (StackedAreaChart.tsx only, ignored by this bar chart) - e.g. a lower value to visually set a series apart from the rest of the stack, see DispatchPanel.tsx's own "Solar export" override on the daily view. */
  opacity?: number;
}

interface Props {
  series: StackedSeries[];
  bucketCount: number;
  /** Tick label for a bucket index, or null to leave that bucket unlabelled. */
  tickLabel: (index: number) => string | null;
  /** Tooltip heading for a bucket index (e.g. "Feb", "15 Mar", "14:00"). */
  tooltipLabel: (index: number) => string;
  /** Click (a zero-distance drag) or drag across buckets to select an inclusive [start, end] range. */
  onRangeSelect?: (start: number, end: number) => void;
  unit?: string;
  /** Descriptive, rotated y-axis label, e.g. "Energy, kWh" - a bare unit alone doesn't say what's being measured. */
  axisLabel?: string;
}

const CHART_WIDTH = 400;
const CHART_HEIGHT = 220;
const PAD = { top: 12, right: 12, bottom: 20, left: 34 };

/**
 * A generic signed stacked-bar chart - positive-sign series stack upward
 * from a shared zero axis, negative-sign series stack downward, one shared
 * kWh-per-pixel scale so a bar's height always means the same thing on
 * either side. Used for all three of the Dispatch tab's own views (monthly,
 * yearly-daily, and the hourly drill-down) by varying `bucketCount` and the
 * label callbacks - see DispatchPanel.tsx. `onRangeSelect` (only wired up
 * for the yearly-daily view) supports both a click and a click-drag, per
 * Andrew's own instruction 2026-09-16 ("drag to select some days to zoom in
 * on") - a click is just a zero-distance drag.
 */
export default function StackedBarChart({
  series,
  bucketCount,
  tickLabel,
  tooltipLabel,
  onRangeSelect,
  unit = "kWh",
  axisLabel = "Energy, kWh",
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ start: number; current: number } | null>(null);

  const innerW = CHART_WIDTH - PAD.left - PAD.right;
  const innerH = CHART_HEIGHT - PAD.top - PAD.bottom;
  const rawSlot = innerW / bucketCount;
  const barGap = Math.min(bucketCount > 60 ? 0.5 : 3, rawSlot * 0.3);
  const barWidth = Math.max(0.1, rawSlot - barGap);

  const positiveSeries = series.filter((s) => s.sign === 1);
  const negativeSeries = series.filter((s) => s.sign === -1);

  const positiveTotals = new Array(bucketCount).fill(0);
  const negativeTotals = new Array(bucketCount).fill(0);
  for (const s of positiveSeries) for (let i = 0; i < bucketCount; i++) positiveTotals[i] += s.values[i] ?? 0;
  for (const s of negativeSeries) for (let i = 0; i < bucketCount; i++) negativeTotals[i] += s.values[i] ?? 0;

  const positiveTicks = niceTicks(Math.max(...positiveTotals, 0.001));
  const negativeTicks = niceTicks(Math.max(...negativeTotals, 0.001));
  const maxPositive = positiveTicks[positiveTicks.length - 1];
  const maxNegative = negativeTicks[negativeTicks.length - 1];
  const valuePerPx = (maxPositive + maxNegative) / innerH;
  const zeroY = PAD.top + maxPositive / valuePerPx;

  function indexFromClientX(clientX: number): number {
    const svg = svgRef.current;
    if (!svg) return 0;
    const rect = svg.getBoundingClientRect();
    const localX = ((clientX - rect.left) / rect.width) * CHART_WIDTH;
    const frac = (localX - PAD.left) / innerW;
    return Math.max(0, Math.min(bucketCount - 1, Math.floor(frac * bucketCount)));
  }

  function handleMouseDown(e: React.MouseEvent<SVGSVGElement>) {
    const rangeSelect = onRangeSelect;
    if (!rangeSelect) return;
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
        // Deferred a tick - see GenerationTimeseries.tsx's own identical comment.
        if (d) setTimeout(() => rangeSelect!(Math.min(d.start, i), Math.max(d.start, i)), 0);
        return null;
      });
    }
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  }

  const rangeStart = drag ? Math.min(drag.start, drag.current) : 0;
  const rangeCount = drag ? Math.abs(drag.current - drag.start) + 1 : 0;

  return (
    <Box sx={{ position: "relative" }}>
      <Box
        component="svg"
        ref={svgRef}
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        sx={{ width: "100%", height: "auto", display: "block", cursor: onRangeSelect ? "pointer" : "default", userSelect: "none" }}
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

        {positiveTicks.map((tickValue) => {
          const y = zeroY - tickValue / valuePerPx;
          return (
            <g key={`pos-${tickValue}`}>
              <line
                x1={PAD.left}
                x2={CHART_WIDTH - PAD.right}
                y1={y}
                y2={y}
                stroke="currentColor"
                strokeOpacity={tickValue === 0 ? 0.25 : 0.08}
                strokeWidth={1}
              />
              <text x={PAD.left - 4} y={y} dy={tickValue === 0 ? 3 : 2} fontSize={5} fill="currentColor" opacity={0.55} textAnchor="end">
                {formatAxisValue(tickValue)}
              </text>
            </g>
          );
        })}
        {negativeTicks
          .filter((tickValue) => tickValue > 0)
          .map((tickValue) => {
            const y = zeroY + tickValue / valuePerPx;
            return (
              <g key={`neg-${tickValue}`}>
                <line
                  x1={PAD.left}
                  x2={CHART_WIDTH - PAD.right}
                  y1={y}
                  y2={y}
                  stroke="currentColor"
                  strokeOpacity={0.08}
                  strokeWidth={1}
                />
                <text x={PAD.left - 4} y={y} dy={2} fontSize={5} fill="currentColor" opacity={0.55} textAnchor="end">
                  {formatAxisValue(tickValue)}
                </text>
              </g>
            );
          })}

        {Array.from({ length: bucketCount }, (_, i) => {
          const x = PAD.left + i * (innerW / bucketCount) + barGap / 2;
          let yPos = zeroY;
          let yNeg = zeroY;
          const hovered = hoverIndex === i;
          return (
            <g key={i}>
              {positiveSeries.map((s) => {
                const h = (s.values[i] ?? 0) / valuePerPx;
                const y = yPos - h;
                yPos = y;
                return <rect key={s.label} x={x} y={y} width={barWidth} height={h} fill={s.color} opacity={s.opacity ?? (hovered ? 1 : 0.85)} />;
              })}
              {negativeSeries.map((s) => {
                const h = (s.values[i] ?? 0) / valuePerPx;
                const y = yNeg;
                yNeg += h;
                return <rect key={s.label} x={x} y={y} width={barWidth} height={h} fill={s.color} opacity={s.opacity ?? (hovered ? 1 : 0.85)} />;
              })}
              {/* Full-height invisible hit target - a low month/hour's own bars can be a couple of px tall. */}
              <rect x={x} y={PAD.top} width={barWidth} height={innerH} fill="transparent" onMouseEnter={() => setHoverIndex(i)} />
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
              x={PAD.left + i * (innerW / bucketCount) + innerW / (2 * bucketCount)}
              y={CHART_HEIGHT - 6}
              fontSize={5}
              fill="currentColor"
              opacity={0.55}
              textAnchor="middle"
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
            {rangeCount} bucket{rangeCount === 1 ? "" : "s"} selected
          </Box>
        </Box>
      )}

      {hoverIndex !== null && !drag && (
        <Box
          sx={{
            position: "absolute",
            top: 4,
            left: `${((hoverIndex + 0.5) / bucketCount) * 100}%`,
            transform: hoverIndex > bucketCount * 0.7 ? "translateX(-100%)" : "translateX(0)",
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
          <Box sx={{ fontSize: "0.6875rem", fontWeight: 700, lineHeight: 1.4, mb: 0.25 }}>{tooltipLabel(hoverIndex)}</Box>
          {series.map((s) => {
            const v = s.values[hoverIndex] ?? 0;
            if (v === 0) return null;
            return (
              <Box key={s.label} sx={{ display: "flex", alignItems: "center", gap: 0.5, fontSize: "0.625rem", lineHeight: 1.5 }}>
                <Box sx={{ width: 7, height: 7, borderRadius: "2px", bgcolor: s.color, flexShrink: 0 }} />
                <Box component="span" sx={{ color: "text.secondary" }}>
                  {s.label}:
                </Box>
                <Box component="span" sx={{ fontWeight: 600 }}>
                  {(s.sign * v).toFixed(2)} {unit}
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
