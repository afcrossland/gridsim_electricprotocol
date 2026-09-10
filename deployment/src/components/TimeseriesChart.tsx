import { Box } from "@mui/material";

const CHART_WIDTH = 400;
const CHART_HEIGHT = 160;
const PAD = { top: 12, right: 12, bottom: 24, left: 12 };

export interface TimeseriesPoint {
  value: number;
  label: string;
}

interface Props {
  points: TimeseriesPoint[];
  color?: string;
}

/**
 * Shared hand-drawn SVG line chart, factored out of CountryDetail once
 * GenerationDetail needed the identical shape (area + line + endpoint dot,
 * recessive gridlines, first/last labels) for a different series - one
 * series on one screen doesn't warrant a charting library either way, see
 * the dataviz conventions this project follows.
 */
export default function TimeseriesChart({ points, color = "#00ABBB" }: Props) {
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

  const first = points[0];
  const last = points[points.length - 1];
  const lastPoint = plotted[plotted.length - 1];

  return (
    <Box component="svg" viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} sx={{ width: "100%", height: "auto" }}>
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
      <text x={PAD.left} y={CHART_HEIGHT - 6} fontSize={9} fill="currentColor" opacity={0.55}>
        {first.label}
      </text>
      <text x={CHART_WIDTH - PAD.right} y={CHART_HEIGHT - 6} fontSize={9} fill="currentColor" opacity={0.55} textAnchor="end">
        {last.label}
      </text>
    </Box>
  );
}
