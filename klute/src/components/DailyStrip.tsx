import { useMemo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { KIND_COLOUR } from "../lib/quality";
import type { Finding, QualitySeries } from "../lib/fgs";

const OK = "#01ADBF";
const CELL = 3;
const GAP = 1;

const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);

interface Props {
  series: QualitySeries;
  /** Called with a finding's date range when its cells are clicked. */
  onPick?: (f: Finding) => void;
}

// One row per calendar year, one cell per day: teal where the day looks normal, the finding's
// colour where a rule flagged it, red where there is no data. Spots a hole or a bad stretch in
// a decade of days at a glance; clicking a flagged cell jumps the charts to that range.
export default function DailyStrip({ series, onPick }: Props) {
  const { years, byDay } = useMemo(() => {
    const present = new Map(series.days.map((d) => [d.d, d]));
    const flagged = new Map<string, Finding>();
    const rank = { high: 3, medium: 2, low: 1 } as const;
    for (const f of series.findings) {
      for (let t = Date.parse(f.from); t <= Date.parse(f.to); t += 86_400_000) {
        const k = dayKey(t);
        const cur = flagged.get(k);
        if (!cur || rank[f.severity] > rank[cur.severity]) flagged.set(k, f);
      }
    }
    const first = series.days[0]?.d ?? "";
    const last = series.days[series.days.length - 1]?.d ?? "";
    const ys: string[] = [];
    for (let y = Number(first.slice(0, 4)); y <= Number(last.slice(0, 4)); y++) ys.push(String(y));
    return { years: ys, byDay: { present, flagged, first, last } };
  }, [series]);

  if (!years.length) return null;

  return (
    <Box sx={{ overflowX: "auto", pb: 1 }}>
      {years.map((y) => {
        const start = Date.UTC(Number(y), 0, 1);
        const n = (Date.UTC(Number(y) + 1, 0, 1) - start) / 86_400_000;
        return (
          <Box key={y} sx={{ display: "flex", alignItems: "center", gap: 1, mb: "2px" }}>
            <Typography variant="caption" sx={{ width: 34, color: "text.secondary" }}>
              {y}
            </Typography>
            <svg width={n * (CELL + GAP)} height={10} style={{ display: "block" }}>
              {Array.from({ length: n }, (_, i) => {
                const k = dayKey(start + i * 86_400_000);
                if (k < byDay.first || k > byDay.last) return null;
                const f = byDay.flagged.get(k);
                const has = byDay.present.get(k);
                const colour = f ? KIND_COLOUR[f.kind] : has ? OK : KIND_COLOUR.missing;
                const label = f ? `${k}: ${f.kind} - ${f.detail}` : has ? `${k}: ok (${has.n} readings, mean ${has.mean.toLocaleString()} MW)` : `${k}: no data`;
                return (
                  <rect key={k} x={i * (CELL + GAP)} y={0} width={CELL} height={10} fill={colour} opacity={f || !has ? 1 : 0.55} style={{ cursor: f && onPick ? "pointer" : "default" }} onClick={f && onPick ? () => onPick(f) : undefined}>
                    <title>{label}</title>
                  </rect>
                );
              })}
            </svg>
          </Box>
        );
      })}
    </Box>
  );
}
