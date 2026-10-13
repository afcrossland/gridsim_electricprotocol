import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import DailyStrip from "./DailyStrip";
import { KIND_COLOUR } from "../lib/quality";
import { fetchQualityRegion } from "../lib/fgs";
import type { Finding, QualitySeries } from "../lib/fgs";

interface Props {
  region: string;
  /** Called with a finding's range so the caller can point its charts at it. */
  onPick?: (f: Finding) => void;
}

// A region's day-by-day data quality: a strip per source and the list of flagged ranges.
export default function QualityPanel({ region, onPick }: Props) {
  const [dataset, setDataset] = useState<"generation" | "demand">("generation");
  const [series, setSeries] = useState<QualitySeries[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setSeries(null);
    setError(null);
    fetchQualityRegion(dataset, region)
      .then((d) => live && (setSeries(d.sources), setSource(d.sources[0]?.source ?? null)))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [region, dataset]);

  const current = series?.find((s) => s.source === source) ?? series?.[0];

  return (
    <Box>
      <Box sx={{ display: "flex", gap: 2, alignItems: "center", mb: 1, flexWrap: "wrap" }}>
        <TextField size="small" select label="Series" value={dataset} onChange={(e) => setDataset(e.target.value as "generation" | "demand")} sx={{ minWidth: 130 }}>
          <MenuItem value="generation">Generation</MenuItem>
          <MenuItem value="demand">Demand</MenuItem>
        </TextField>
        {series && series.length > 1 && (
          <TextField size="small" select label="Source" value={current?.source ?? ""} onChange={(e) => setSource(e.target.value)} sx={{ minWidth: 140 }}>
            {series.map((s) => (
              <MenuItem key={s.source} value={s.source}>
                {s.source}
              </MenuItem>
            ))}
          </TextField>
        )}
      </Box>
      {error && <Alert severity="error">{error}</Alert>}
      {!series && !error && <CircularProgress size={22} />}
      {series && !current && <Typography variant="body2">No {dataset} data for this region.</Typography>}
      {current && (
        <>
          <DailyStrip series={current} onPick={onPick} />
          {current.findings.length === 0 ? (
            <Typography variant="body2" sx={{ mt: 1 }}>
              Nothing flagged across {current.days.length.toLocaleString()} days.
            </Typography>
          ) : (
            <Box sx={{ mt: 1.5, maxHeight: 280, overflow: "auto", border: 1, borderColor: "divider", borderRadius: 1 }}>
              {current.findings.map((f, i) => (
                <Box
                  key={`${f.kind}-${f.from}-${i}`}
                  onClick={onPick ? () => onPick(f) : undefined}
                  sx={{ display: "flex", gap: 1.5, alignItems: "center", px: 1.5, py: 0.75, borderBottom: 1, borderColor: "divider", cursor: onPick ? "pointer" : "default", "&:hover": onPick ? { bgcolor: "action.hover" } : undefined }}
                >
                  <Chip size="small" label={f.kind} sx={{ bgcolor: KIND_COLOUR[f.kind], color: "#fff", minWidth: 70 }} />
                  <Typography variant="body2" sx={{ minWidth: 190 }}>
                    {f.from === f.to ? f.from : `${f.from} → ${f.to}`} · {f.days}d
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    {f.detail}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
