import { useEffect, useMemo, useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import worldUrl from "../../../src/assets/jurisdictions.geojson?url";
import { fetchWeatherField, fetchWeatherMeta } from "../lib/fgs";
import type { WeatherAgg, WeatherField, WeatherSeriesMeta } from "../lib/fgs";

const UNITS: Record<string, string> = { ghi: "W/m²", dhi: "W/m²", bni: "W/m²", t2m: "K", u10: "m/s", v10: "m/s" };
// dark blue -> teal -> yellow
const RAMP = ["#1E1B4B", "#3B3B98", "#0F7C95", "#01ADBF", "#7DD3A8", "#F5E663", "#F59E0B"];

function colour(t: number): string {
  const x = Math.min(1, Math.max(0, t)) * (RAMP.length - 1);
  const i = Math.min(RAMP.length - 2, Math.floor(x));
  const f = x - i;
  const a = RAMP[i];
  const b = RAMP[i + 1];
  const ch = (h: string, k: number) => parseInt(h.slice(1 + k * 2, 3 + k * 2), 16);
  return `rgb(${[0, 1, 2].map((k) => Math.round(ch(a, k) + (ch(b, k) - ch(a, k)) * f)).join(",")})`;
}

/** The grid's cell size: the median gap between neighbouring distinct values. Land-only grids have
 * irregular holes and the odd off-grid point, so a minimum would be dragged down by noise. */
function spacing(values: number[]): number {
  const u = [...new Set(values.map((v) => Math.round(v * 100) / 100))].sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let i = 1; i < u.length; i++) {
    const d = u[i] - u[i - 1];
    if (d > 0.005) gaps.push(d);
  }
  if (!gaps.length) return 1;
  gaps.sort((x, y) => x - y);
  return gaps[Math.floor(gaps.length / 2)];
}

interface Box4 {
  x: number;
  y: number;
  w: number;
  h: number;
}

const WORLD: Box4 = { x: -180, y: -90, w: 360, h: 180 };

// A weather/irradiance field on a map: every grid point of a source/variable at one hour, day or
// month, as coloured cells over country outlines. Wheel to zoom, drag to pan. Drawn as plain SVG
// in lon/lat space, so it needs no tile service or map key.
export default function WeatherMap() {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  const [meta, setMeta] = useState<WeatherSeriesMeta[]>([]);
  const [source, setSource] = useState("era5");
  const [variable, setVariable] = useState("ghi");
  const [agg, setAgg] = useState<WeatherAgg>("day");
  const [date, setDate] = useState("2024-06-15");
  const [hour, setHour] = useState(12);
  const [field, setField] = useState<WeatherField | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [outline, setOutline] = useState("");
  const [view, setView] = useState<Box4>(WORLD);
  const fitted = useRef("");

  useEffect(() => {
    fetchWeatherMeta().then(setMeta).catch((e: Error) => setError(e.message));
    fetch(worldUrl)
      .then((r) => r.json())
      .then((data: { features: { geometry: { type: string; coordinates: number[][][] | number[][][][] } }[] }) => {
      const ring = (r: number[][]) => `M${r.map(([lon, lat]) => `${lon.toFixed(2)} ${(-lat).toFixed(2)}`).join("L")}Z`;
      const parts: string[] = [];
      for (const f of data.features) {
        const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates as number[][][]] : (f.geometry.coordinates as number[][][][]);
        for (const poly of polys) for (const r of poly) parts.push(ring(r));
      }
      setOutline(parts.join(""));
    });
  }, []);

  const sources = [...new Set(meta.map((m) => m.source))];
  const variables = meta.filter((m) => m.source === source).map((m) => m.variable);
  const range = meta.find((m) => m.source === source && m.variable === variable);

  useEffect(() => {
    if (!meta.length) return;
    if (!variables.includes(variable)) setVariable(variables[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, meta]);

  useEffect(() => {
    if (!range) return;
    const lo = range.first.slice(0, 10);
    const hi = range.last.slice(0, 10);
    if (date < lo || date > hi) setDate(lo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  useEffect(() => {
    if (!range) return;
    let live = true;
    setField(null);
    setError(null);
    const ts = `${date}T${String(agg === "hour" ? hour : 0).padStart(2, "0")}:00:00Z`;
    fetchWeatherField(source, variable, ts, agg)
      .then((f) => live && setField(f))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [source, variable, agg, date, hour, range]);

  const cells = useMemo(() => {
    if (!field || !field.points.length) return null;
    const dx = spacing(field.points.map((p) => p[0]));
    const dy = spacing(field.points.map((p) => p[1]));
    const lo = field.min ?? 0;
    const hi = field.max ?? 1;
    return {
      dx,
      dy,
      lo,
      hi,
      rects: field.points.map(([lon, lat, v]) => ({ lon, lat, v, fill: colour(hi > lo ? (v - lo) / (hi - lo) : 0) })),
    };
  }, [field]);

  // Frame the data (cams covers one corner of Europe, era5 the world) when the series changes.
  const fitKey = `${source}|${variable}`;
  useEffect(() => {
    if (!field?.points.length || fitted.current === fitKey) return;
    fitted.current = fitKey;
    const lons = field.points.map((p) => p[0]);
    const lats = field.points.map((p) => p[1]);
    const pad = 4;
    const x = Math.min(...lons) - pad;
    const y = -Math.max(...lats) - pad;
    const w = Math.max(...lons) - Math.min(...lons) + pad * 2;
    const h = Math.max(...lats) - Math.min(...lats) + pad * 2;
    setView(w >= 300 ? WORLD : { x, y, w: Math.max(w, 10), h: Math.max(h, 6) });
  }, [field, fitKey]);

  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ px: number; py: number; v: Box4 } | null>(null);

  const onWheel = (e: React.WheelEvent) => {
    const svg = svgRef.current;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width;
    const fy = (e.clientY - r.top) / r.height;
    const k = e.deltaY > 0 ? 1.2 : 1 / 1.2;
    setView((v) => {
      const w = Math.min(360, v.w * k);
      const h = Math.min(180, v.h * k);
      return { x: v.x + (v.w - w) * fx, y: v.y + (v.h - h) * fy, w, h };
    });
  };
  const onDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, v: view };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const svg = svgRef.current;
    if (!d || !svg) return;
    const r = svg.getBoundingClientRect();
    setView({ ...d.v, x: d.v.x - ((e.clientX - d.px) / r.width) * d.v.w, y: d.v.y - ((e.clientY - d.py) / r.height) * d.v.h });
  };

  const unit = UNITS[variable] ?? "";
  const bg = dark ? "#0B1F26" : "#EAF3F5";
  const land = dark ? "#16313A" : "#FFFFFF";
  const stroke = dark ? "#3B5963" : "#B8C4C8";

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="body2" sx={{ color: "text.secondary", my: 2 }}>
        Weather and irradiance at every grid point we hold. Choose a series and a time; day and month show the mean. Scroll to zoom, drag to pan.
      </Typography>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "center", mb: 2 }}>
        <TextField size="small" select label="Source" value={source} onChange={(e) => setSource(e.target.value)} sx={{ minWidth: 110 }}>
          {sources.map((s) => (
            <MenuItem key={s} value={s}>
              {s}
            </MenuItem>
          ))}
        </TextField>
        <TextField size="small" select label="Variable" value={variables.includes(variable) ? variable : ""} onChange={(e) => setVariable(e.target.value)} sx={{ minWidth: 110 }}>
          {variables.map((v) => (
            <MenuItem key={v} value={v}>
              {v}
            </MenuItem>
          ))}
        </TextField>
        <TextField size="small" select label="Average over" value={agg} onChange={(e) => setAgg(e.target.value as WeatherAgg)} sx={{ minWidth: 130 }}>
          <MenuItem value="hour">One hour</MenuItem>
          <MenuItem value="day">A day</MenuItem>
          <MenuItem value="month">A month</MenuItem>
        </TextField>
        <TextField size="small" type="date" label="Date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: range?.first.slice(0, 10), max: range?.last.slice(0, 10) } }} />
        {agg === "hour" && (
          <TextField size="small" select label="Hour (UTC)" value={hour} onChange={(e) => setHour(Number(e.target.value))} sx={{ minWidth: 110 }}>
            {Array.from({ length: 24 }, (_, h) => (
              <MenuItem key={h} value={h}>
                {String(h).padStart(2, "0")}:00
              </MenuItem>
            ))}
          </TextField>
        )}
        <Button size="small" onClick={() => setView(WORLD)}>
          World
        </Button>
        {range && (
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            Data {range.first.slice(0, 10)} → {range.last.slice(0, 10)}
          </Typography>
        )}
      </Box>
      {error && <Alert severity="error">{error}</Alert>}
      <Box sx={{ position: "relative", border: 1, borderColor: "divider", borderRadius: 1, overflow: "hidden", bgcolor: bg, touchAction: "none" }}>
        <svg
          ref={svgRef}
          viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ width: "100%", height: "clamp(320px, 55vh, 620px)", display: "block", cursor: drag.current ? "grabbing" : "grab" }}
          onWheel={onWheel}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={() => (drag.current = null)}
          onPointerLeave={() => (drag.current = null)}
        >
          {outline && <path d={outline} fill={land} stroke={stroke} strokeWidth={0.6} vectorEffect="non-scaling-stroke" />}
          {cells?.rects.map((c, i) => (
            <rect key={i} x={c.lon - cells.dx / 2} y={-c.lat - cells.dy / 2} width={cells.dx} height={cells.dy} fill={c.fill} fillOpacity={0.85}>
              <title>{`${c.lat.toFixed(2)}, ${c.lon.toFixed(2)}: ${c.v.toFixed(1)} ${unit}`}</title>
            </rect>
          ))}
        </svg>
        {!field && !error && (
          <Box sx={{ position: "absolute", top: 12, left: 12, display: "flex", gap: 1, alignItems: "center" }}>
            <CircularProgress size={18} />
            <Typography variant="caption">Loading</Typography>
          </Box>
        )}
        {field && !cells && (
          <Typography variant="body2" sx={{ position: "absolute", top: 12, left: 12 }}>
            No data for that time.
          </Typography>
        )}
      </Box>
      {cells && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1, maxWidth: 520 }}>
          <Typography variant="caption">{cells.lo.toFixed(1)}</Typography>
          <Box sx={{ flex: 1, height: 10, borderRadius: 1, background: `linear-gradient(to right, ${RAMP.join(",")})` }} />
          <Typography variant="caption">
            {cells.hi.toFixed(1)} {unit}
          </Typography>
          <Typography variant="caption" sx={{ color: "text.secondary", ml: 1 }}>
            {field?.points.length.toLocaleString()} points
          </Typography>
        </Box>
      )}
    </Box>
  );
}
