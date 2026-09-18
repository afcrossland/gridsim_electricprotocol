import { useRef, useState } from "react";
import { Box } from "@mui/material";

import { formatAxisValue, niceTicks } from "../lib/chartFormat";

export interface LineSeries {
  label: string;
  color: string;
  values: number[];
}

interface Props {
  series: LineSeries[];
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
  maxValue?: number;
}

const CHART_WIDTH = 400;
const CHART_HEIGHT = 180;
const PAD = { top: 12, right: 12, bottom: 20, left: 36 };

/**
 * A generic multi-series line chart - each series its own coloured line,
 * sharing one y-scale so their magnitudes are directly comparable (per
 * Andrew's own instruction 2026-09-17: "show generation and demand on the
 * same charts"). Lines, not bars, since this is a direct overlay
 * comparison rather than a composition/stacking relationship (see
 * StackedBarChart.tsx for that other case, e.g. the Dispatch tab). Same
 * click-or-drag-to-zoom-and-keep-zooming interaction as StackedBarChart's
 * own (`onRangeSelect`, a click is a zero-distance drag) and the same
 * generic bucketed API shape (`tickLabel`/`tooltipLabel`), so this one
 * component covers the monthly, yearly-daily, and hourly-drill-down
 * views just by varying `bucketCount`.
 */
export default function MultiLineChart({
  series,
  bucketCount,
  tickLabel,
  tooltipLabel,
  onRangeSelect,
  unit = "kWh",
  axisLabel = "Energy, kWh",
  maxValue,
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ start: number; current: number } | null>(null);

  const innerW = CHART_WIDTH - PAD.left - PAD.right;
  const innerH = CHART_HEIGHT - PAD.top - PAD.bottom;
  const allValues = series.flatMap((s) => s.values);
  const rawMax = maxValue ?? Math.max(...allValues, 1);
  const ticks = niceTicks(rawMax);
  const max = ticks[ticks.length - 1];

  const pointX = (i: number) => PAD.left + (bucketCount <= 1 ? 0 : (i / (bucketCount - 1)) * innerW);
  const pointY = (v: number) => PAD.top + innerH - (v / max) * innerH;

  function indexFromClientX(clientX: number): number {
    const svg = svgRef.current;
    if (!svg) return 0;
    const rect = svg.getBoundingClientRect();
    const localX = ((clientX - rect.left) / rect.width) * CHART_WIDTH;
    const frac = (localX - PAD.left) / innerW;
    return Math.max(0, Math.min(bucketCount - 1, Math.round(frac * (bucketCount - 1))));
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
        // Deferred a tick - see StackedBarChart.tsx's own identical comment.
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

        {series.map((s) => {
          const linePath = s.values
            .map((v, i) => `${i === 0 ? "M" : "L"} ${pointX(i).toFixed(1)} ${pointY(v).toFixed(1)}`)
            .join(" ");
          return <path key={s.label} d={linePath} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />;
        })}

        {drag && (
          <rect
            x={pointX(rangeStart) - (rangeCount > 1 ? 0 : 1)}
            width={Math.max(1, pointX(rangeStart + rangeCount - 1) - pointX(rangeStart))}
            y={PAD.top}
            height={innerH}
            fill="currentColor"
            fillOpacity={0.06}
          />
        )}

        {Array.from({ length: bucketCount }, (_, i) => tickLabel(i)).map((label, i) =>
          label === null ? null : (
            <text key={i} x={pointX(i)} y={CHART_HEIGHT - 6} fontSize={5} fill="currentColor" opacity={0.55} textAnchor="middle">
              {label}
            </text>
          ),
        )}

        {hoverIndex !== null && !drag && (
          <>
            <line
              x1={pointX(hoverIndex)}
              x2={pointX(hoverIndex)}
              y1={PAD.top}
              y2={PAD.top + innerH}
              stroke="currentColor"
              strokeOpacity={0.2}
              strokeWidth={1}
            />
            {series.map((s) => (
              <circle key={s.label} cx={pointX(hoverIndex)} cy={pointY(s.values[hoverIndex] ?? 0)} r={3} fill={s.color} />
            ))}
          </>
        )}
      </Box>

      {drag && (
        <Box
          sx={{
            position: "absolute",
            top: 4,
            left: `${(pointX(rangeStart + (rangeCount - 1) / 2) / CHART_WIDTH) * 100}%`,
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
            left: `${(pointX(hoverIndex) / CHART_WIDTH) * 100}%`,
            transform: pointX(hoverIndex) > CHART_WIDTH * 0.7 ? "translateX(-100%)" : "translateX(0)",
            ml: pointX(hoverIndex) > CHART_WIDTH * 0.7 ? "-6px" : "6px",
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
                {(s.values[hoverIndex] ?? 0).toFixed(2)} {unit}
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
