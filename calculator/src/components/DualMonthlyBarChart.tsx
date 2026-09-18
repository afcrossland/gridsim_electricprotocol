import { useState } from "react";
import { Box } from "@mui/material";

import { MONTH_NAMES } from "../lib/timeAggregates";
import { formatAxisValue, niceTicks } from "../lib/chartFormat";

const CHART_WIDTH = 400;
const CHART_HEIGHT = 120;
const PAD = { top: 8, right: 8, bottom: 20, left: 34 };
const GROUP_GAP = 6;
const BAR_GAP = 2;
const BAR_RADIUS = 2;

export interface MonthlySeries {
  label: string;
  color: string;
  monthlyValues: number[];
}

/**
 * Monthly totals for two series (generation vs demand) as grouped bars -
 * per Andrew's own instruction 2026-09-17 ("combine generation and demand
 * tabs... monthly first then timeseries"). A grouped, not stacked, bar
 * chart - generation and demand aren't parts of a whole, they're two
 * independent magnitudes being compared side by side each month. A
 * rotated, descriptive axis label (`axisLabel`, e.g. "Energy, kWh") runs
 * along the left edge, per Andrew's own instruction 2026-09-17 ("the
 * yaxes need titles and units... by title I mean a label... all should
 * have a descriptive label") - a bare unit on its own doesn't say what's
 * being measured.
 */
export default function DualMonthlyBarChart({
  series,
  unit = "kWh",
  axisLabel = "Energy, kWh",
}: {
  series: [MonthlySeries, MonthlySeries];
  unit?: string;
  axisLabel?: string;
}) {
  const [hover, setHover] = useState<{ month: number; seriesIndex: number } | null>(null);

  const innerW = CHART_WIDTH - PAD.left - PAD.right;
  const innerH = CHART_HEIGHT - PAD.top - PAD.bottom;
  const rawMax = Math.max(...series[0].monthlyValues, ...series[1].monthlyValues, 1);
  const ticks = niceTicks(rawMax);
  const max = ticks[ticks.length - 1];

  const groupWidth = innerW / 12 - GROUP_GAP;
  const barWidth = groupWidth / 2 - BAR_GAP / 2;

  return (
    <Box sx={{ position: "relative" }}>
      <Box
        component="svg"
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        sx={{ width: "100%", height: "auto", display: "block" }}
        onMouseLeave={() => setHover(null)}
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

        {Array.from({ length: 12 }, (_, month) => {
          const groupX = PAD.left + month * (innerW / 12) + GROUP_GAP / 2;
          return (
            <g key={month}>
              {series.map((s, si) => {
                const value = s.monthlyValues[month] ?? 0;
                const barH = Math.max(1, (value / max) * innerH);
                const x = groupX + si * (barWidth + BAR_GAP);
                const y = PAD.top + innerH - barH;
                const hovered = hover?.month === month && hover.seriesIndex === si;
                return (
                  <g key={s.label}>
                    <rect
                      x={x}
                      y={PAD.top}
                      width={barWidth}
                      height={innerH}
                      fill="transparent"
                      onMouseEnter={() => setHover({ month, seriesIndex: si })}
                    />
                    <rect
                      x={x}
                      y={y}
                      width={barWidth}
                      height={barH}
                      rx={BAR_RADIUS}
                      ry={BAR_RADIUS}
                      fill={s.color}
                      opacity={hovered ? 1 : 0.85}
                      style={{ pointerEvents: "none" }}
                    />
                  </g>
                );
              })}
              <text
                x={groupX + groupWidth / 2}
                y={CHART_HEIGHT - 6}
                fontSize={5}
                textAnchor="middle"
                fill="currentColor"
                opacity={hover?.month === month ? 0.9 : 0.55}
                style={{ pointerEvents: "none" }}
              >
                {MONTH_NAMES[month]}
              </text>
            </g>
          );
        })}
      </Box>

      {hover && (
        <Box
          sx={{
            position: "absolute",
            top: 4,
            left: `${((hover.month + 0.5) / 12) * 100}%`,
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
          <Box sx={{ fontSize: "0.6875rem", fontWeight: 700, lineHeight: 1.3 }}>{MONTH_NAMES[hover.month]}</Box>
          {series.map((s, si) => (
            <Box key={s.label} sx={{ display: "flex", alignItems: "center", gap: 0.5, fontSize: "0.625rem", lineHeight: 1.5 }}>
              <Box sx={{ width: 7, height: 7, borderRadius: "2px", bgcolor: s.color, flexShrink: 0 }} />
              <Box component="span" sx={{ color: si === hover.seriesIndex ? "text.primary" : "text.secondary", fontWeight: si === hover.seriesIndex ? 700 : 400 }}>
                {s.label}: {Math.round(s.monthlyValues[hover.month]).toLocaleString()} {unit}
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
