import { useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import { useTheme } from "@mui/material/styles";
import worldUrl from "../../../src/assets/jurisdictions.geojson?url";
import { countryOf } from "../lib/countryStatus";

interface Props {
  /** country code -> 0..1 (undefined = no figure) */
  scores: Record<string, number>;
  selected: string | null;
  onSelect: (code: string) => void;
  /** Hover text for a country. */
  describe: (code: string) => string;
}

interface Shape {
  code: string;
  country: string;
  d: string;
}

const WORLD = { x: -180, y: -90, w: 360, h: 180 };
// red-ish (little) -> amber -> teal (complete)
const RAMP = ["#E5484D", "#F59E0B", "#FDE68A", "#7DD3A8", "#01ADBF"];

function colour(t: number): string {
  const x = Math.min(1, Math.max(0, t)) * (RAMP.length - 1);
  const i = Math.min(RAMP.length - 2, Math.floor(x));
  const f = x - i;
  const ch = (h: string, k: number) => parseInt(h.slice(1 + k * 2, 3 + k * 2), 16);
  return `rgb(${[0, 1, 2].map((k) => Math.round(ch(RAMP[i], k) + (ch(RAMP[i + 1], k) - ch(RAMP[i], k)) * f)).join(",")})`;
}

// A world map with each country filled by how many of its data layers are present. Subdivided
// countries (Australia, the US) are filled by their country's score. Wheel to zoom, drag to pan.
export default function CountryMap({ scores, selected, onSelect, describe }: Props) {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [view, setView] = useState(WORLD);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ px: number; py: number; v: typeof WORLD; moved: boolean } | null>(null);

  useEffect(() => {
    fetch(worldUrl)
      .then((r) => r.json())
      .then((data: { features: { properties: { code: string }; geometry: { type: string; coordinates: number[][][] | number[][][][] } }[] }) => {
        const ring = (r: number[][]) => `M${r.map(([lon, lat]) => `${lon.toFixed(2)} ${(-lat).toFixed(2)}`).join("L")}Z`;
        setShapes(
          data.features.map((f) => {
            const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates as number[][][]] : (f.geometry.coordinates as number[][][][]);
            return { code: f.properties.code, country: countryOf(f.properties.code), d: polys.flatMap((p) => p.map(ring)).join("") };
          }),
        );
      });
  }, []);

  const unknownFill = dark ? "#2A3A40" : "#D9DEE0";
  const fills = useMemo(() => Object.fromEntries(shapes.map((s) => [s.code, scores[s.country] === undefined ? unknownFill : colour(scores[s.country])])), [shapes, scores, unknownFill]);

  const onWheel = (e: React.WheelEvent) => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r) return;
    const fx = (e.clientX - r.left) / r.width;
    const fy = (e.clientY - r.top) / r.height;
    const k = e.deltaY > 0 ? 1.2 : 1 / 1.2;
    setView((v) => {
      const w = Math.min(360, v.w * k);
      const h = Math.min(180, v.h * k);
      return { x: v.x + (v.w - w) * fx, y: v.y + (v.h - h) * fy, w, h };
    });
  };

  return (
    <Box sx={{ position: "relative", border: 1, borderColor: "divider", borderRadius: 1, overflow: "hidden", bgcolor: dark ? "#0B1F26" : "#EAF3F5", touchAction: "none" }}>
      <svg
        ref={svgRef}
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ width: "100%", height: "clamp(260px, 45vh, 520px)", display: "block", cursor: "grab" }}
        onWheel={onWheel}
        onPointerDown={(e) => (drag.current = { px: e.clientX, py: e.clientY, v: view, moved: false })}
        onPointerMove={(e) => {
          const d = drag.current;
          const r = svgRef.current?.getBoundingClientRect();
          if (!d || !r) return;
          if (Math.abs(e.clientX - d.px) + Math.abs(e.clientY - d.py) > 4) d.moved = true;
          if (d.moved) setView({ ...d.v, x: d.v.x - ((e.clientX - d.px) / r.width) * d.v.w, y: d.v.y - ((e.clientY - d.py) / r.height) * d.v.h });
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerLeave={() => (drag.current = null)}
      >
        {shapes.map((s) => (
          <path
            key={s.code}
            d={s.d}
            fill={fills[s.code]}
            stroke={s.country === selected ? (dark ? "#fff" : "#111") : dark ? "#0B1F26" : "#FFFFFF"}
            strokeWidth={s.country === selected ? 1.6 : 0.4}
            vectorEffect="non-scaling-stroke"
            onClick={() => !drag.current?.moved && onSelect(s.country)}
            style={{ cursor: "pointer" }}
          >
            <title>{describe(s.country)}</title>
          </path>
        ))}
      </svg>
      <Box sx={{ position: "absolute", right: 8, top: 8 }}>
        <Button size="small" variant="outlined" onClick={() => setView(WORLD)} sx={{ bgcolor: "background.paper" }}>
          World
        </Button>
      </Box>
      <Box sx={{ position: "absolute", left: 10, bottom: 8, display: "flex", alignItems: "center", gap: 1, fontSize: 11 }}>
        <span>none</span>
        <Box sx={{ width: 120, height: 8, borderRadius: 1, background: `linear-gradient(to right, ${RAMP.join(",")})` }} />
        <span>fully complete</span>
      </Box>
    </Box>
  );
}
