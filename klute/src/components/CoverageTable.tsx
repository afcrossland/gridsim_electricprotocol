import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import Button from "@mui/material/Button";
import { daysSince, downloadCsv, monthRange, rowsToCsv } from "../lib/coverage";
import type { CoverageRow } from "../lib/coverage";

const MONTH_CELL = 9;
// Yearly grids get wide cells so each year can carry its own label.
const YEAR_CELL = 38;
const LABEL_COL = 230;
const STATS_COL = 170;
const TEAL = "#01ADBF";
const GAP_RED = "#E5484D";

type SortKey = "name" | "first" | "last" | "completeness";

interface Props {
  rows: CoverageRow[];
  kind: "months" | "years";
  csvName: string;
  /** Click a row label (omit for inert rows). */
  onSelect?: (row: CoverageRow) => void;
  onRefresh?: () => void;
}

// Which dates exist, and which don't, per row: one cell per month (or year), tinted by how much
// of it has data, red where a row has a hole inside its own date range.
export default function CoverageTable({ rows, kind, csvName, onSelect, onRefresh }: Props) {
  const cell = kind === "years" ? YEAR_CELL : MONTH_CELL;
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("name");
  const [onlyGaps, setOnlyGaps] = useState(false);
  const [windowYears, setWindowYears] = useState(kind === "months" ? 3 : 0);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = rows.filter((r) => (!q || r.key.toLowerCase().includes(q) || r.label.toLowerCase().includes(q)) && (!onlyGaps || r.gaps > 0));
    const by: Record<SortKey, (a: CoverageRow, b: CoverageRow) => number> = {
      name: (a, b) => a.label.localeCompare(b.label),
      first: (a, b) => a.first.localeCompare(b.first),
      last: (a, b) => b.last.localeCompare(a.last),
      completeness: (a, b) => a.completeness - b.completeness,
    };
    return [...list].sort(by[sort]);
  }, [rows, query, sort, onlyGaps]);

  const columns = useMemo(() => {
    const starts = rows.map((r) => r.first).filter(Boolean).sort();
    const ends = rows.map((r) => r.last).filter(Boolean).sort();
    if (!starts.length) return [];
    const endYear = Number(ends[ends.length - 1].slice(0, 4));
    const startYear = windowYears ? Math.max(Number(starts[0].slice(0, 4)), endYear - windowYears + 1) : Number(starts[0].slice(0, 4));
    if (kind === "years") return Array.from({ length: endYear - startYear + 1 }, (_, i) => String(startYear + i));
    return monthRange(`${startYear}-01`, ends[ends.length - 1]);
  }, [rows, kind, windowYears]);

  const headers = useMemo(() => {
    const out: { label: string; span: number }[] = [];
    for (const c of columns) {
      const y = c.slice(0, 4);
      const last = out[out.length - 1];
      if (kind === "months" && last && last.label === y) last.span += 1;
      else out.push({ label: kind === "months" ? y : c, span: 1 });
    }
    return out;
  }, [columns, kind]);

  const withData = rows.filter((r) => r.first);
  const stats: string[][] = [
    ["Rows", String(rows.length)],
    ["Earliest", withData.map((r) => r.first).sort()[0] ?? "-"],
    ["Latest", withData.map((r) => r.last).sort().slice(-1)[0] ?? "-"],
    ["Average completeness", `${Math.round((withData.reduce((s, r) => s + r.completeness, 0) / (withData.length || 1)) * 100)}%`],
    ["With gaps", String(rows.filter((r) => r.gaps > 0).length)],
    // "Ended >90 days ago" only means something for month-level data; yearly rows always end on a year.
    ...(kind === "months" ? [["Ended >90 days ago", String(withData.filter((r) => daysSince(r.last) > 90).length)]] : []),
  ];

  return (
    <Box>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 4, my: 2 }}>
        {stats.map(([label, value]) => (
          <Box key={label}>
            <Typography variant="caption" sx={{ color: "text.secondary", textTransform: "uppercase", letterSpacing: 0.5 }}>
              {label}
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
              {value}
            </Typography>
          </Box>
        ))}
      </Box>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center", mb: 2 }}>
        <TextField size="small" label="Filter" value={query} onChange={(e) => setQuery(e.target.value)} />
        <TextField size="small" select label="Sort by" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} sx={{ minWidth: 180 }}>
          <MenuItem value="name">Name</MenuItem>
          <MenuItem value="first">Earliest start</MenuItem>
          <MenuItem value="last">Latest end first</MenuItem>
          <MenuItem value="completeness">Least complete first</MenuItem>
        </TextField>
        {kind === "months" && (
          <TextField size="small" select label="Show" value={windowYears} onChange={(e) => setWindowYears(Number(e.target.value))} sx={{ minWidth: 150 }}>
            <MenuItem value={1}>Latest year</MenuItem>
            <MenuItem value={3}>Latest 3 years</MenuItem>
            <MenuItem value={5}>Latest 5 years</MenuItem>
            <MenuItem value={0}>Everything</MenuItem>
          </TextField>
        )}
        <FormControlLabel control={<Switch checked={onlyGaps} onChange={(e) => setOnlyGaps(e.target.checked)} />} label="Only rows with gaps" />
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Showing {visible.length} of {rows.length}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Button size="small" onClick={() => downloadCsv(`${csvName}.csv`, rowsToCsv(visible))}>
          Export CSV
        </Button>
        {onRefresh && (
          <Button size="small" onClick={onRefresh}>
            Refresh
          </Button>
        )}
      </Box>

      {!visible.length ? (
        <Typography variant="body2">Nothing matches the filter.</Typography>
      ) : (
        <Box sx={{ overflow: "auto", maxHeight: "65vh", border: 1, borderColor: "divider", borderRadius: 1 }}>
          <Box sx={{ display: "grid", gridTemplateColumns: `${LABEL_COL}px ${STATS_COL}px repeat(${columns.length}, ${cell}px)`, width: "max-content", fontSize: 12 }}>
            <Head left={0}>Name</Head>
            <Head left={LABEL_COL}>Range · complete · gaps</Head>
            {headers.map((h, i) => (
              <Head key={`${h.label}-${i}`} span={h.span}>
                {h.span >= 3 || kind === "years" ? h.label : ""}
              </Head>
            ))}
            {visible.map((r) => (
              <Line key={r.key} row={r} columns={columns} cell={cell} onSelect={onSelect} />
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}

function Head({ children, span, left }: { children: React.ReactNode; span?: number; left?: number }) {
  return (
    <Box
      sx={{
        gridColumn: span ? `span ${span}` : undefined,
        position: "sticky",
        top: 0,
        left,
        zIndex: left === undefined ? 3 : 4,
        bgcolor: "background.paper",
        borderBottom: 1,
        borderColor: "divider",
        px: 0.5,
        py: 0.5,
        fontWeight: 600,
        whiteSpace: "nowrap",
        overflow: "hidden",
      }}
    >
      {children}
    </Box>
  );
}

function Line({ row, columns, cell, onSelect }: { row: CoverageRow; columns: string[]; cell: number; onSelect?: (row: CoverageRow) => void }) {
  return (
    <>
      <Box
        title={row.sub ? `${row.key} - ${row.sub}` : row.key}
        onClick={onSelect ? () => onSelect(row) : undefined}
        sx={{ position: "sticky", left: 0, zIndex: 2, bgcolor: "background.paper", px: 0.5, py: 0.25, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", cursor: onSelect ? "pointer" : "default", "&:hover": onSelect ? { color: TEAL } : undefined }}
      >
        <strong>{row.key}</strong> <span style={{ opacity: 0.7 }}>{row.label !== row.key ? row.label : ""}</span>
      </Box>
      <Box sx={{ position: "sticky", left: LABEL_COL, zIndex: 2, bgcolor: "background.paper", px: 0.5, py: 0.25, whiteSpace: "nowrap", color: "text.secondary" }}>
        {row.first || "-"} → {row.last || "-"} · {Math.round(row.completeness * 100)}% · {row.gaps}
      </Box>
      {columns.map((c) => {
        const fill = row.cells[c];
        const inSpan = fill !== undefined;
        const bg = !inSpan ? undefined : fill === 0 ? GAP_RED : `rgba(1, 173, 191, ${0.25 + 0.75 * fill})`;
        const title = !inSpan ? `${row.key} ${c}: outside this row's range` : fill === 0 ? `${row.key} ${c}: no data` : `${row.key} ${c}: ${Math.round(fill * 100)}% has data`;
        return <Box key={c} title={title} sx={{ height: 13, alignSelf: "center", width: cell - 1, mx: "0.5px", borderRadius: "1px", bgcolor: bg ?? "action.hover", opacity: inSpan ? 1 : 0.5 }} />;
      })}
    </>
  );
}
