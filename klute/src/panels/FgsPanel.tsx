import { useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";
import { LineChart } from "@mui/x-charts/LineChart";
import CapacityChart from "../components/CapacityChart";
import CoverageTable from "../components/CoverageTable";
import FreshnessPanel from "../components/FreshnessPanel";
import QualityPanel from "../components/QualityPanel";
import QualitySummary from "../components/QualitySummary";
import WeatherMap from "../components/WeatherMap";
import { monthRow, yearRow } from "../lib/coverage";
import type { CoverageRow } from "../lib/coverage";
import { AuthError, FGS_API, fetchCoverage, fetchGeneration, fetchInstalledCapacity, fetchMetrics } from "../lib/fgs";
import type { CapacityRow, FgsCoverage, FgsDataset, FgsMetrics, GenerationRow } from "../lib/fgs";
import { jurisdictionName } from "../../../src/lib/jurisdictions";

const DATASETS: { id: FgsDataset; label: string; note: string }[] = [
  { id: "generation", label: "Generation", note: "Generation by fuel, as ingested (before cleaning)." },
  { id: "demand", label: "Demand", note: "Demand series, as ingested (before cleaning)." },
  { id: "installed-capacity", label: "Installed capacity", note: "Yearly nameplate capacity by technology." },
  { id: "weather", label: "Weather / irradiance", note: "Gridded weather and irradiance inputs. The map shows the field itself; the grid below shows date coverage, sampled at one grid point per source and variable." },
];

// Top-level fuels only: the API also returns each fuel's sub-types and parents (coal and
// coal_hard, wind and onshore/offshore), which would double count if stacked.
const FUELS: { key: string; colour: string }[] = [
  { key: "nuclear", colour: "#7C3AED" },
  { key: "coal", colour: "#4B5563" },
  { key: "gas", colour: "#F97316" },
  { key: "oil", colour: "#92400E" },
  { key: "biomass", colour: "#65A30D" },
  { key: "geothermal", colour: "#BE185D" },
  { key: "hydro", colour: "#2563EB" },
  { key: "wind", colour: "#01ADBF" },
  { key: "solar", colour: "#F59E0B" },
  { key: "other", colour: "#9CA3AF" },
];

const toRows = (res: FgsCoverage): CoverageRow[] =>
  res.regions.map((r) => {
    const label = res.dataset === "weather" ? r.region_code : jurisdictionName(r.region_code);
    const sub = r.sources?.join(", ");
    return res.kind === "years" ? yearRow(r.region_code, label, r.years ?? [], sub) : monthRow(r.region_code, label, r.months ?? {}, sub);
  });

// The Future Grid Simulator's data. Coverage comes from the simulator backend (password
// protected); click a region to see its generation the way the simulator's Explore tab does.
export default function FgsPanel() {
  const [dataset, setDataset] = useState<FgsDataset | "quality" | "freshness">("generation");
  const [cache, setCache] = useState<Partial<Record<FgsDataset, FgsCoverage>>>({});
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CoverageRow | null>(null);

  const load = (id: FgsDataset, fresh = false) => {
    setError(null);
    fetchCoverage(id, fresh)
      .then((res) => setCache((c) => ({ ...c, [id]: res })))
      .catch((e: unknown) => setError(e instanceof AuthError ? e.message : `Could not reach the simulator at ${FGS_API}. ${(e as Error).message}`));
  };
  const isCoverage = dataset !== "quality" && dataset !== "freshness";
  // The quality table opens regions in the drawer, which takes its date range from generation coverage.
  const needed: FgsDataset | null = isCoverage ? dataset : dataset === "quality" ? "generation" : null;
  useEffect(() => {
    if (needed && !cache[needed]) load(needed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needed]);

  const data = isCoverage ? cache[dataset] : undefined;
  const rows = useMemo(() => (data ? toRows(data) : []), [data]);
  const meta = DATASETS.find((d) => d.id === dataset);
  // The quality table names regions only; the drawer wants the generation coverage row for its range.
  const rowFor = (code: string): CoverageRow =>
    toRows(cache.generation ?? { dataset: "generation", kind: "months", regions: [] }).find((r) => r.key === code) ?? monthRow(code, jurisdictionName(code), {});

  return (
    <Box>
      <ToggleButtonGroup size="small" exclusive value={dataset} onChange={(_, v) => v && setDataset(v)} sx={{ my: 2, flexWrap: "wrap" }}>
        {DATASETS.map((d) => (
          <ToggleButton key={d.id} value={d.id}>
            {d.label}
          </ToggleButton>
        ))}
        <ToggleButton value="quality">Data quality</ToggleButton>
        <ToggleButton value="freshness">Freshness</ToggleButton>
      </ToggleButtonGroup>
      {dataset === "quality" && <QualitySummary onSelect={(code) => setSelected(rowFor(code))} />}
      {dataset === "freshness" && <FreshnessPanel />}
      {isCoverage && meta && (
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {meta.note} Red cells are gaps inside a region&apos;s own date range.
        </Typography>
      )}
      {isCoverage && error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
      {isCoverage && !data && !error && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mt: 4 }}>
          <CircularProgress size={22} />
          <Typography variant="body2">Loading from the simulator. The first load after a data change can take up to a minute.</Typography>
        </Box>
      )}
      {dataset === "weather" && <WeatherMap />}
      {data && (
        <CoverageTable
          key={dataset}
          rows={rows}
          kind={data.kind}
          csvName={`fgs-${dataset}-coverage`}
          onSelect={dataset === "weather" ? undefined : setSelected}
          onRefresh={() => {
            if (!isCoverage) return;
            setCache((c) => ({ ...c, [dataset]: undefined }));
            load(dataset, true);
          }}
        />
      )}
      {selected && <RegionDrawer row={selected} onClose={() => setSelected(null)} />}
    </Box>
  );
}

const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

function endOfData(last: string): number {
  if (last.length === 4) return Math.min(Date.UTC(Number(last), 11, 31), Date.now());
  const [y, m] = last.split("-").map(Number);
  return Math.min(Date.UTC(y, m, 0), Date.now());
}

/** The latest calendar year in which every month has data, as [from, to] dates; null if none. */
function lastFullYear(row: CoverageRow): [string, string] | null {
  const years = [...new Set(Object.keys(row.cells).map((k) => k.slice(0, 4)))].sort().reverse();
  for (const y of years) {
    const months = Array.from({ length: 12 }, (_, i) => row.cells[`${y}-${String(i + 1).padStart(2, "0")}`]);
    if (months.every((fill) => fill !== undefined && fill > 0)) return [`${y}-01-01`, `${y}-12-31`];
  }
  return null;
}

function RegionDrawer({ row, onClose }: { row: CoverageRow; onClose: () => void }) {
  const end = endOfData(row.last || iso(Date.now()).slice(0, 7));
  // Opens on the latest full calendar year; regions without one open on their last 30 days.
  const fullYear = lastFullYear(row);
  const [from, setFrom] = useState(fullYear ? fullYear[0] : iso(end - 30 * DAY));
  const [to, setTo] = useState(fullYear ? fullYear[1] : iso(end));
  const [rowsData, setRowsData] = useState<GenerationRow[] | null>(null);
  const [metrics, setMetrics] = useState<FgsMetrics | null>(null);
  const [capacity, setCapacity] = useState<CapacityRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setCapacity(null);
    fetchInstalledCapacity(row.key)
      .then((d) => live && setCapacity(d.rows))
      .catch(() => live && setCapacity([]));
    return () => {
      live = false;
    };
  }, [row.key]);

  useEffect(() => {
    let live = true;
    setRowsData(null);
    setMetrics(null);
    setErr(null);
    const s = `${from}T00:00:00Z`;
    const e = `${to}T00:00:00Z`;
    fetchGeneration(row.key, s, e)
      .then((d) => live && setRowsData(d))
      .catch((x: Error) => live && setErr(x.message));
    fetchMetrics(row.key, s, e)
      .then((m) => live && setMetrics(m))
      .catch(() => live && setMetrics({}));
    return () => {
      live = false;
    };
  }, [row.key, from, to]);

  // Long ranges are averaged into days so the chart stays light.
  const series = useMemo(() => {
    if (!rowsData?.length) return null;
    const daily = (new Date(to).getTime() - new Date(from).getTime()) / DAY > 45;
    const buckets = new Map<string, GenerationRow[]>();
    for (const r of rowsData) {
      const k = daily ? String(r.ts_utc).slice(0, 10) : String(r.ts_utc).slice(0, 16);
      (buckets.get(k) ?? buckets.set(k, []).get(k)!).push(r);
    }
    const keys = [...buckets.keys()].sort();
    const used = FUELS.filter((f) => rowsData.some((r) => Number(r[f.key]) > 0));
    return {
      x: keys.map((k) => new Date(daily ? `${k}T12:00:00Z` : `${k}:00Z`)),
      lines: used.map((f) => ({
        id: f.key,
        label: f.key,
        color: f.colour,
        area: true,
        stack: "total",
        showMark: false,
        data: keys.map((k) => {
          const b = buckets.get(k)!;
          return b.reduce((s, r) => s + (Number(r[f.key]) || 0), 0) / b.length;
        }),
      })),
    };
  }, [rowsData, from, to]);

  const preset = (days: number) => {
    setTo(iso(end));
    setFrom(iso(end - days * DAY));
  };
  const useFullYear = () => {
    if (!fullYear) return;
    setFrom(fullYear[0]);
    setTo(fullYear[1]);
  };

  return (
    <Drawer anchor="right" open onClose={onClose} slotProps={{ paper: { sx: { width: { xs: "100%", md: 860 }, p: 3 } } }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {row.label}
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {row.key} · data {row.first} → {row.last}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <IconButton aria-label="Close" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </Box>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "center", mb: 2 }}>
        <TextField size="small" type="date" label="From" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField size="small" type="date" label="To" value={to} onChange={(e) => e.target.value && setTo(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        {fullYear && (
          <Button size="small" onClick={useFullYear}>
            Last full year ({fullYear[0].slice(0, 4)})
          </Button>
        )}
        {[7, 30, 90].map((d) => (
          <Button key={d} size="small" onClick={() => preset(d)}>
            Last {d} days
          </Button>
        ))}
      </Box>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 4, mb: 2 }}>
        <Kpi label="Carbon intensity" value={metrics?.carbon_intensity != null ? `${Math.round(metrics.carbon_intensity)} g/kWh` : "-"} />
        <Kpi label="Low-carbon share" value={metrics?.low_carbon_percentage != null ? `${Math.round(metrics.low_carbon_percentage)}%` : "-"} />
        <Kpi label="Total generation" value={metrics?.total_generation_mwh != null ? `${Math.round(metrics.total_generation_mwh / 1000).toLocaleString()} GWh` : "-"} />
      </Box>
      {err && <Alert severity="error">{err}</Alert>}
      {!rowsData && !err && <CircularProgress size={22} />}
      {rowsData && !series && <Typography variant="body2">No generation recorded for this period.</Typography>}
      {series && (
        <>
          <Typography sx={{ fontWeight: 600, mb: 1 }}>Generation (MW)</Typography>
          <LineChart height={380} xAxis={[{ scaleType: "time", data: series.x }]} series={series.lines} />
        </>
      )}
      <Typography sx={{ fontWeight: 600, mt: 4, mb: 1 }}>Data quality by day</Typography>
      <Typography variant="body2" sx={{ color: "text.secondary", mb: 1 }}>
        Each cell is a day. Click a flagged day or range to chart it above.
      </Typography>
      <QualityPanel
        region={row.key}
        onPick={(f) => {
          // a little context either side so the problem is not the whole chart
          const pad = 3 * DAY;
          setFrom(iso(Date.parse(f.from) - pad));
          setTo(iso(Math.min(Date.parse(f.to) + pad, end)));
        }}
      />
      <Typography sx={{ fontWeight: 600, mt: 4, mb: 1 }}>Installed capacity</Typography>
      {capacity ? <CapacityChart rows={capacity} /> : <CircularProgress size={22} />}
    </Drawer>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="caption" sx={{ color: "text.secondary", textTransform: "uppercase", letterSpacing: 0.5 }}>
        {label}
      </Typography>
      <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
        {value}
      </Typography>
    </Box>
  );
}
