import { useRef, useState } from "react";
import { Box, useTheme } from "@mui/material";

const CHART_WIDTH = 400;
const CHART_HEIGHT = 160;
const PAD = { top: 12, right: 12, bottom: 24, left: 12 };

// Rough width (in viewBox units) of a 4-digit year label at the axis's 9px
// font, plus a little breathing room - used to work out how many of the
// candidate one-per-year ticks below actually fit before they'd start
// overlapping, rather than hard-coding a label count.
const MIN_YEAR_LABEL_SPACING = 30;

// "Nice" gaps between year labels - every 1, 2, 3, 5, 10, ... years, never
// an arbitrary/irregular one. Per Andrew's instruction 2026-09-15: labels
// evenly subsampled by index (skip every Nth point) could still land 2
// years apart in one place and 3 in another once the underlying series has
// any gaps or an odd point count - stepping through calendar years
// directly instead guarantees the same gap every time.
const YEAR_STEPS = [1, 2, 3, 5, 10, 20, 25, 50];

export interface TimeseriesPoint {
  value: number;
  label: string;
  /** Calendar year this point falls in - drives the one-tick-per-year x-axis below, regardless of whether the underlying series is monthly or annual. */
  year: number;
}

interface Props {
  points: TimeseriesPoint[];
  color?: string;
  /** How to render a point's value in the hover tooltip - defaults to a plain locale-formatted number. Callers pass their own unit ("… GW", "…%") to match the headline figure above the chart. */
  formatValue?: (value: number) => string;
}

/**
 * Shared hand-drawn SVG line chart, factored out of CountryDetail once
 * GenerationDetail needed the identical shape (area + line + endpoint dot,
 * recessive gridlines, one-per-year x-axis) for a different series - one
 * series on one screen doesn't warrant a charting library either way, see
 * the dataviz conventions this project follows.
 *
 * Hover/touch shows a crosshair line, a highlighted dot on the nearest
 * point, and a small tooltip with that point's own date label and value -
 * added 2026-09-15 per Andrew's instruction, following this project's own
 * dataviz skill (an HTML/SVG chart ships a hover layer by default). Pointer
 * position is translated from screen pixels to the SVG's own viewBox units
 * via getBoundingClientRect, since the element is scaled by CSS
 * (`width: 100%`) rather than rendered at its native 400x160.
 */
export default function TimeseriesChart({ points, color = "#00ABBB", formatValue }: Props) {
  const theme = useTheme();
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const values = points.map((p) => p.value);
  const min = Math.min(...values, 0);
  const max = Math.max(...values);
  const span = max - min || 1;

  const innerW = CHART_WIDTH - PAD.left - PAD.right;
  const innerH = CHART_HEIGHT - PAD.top - PAD.bottom;

  const plotted = points.map((p, i) => {
    const x = PAD.left + (i / (points.length - 1 || 1)) * innerW;
    const y = PAD.top + innerH - ((p.value - min) / span) * innerH;
    return { x, y };
  });

  const linePath = plotted.map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L ${plotted[plotted.length - 1].x.toFixed(1)} ${(PAD.top + innerH).toFixed(1)} L ${plotted[0].x.toFixed(1)} ${(PAD.top + innerH).toFixed(1)} Z`;

  const lastPoint = plotted[plotted.length - 1];

  // Index of the first point in each calendar year - the first point
  // overall, then every point whose year differs from the point before it.
  // Works the same way for a monthly series (a year's tick lands on
  // whichever month is its first) and an annual one (every point is its
  // own year, so every point qualifies).
  const yearToIndex = new Map<number, number>();
  points.forEach((p, i) => {
    if (i === 0 || p.year !== points[i - 1].year) yearToIndex.set(p.year, i);
  });
  const years = Array.from(yearToIndex.keys());
  const firstYear = years[0];
  const lastYear = years[years.length - 1];

  // Smallest "nice" step (see YEAR_STEPS) whose resulting label count still
  // fits the space available - so a short history gets a label every year,
  // and a long one steps up to every 2, 3, 5... years rather than
  // overlapping or cramming every single year in.
  const maxLabels = Math.max(2, Math.floor(innerW / MIN_YEAR_LABEL_SPACING));
  const yearSpan = lastYear - firstYear;
  const yearStep =
    YEAR_STEPS.find((step) => Math.floor(yearSpan / step) + 1 <= maxLabels) ?? YEAR_STEPS[YEAR_STEPS.length - 1];

  const tickIndices: number[] = [];
  for (let year = firstYear; year <= lastYear; year += yearStep) {
    const idx = yearToIndex.get(year);
    if (idx !== undefined) tickIndices.push(idx);
  }

  function indexFromClientX(clientX: number): number {
    const rect = svgRef.current!.getBoundingClientRect();
    const localX = ((clientX - rect.left) / rect.width) * CHART_WIDTH;
    let nearest = 0;
    let nearestDist = Infinity;
    plotted.forEach((pt, i) => {
      const d = Math.abs(pt.x - localX);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = i;
      }
    });
    return nearest;
  }

  const hovered = hoverIndex !== null ? { point: points[hoverIndex], plotted: plotted[hoverIndex] } : null;
  // Flip the tooltip to whichever side of the dot has room, so it never
  // runs off the chart's own edge for a point near the start or end of the
  // series.
  const tooltipAnchor = hovered ? (hovered.plotted.x > CHART_WIDTH * 0.7 ? "end" : "start") : "start";

  return (
    <Box sx={{ position: "relative" }}>
      <Box
        ref={svgRef}
        component="svg"
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        sx={{ width: "100%", height: "auto", display: "block", touchAction: "pan-y", cursor: "crosshair" }}
        onPointerMove={(e) => setHoverIndex(indexFromClientX(e.clientX))}
        onPointerLeave={() => setHoverIndex(null)}
      >
        {[0.25, 0.75].map((t) => (
          <line
            key={t}
            x1={PAD.left}
            x2={CHART_WIDTH - PAD.right}
            y1={PAD.top + innerH * (1 - t)}
            y2={PAD.top + innerH * (1 - t)}
            stroke="currentColor"
            strokeOpacity={0.08}
            strokeWidth={1}
          />
        ))}
        <path d={areaPath} fill={color} fillOpacity={0.12} stroke="none" />
        <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={lastPoint.x} cy={lastPoint.y} r={3.5} fill={color} />
        {tickIndices.map((idx) => (
          <text
            key={idx}
            x={plotted[idx].x}
            y={CHART_HEIGHT - 6}
            fontSize={9}
            fill="currentColor"
            opacity={0.55}
            textAnchor={idx === 0 ? "start" : idx === points.length - 1 ? "end" : "middle"}
          >
            {points[idx].year}
          </text>
        ))}
        {hovered && (
          <>
            <line
              x1={hovered.plotted.x}
              x2={hovered.plotted.x}
              y1={PAD.top}
              y2={PAD.top + innerH}
              stroke="currentColor"
              strokeOpacity={0.25}
              strokeWidth={1}
            />
            <circle
              cx={hovered.plotted.x}
              cy={hovered.plotted.y}
              r={4.5}
              fill={color}
              stroke={theme.palette.background.paper}
              strokeWidth={1.5}
            />
          </>
        )}
      </Box>
      {hovered && (
        <Box
          sx={{
            position: "absolute",
            top: 4,
            left: `${(hovered.plotted.x / CHART_WIDTH) * 100}%`,
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
            {formatValue ? formatValue(hovered.point.value) : hovered.point.value.toLocaleString()}
          </Box>
          <Box sx={{ fontSize: "0.625rem", color: "text.secondary", lineHeight: 1.3 }}>{hovered.point.label}</Box>
        </Box>
      )}
    </Box>
  );
}
