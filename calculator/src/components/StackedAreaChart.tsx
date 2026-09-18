import { useRef, useState } from "react";
import { Box } from "@mui/material";

import { formatAxisValue, niceTicks } from "../lib/chartFormat";
import type { StackedSeries } from "./StackedBarChart";

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

interface Point {
  x: number;
  y: number;
}

const CHART_WIDTH = 400;
const CHART_HEIGHT = 220;
const PAD = { top: 12, right: 12, bottom: 20, left: 34 };
const AREA_OPACITY = 0.85; // matches StackedBarChart.tsx's own resting bar opacity, per Andrew's own instruction 2026-09-18

/**
 * Catmull-Rom-to-cubic-bezier smoothing (tension 1/6, the standard
 * conversion) - interpolates exactly through every point with continuous
 * tangents, rather than the raw straight-segment polyline `StackedBarChart`'s
 * bars imply. `startCmd` lets a boundary curve continue an existing path
 * (`"L"`) instead of always starting a fresh subpath (`"M"`), so a stacked
 * band's top and bottom boundaries can be concatenated into one closed
 * ribbon shape - see `stackedAreaPath` below.
 */
function catmullRomSegment(pts: Point[], startCmd: "M" | "L"): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `${startCmd} ${pts[0].x} ${pts[0].y}`;
  const d: string[] = [`${startCmd} ${pts[0].x} ${pts[0].y}`];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d.push(`C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`);
  }
  return d.join(" ");
}

/** A closed ribbon: smoothed top boundary forward, then smoothed bottom boundary backward, closing back to the start. */
function stackedAreaPath(topPoints: Point[], bottomPoints: Point[]): string {
  const top = catmullRomSegment(topPoints, "M");
  const bottom = catmullRomSegment([...bottomPoints].reverse(), "L");
  return `${top} ${bottom} Z`;
}

/**
 * A smoothed stacked-area version of `StackedBarChart` - same signed
 * stacking (positive series rise from a shared zero axis, negative series
 * fall below it), same axis/tick/hover/drag-to-zoom mechanics, only the
 * mark itself changes from discrete bars to continuous Catmull-Rom-smoothed
 * bands. Per Andrew's own instruction 2026-09-18 ("instead of a bar chart,
 * can we do as a stacked area but with same transparency as the bar,
 * smooth the chart... referring to charts on dispatch, keep bars
 * elsewhere") - used only by DispatchPanel.tsx's three views (monthly,
 * yearly-daily, hourly drill-down); every other chart in this app (the
 * Generation & demand tab's own grouped-bar and multi-line charts) is
 * untouched.
 */
export default function StackedAreaChart({
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
  const slot = innerW / bucketCount;

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

  const centerX = (i: number) => PAD.left + i * slot + slot / 2;

  function bandsFor(seriesList: StackedSeries[], direction: 1 | -1): { s: StackedSeries; top: Point[]; bottom: Point[] }[] {
    const cum = new Array(bucketCount).fill(0);
    const boundaryY = (v: number) => (direction === 1 ? zeroY - v / valuePerPx : zeroY + v / valuePerPx);
    return seriesList.map((s) => {
      const bottom: Point[] = [];
      const top: Point[] = [];
      for (let i = 0; i < bucketCount; i++) {
        bottom[i] = { x: centerX(i), y: boundaryY(cum[i]) };
        cum[i] += s.values[i] ?? 0;
        top[i] = { x: centerX(i), y: boundaryY(cum[i]) };
      }
      return { s, top, bottom };
    });
  }

  const positiveBands = bandsFor(positiveSeries, 1);
  const negativeBands = bandsFor(negativeSeries, -1);

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

        {/*
          No boundary stroke on these bands - per Andrew's own instruction
          2026-09-18 ("it has a line around the area so e.g. looks like
          grid always on when it isnt"): a zero-value series still has a
          real (zero-height) top boundary sitting exactly on the band
          below it, so a stroke there reads as "this series has some
          value" even when it's actually empty. Fill-only avoids that
          false signal.
        */}
        {positiveBands.map(({ s, top, bottom }) => (
          <path key={s.label} d={stackedAreaPath(top, bottom)} fill={s.color} fillOpacity={s.opacity ?? AREA_OPACITY} stroke="none" />
        ))}
        {negativeBands.map(({ s, top, bottom }) => (
          <path key={s.label} d={stackedAreaPath(bottom, top)} fill={s.color} fillOpacity={s.opacity ?? AREA_OPACITY} stroke="none" />
        ))}

        {hoverIndex !== null && !drag && (
          <line
            x1={centerX(hoverIndex)}
            x2={centerX(hoverIndex)}
            y1={PAD.top}
            y2={PAD.top + innerH}
            stroke="currentColor"
            strokeOpacity={0.35}
            strokeWidth={1}
          />
        )}

        {drag && (
          <rect
            x={PAD.left + rangeStart * slot}
            width={rangeCount * slot}
            y={PAD.top}
            height={innerH}
            fill="currentColor"
            fillOpacity={0.08}
          />
        )}

        {/* Full-plot invisible hit target for hover/drag - areas have no per-bucket element to hang mouse handlers off. */}
        <rect x={PAD.left} y={PAD.top} width={innerW} height={innerH} fill="transparent" />

        {Array.from({ length: bucketCount }, (_, i) => tickLabel(i)).map((label, i) =>
          label === null ? null : (
            <text key={i} x={centerX(i)} y={CHART_HEIGHT - 6} fontSize={5} fill="currentColor" opacity={0.55} textAnchor="middle">
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
