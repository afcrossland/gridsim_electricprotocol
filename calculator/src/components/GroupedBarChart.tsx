import { useRef, useState } from "react";
import { Box } from "@mui/material";

import { formatAxisValue, niceTicks } from "../lib/chartFormat";

export interface GroupedSeries {
  label: string;
  color: string;
  values: number[];
}

interface Props {
  series: GroupedSeries[];
  bucketCount: number;
  /** Tick label for a bucket index, or null to leave that bucket unlabelled. */
  tickLabel: (index: number) => string | null;
  /** Tooltip heading for a bucket index (e.g. "Feb", "15 Mar"). */
  tooltipLabel: (index: number) => string;
  /** Click (a zero-distance drag) or drag across buckets to select an inclusive [start, end] range - same interaction as StackedBarChart's own. */
  onRangeSelect?: (start: number, end: number) => void;
  unit?: string;
  /** Descriptive, rotated y-axis label, e.g. "Energy, kWh" - a bare unit alone doesn't say what's being measured. */
  axisLabel?: string;
}

const CHART_WIDTH = 400;
const CHART_HEIGHT = 160;
const PAD = { top: 8, right: 8, bottom: 20, left: 34 };
const GROUP_GAP_FRAC = 0.25;
const BAR_GAP = 1;

/**
 * A generic side-by-side (not stacked) grouped-bar chart, generalising
 * DualMonthlyBarChart's own always-12-months rendering into an arbitrary
 * `bucketCount` with the same click/drag-to-zoom API as StackedBarChart
 * (`onRangeSelect`) - built 2026-09-30 per Andrew's own instruction ("the
 * daily as stacked col makes most sense") to replace the line chart
 * previously used for a drilled-into-one-month daily view (MultiLineChart
 * read as noisy/spiky at ~28-31 points for two independent, non-additive
 * magnitudes like generation vs demand - a line connecting jagged daily
 * solar totals looked messy where discrete columns read cleanly). Grouped,
 * not stacked, bars - generation and demand (or any other two independent
 * series shown this way) aren't parts of a whole, so summing their heights
 * into one stack would show a meaningless combined total (see
 * StackedBarChart.tsx for the genuinely-additive case, e.g. dispatch
 * flows).
 */
export default function GroupedBarChart({
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
  const groupGap = slot * GROUP_GAP_FRAC;
  const groupWidth = slot - groupGap;
  const barWidth = Math.max(0.1, groupWidth / series.length - BAR_GAP);

  const rawMax = Math.max(...series.flatMap((s) => s.values), 1);
  const ticks = niceTicks(rawMax);
  const max = ticks[ticks.length - 1];

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

        {Array.from({ length: bucketCount }, (_, i) => {
          const groupX = PAD.left + i * slot + groupGap / 2;
          const hovered = hoverIndex === i;
          return (
            <g key={i}>
              {series.map((s, si) => {
                const value = s.values[i] ?? 0;
                const barH = Math.max(0.5, (value / max) * innerH);
                const x = groupX + si * (barWidth + BAR_GAP);
                const y = PAD.top + innerH - barH;
                return (
                  <rect
                    key={s.label}
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barH}
                    fill={s.color}
                    opacity={hovered ? 1 : 0.85}
                    style={{ pointerEvents: "none" }}
                  />
                );
              })}
              {/* Full-height invisible hit target, same reasoning as StackedBarChart's own. */}
              <rect x={groupX} y={PAD.top} width={groupWidth} height={innerH} fill="transparent" onMouseEnter={() => setHoverIndex(i)} />
            </g>
          );
        })}

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

        {Array.from({ length: bucketCount }, (_, i) => tickLabel(i)).map((label, i) =>
          label === null ? null : (
            <text key={i} x={PAD.left + i * slot + slot / 2} y={CHART_HEIGHT - 6} fontSize={5} fill="currentColor" opacity={0.55} textAnchor="middle">
              {label}
            </text>
          ),
        )}
      </Box>

      {drag && rangeCount > 1 && (
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
            {rangeCount} selected
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
          {series.map((s) => (
            <Box key={s.label} sx={{ display: "flex", alignItems: "center", gap: 0.5, fontSize: "0.625rem", lineHeight: 1.5 }}>
              <Box sx={{ width: 7, height: 7, borderRadius: "2px", bgcolor: s.color, flexShrink: 0 }} />
              <Box component="span" sx={{ color: "text.secondary" }}>
                {s.label}:
              </Box>
              <Box component="span" sx={{ fontWeight: 600 }}>
                {Math.round(s.values[hoverIndex] ?? 0).toLocaleString()} {unit}
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
