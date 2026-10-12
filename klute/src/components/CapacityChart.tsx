import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { LineChart } from "@mui/x-charts/LineChart";
import type { CapacityRow } from "../lib/fgs";

const FAMILIES: { key: string; colour: string }[] = [
  { key: "nuclear", colour: "#7C3AED" },
  { key: "coal", colour: "#4B5563" },
  { key: "gas", colour: "#F97316" },
  { key: "oil", colour: "#92400E" },
  { key: "biomass", colour: "#65A30D" },
  { key: "geothermal", colour: "#BE185D" },
  { key: "hydro", colour: "#2563EB" },
  { key: "wind", colour: "#01ADBF" },
  { key: "solar", colour: "#F59E0B" },
  { key: "energy_storage", colour: "#0EA5E9" },
  { key: "batteries", colour: "#14B8A6" },
];

// Installed capacity by technology over the years for one region. Sources can disagree and a
// year is often covered by more than one, so one source is plotted at a time (the one with the
// most data points by default) rather than summing them into a double count.
export default function CapacityChart({ rows }: { rows: CapacityRow[] }) {
  const sources = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) counts.set(r.source, (counts.get(r.source) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1]).map(([s]) => s);
  }, [rows]);
  const [picked, setPicked] = useState<string | null>(null);
  const source = picked && sources.includes(picked) ? picked : sources[0];
  const [stacked, setStacked] = useState(true);

  const chart = useMemo(() => {
    const mine = rows.filter((r) => r.source === source);
    if (!mine.length) return null;
    const years = [...new Set(mine.map((r) => r.year))].sort((a, b) => a - b);
    const used = FAMILIES.filter((f) => mine.some((r) => r.asset_type === f.key && r.mw > 0));
    return {
      years,
      lines: used.map((f) => ({
        id: f.key,
        label: f.key.replace("_", " "),
        color: f.colour,
        area: stacked,
        stack: stacked ? "total" : undefined,
        showMark: false,
        valueFormatter: (v: number | null) => (v == null ? "-" : `${v.toFixed(2)} GW`),
        data: years.map((y) => {
          const row = mine.find((r) => r.year === y && r.asset_type === f.key);
          return row ? row.mw / 1000 : 0;
        }),
      })),
    };
  }, [rows, source, stacked]);

  if (!rows.length || !chart) return <Typography variant="body2">No installed capacity recorded for this region.</Typography>;

  return (
    <Box>
      <Box sx={{ display: "flex", gap: 2, alignItems: "center", mb: 1, flexWrap: "wrap" }}>
        {sources.length > 1 && (
          <TextField size="small" select label="Source" value={source} onChange={(e) => setPicked(e.target.value)} sx={{ minWidth: 140 }}>
            {sources.map((s) => (
              <MenuItem key={s} value={s}>
                {s}
              </MenuItem>
            ))}
          </TextField>
        )}
        {sources.length === 1 && (
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Source: {source}
          </Typography>
        )}
        <TextField size="small" select label="View" value={stacked ? "stacked" : "lines"} onChange={(e) => setStacked(e.target.value === "stacked")} sx={{ minWidth: 120 }}>
          <MenuItem value="stacked">Stacked</MenuItem>
          <MenuItem value="lines">Lines</MenuItem>
        </TextField>
      </Box>
      <LineChart height={320} xAxis={[{ scaleType: "point", data: chart.years.map(String) }]} yAxis={[{ label: "GW" }]} series={chart.lines} />
    </Box>
  );
}
