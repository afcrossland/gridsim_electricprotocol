import { useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { fetchQualitySummary } from "../lib/fgs";
import type { FindingKind, QualitySummaryRow } from "../lib/fgs";
import { KIND_COLOUR } from "../lib/quality";
import { downloadCsv } from "../lib/coverage";
import { jurisdictionName } from "../../../src/lib/jurisdictions";
import Button from "@mui/material/Button";

const KINDS = Object.keys(KIND_COLOUR) as FindingKind[];

interface Props {
  /** Open a region in the drawer. */
  onSelect: (region: string) => void;
}

// Every region's flagged days at once, worst first: where to look before trusting a chart.
export default function QualitySummary({ onSelect }: Props) {
  const [dataset, setDataset] = useState<"generation" | "demand">("generation");
  const [rows, setRows] = useState<QualitySummaryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<FindingKind | "any">("any");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let live = true;
    setRows(null);
    setError(null);
    fetchQualitySummary(dataset)
      .then((d) => live && setRows(d.series))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [dataset]);

  const shown = useMemo(() => {
    if (!rows) return [];
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => (kind === "any" ? r.flagged_days > 0 : (r.by_kind[kind] ?? 0) > 0))
      .filter((r) => !q || r.region_code.toLowerCase().includes(q) || jurisdictionName(r.region_code).toLowerCase().includes(q) || r.source.toLowerCase().includes(q))
      .sort((a, b) => (kind === "any" ? b.flagged_days - a.flagged_days : (b.by_kind[kind] ?? 0) - (a.by_kind[kind] ?? 0)));
  }, [rows, kind, query]);

  const total = rows?.length ?? 0;
  const clean = rows?.filter((r) => r.flagged_days === 0).length ?? 0;

  return (
    <Box>
      <Typography variant="body2" sx={{ color: "text.secondary", my: 2 }}>
        Rules run over every day of each raw series: missing days, partial days, near-zero or spiking daily means, intra-day dips, flat-lined, zero and negative totals. Click a row for the
        day-by-day view.
      </Typography>
      {error && <Alert severity="error">{error}</Alert>}
      {!rows && !error && (
        <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
          <CircularProgress size={22} />
          <Typography variant="body2">Scanning every series. The first load can take a few seconds.</Typography>
        </Box>
      )}
      {rows && (
        <>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center", mb: 2 }}>
            <TextField size="small" select label="Series" value={dataset} onChange={(e) => setDataset(e.target.value as "generation" | "demand")} sx={{ minWidth: 130 }}>
              <MenuItem value="generation">Generation</MenuItem>
              <MenuItem value="demand">Demand</MenuItem>
            </TextField>
            <TextField size="small" select label="Finding" value={kind} onChange={(e) => setKind(e.target.value as FindingKind | "any")} sx={{ minWidth: 150 }}>
              <MenuItem value="any">Any</MenuItem>
              {KINDS.map((k) => (
                <MenuItem key={k} value={k}>
                  {k}
                </MenuItem>
              ))}
            </TextField>
            <TextField size="small" label="Filter" value={query} onChange={(e) => setQuery(e.target.value)} />
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {shown.length} series shown · {clean} of {total} have nothing flagged
            </Typography>
            <Box sx={{ flex: 1 }} />
            <Button
              size="small"
              onClick={() =>
                downloadCsv(
                  `fgs-${dataset}-quality.csv`,
                  ["region,source,days,flagged_days," + KINDS.join(","), ...shown.map((r) => [r.region_code, r.source, r.days, r.flagged_days, ...KINDS.map((k) => r.by_kind[k] ?? 0)].join(","))].join("\n"),
                )
              }
            >
              Export CSV
            </Button>
          </Box>
          <Box sx={{ overflow: "auto", maxHeight: "65vh", border: 1, borderColor: "divider", borderRadius: 1 }}>
            <Box component="table" sx={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
              <thead>
                <tr>
                  {["Region", "Source", "Days", "Flagged", ...KINDS].map((h) => (
                    <Box component="th" key={h} sx={{ position: "sticky", top: 0, bgcolor: "background.paper", textAlign: "left", p: 1, borderBottom: 1, borderColor: "divider", whiteSpace: "nowrap" }}>
                      {h}
                    </Box>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <Box component="tr" key={`${r.region_code}|${r.source}`} onClick={() => onSelect(r.region_code)} sx={{ cursor: "pointer", "&:hover": { bgcolor: "action.hover" } }}>
                    <Td>
                      <strong>{r.region_code}</strong> {jurisdictionName(r.region_code) !== r.region_code ? jurisdictionName(r.region_code) : ""}
                    </Td>
                    <Td>{r.source}</Td>
                    <Td>{r.days.toLocaleString()}</Td>
                    <Td>
                      <Chip size="small" label={r.flagged_days} color={r.worst === "high" ? "error" : r.worst === "medium" ? "warning" : "default"} />
                    </Td>
                    {KINDS.map((k) => (
                      <Td key={k}>{r.by_kind[k] ? <span style={{ color: KIND_COLOUR[k], fontWeight: 600 }}>{r.by_kind[k]}</span> : <span style={{ opacity: 0.3 }}>·</span>}</Td>
                    ))}
                  </Box>
                ))}
              </tbody>
            </Box>
          </Box>
        </>
      )}
    </Box>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <Box component="td" sx={{ p: 1, borderBottom: 1, borderColor: "divider", whiteSpace: "nowrap" }}>
      {children}
    </Box>
  );
}
