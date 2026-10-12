import { useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import { fetchFreshness } from "../lib/fgs";
import type { FreshnessRow } from "../lib/fgs";
import { jurisdictionName } from "../../../src/lib/jurisdictions";

// A source "is live" if its newest data is this recent; a region is "behind" if it trails its own
// source's newest data by more than BEHIND_DAYS (a stalled loader, not a finished archive).
const LIVE_DAYS = 3;
const DELAYED_DAYS = 30;
const BEHIND_DAYS = 7;

type Status = "live" | "delayed" | "stale";
const statusOf = (age: number): Status => (age <= LIVE_DAYS ? "live" : age <= DELAYED_DAYS ? "delayed" : "stale");
const COLOUR: Record<Status, "success" | "warning" | "default"> = { live: "success", delayed: "warning", stale: "default" };

interface SourceSummary {
  key: string;
  dataset: string;
  source: string;
  regions: number;
  latest: string;
  ageDays: number;
  status: Status;
  behind: FreshnessRow[];
  lastCleaned: string | null;
  rows: FreshnessRow[];
}

const day = (iso: string | null) => (iso ? iso.slice(0, 10) : "-");

// Where the data stops, per source and region, measured against today and against each source's
// own newest region. A source that is live but has regions trailing it is the signature of a
// loader that has silently stalled for part of its data.
export default function FreshnessPanel() {
  const [rows, setRows] = useState<FreshnessRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetchFreshness()
      .then((d) => live && setRows(d.rows))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, []);

  const sources = useMemo<SourceSummary[]>(() => {
    if (!rows) return [];
    const by = new Map<string, FreshnessRow[]>();
    for (const r of rows) (by.get(`${r.dataset}|${r.source}`) ?? by.set(`${r.dataset}|${r.source}`, []).get(`${r.dataset}|${r.source}`)!).push(r);
    return [...by.entries()]
      .map(([key, rs]) => {
        const newest = rs.reduce((a, b) => (a.last_ts > b.last_ts ? a : b));
        const age = newest.age_days;
        return {
          key,
          dataset: rs[0].dataset,
          source: rs[0].source,
          regions: rs.length,
          latest: newest.last_ts,
          ageDays: age,
          status: statusOf(age),
          behind: age <= DELAYED_DAYS ? rs.filter((r) => r.behind_source_days > BEHIND_DAYS) : [],
          lastCleaned: rs[0].last_cleaned,
          rows: [...rs].sort((a, b) => b.age_days - a.age_days),
        };
      })
      .sort((a, b) => b.behind.length - a.behind.length || a.ageDays - b.ageDays);
  }, [rows]);

  const alerts = sources.filter((s) => s.behind.length > 0);
  const staleRegions = rows?.filter((r) => statusOf(r.age_days) === "stale").length ?? 0;

  return (
    <Box>
      <Typography variant="body2" sx={{ color: "text.secondary", my: 2 }}>
        How recent each source&apos;s data is. <strong>Live</strong> means it reaches within {LIVE_DAYS} days of today, <strong>delayed</strong> within {DELAYED_DAYS}, otherwise{" "}
        <strong>stale</strong> (an archive, or a loader that stopped). A region more than {BEHIND_DAYS} days behind its own live source is flagged, since that is how a stalled loader shows
        up. &quot;Last cleaned&quot; is the source&apos;s most recent cleaning run.
      </Typography>
      {error && <Alert severity="error">{error}</Alert>}
      {!rows && !error && <CircularProgress size={22} />}
      {rows && (
        <>
          {alerts.length > 0 ? (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {alerts.map((s) => `${s.source} (${s.dataset}): ${s.behind.length} region${s.behind.length > 1 ? "s" : ""} behind`).join(" · ")}
            </Alert>
          ) : (
            <Alert severity="success" sx={{ mb: 2 }}>
              No region is lagging behind a live source.
            </Alert>
          )}
          <Typography variant="body2" sx={{ mb: 1, color: "text.secondary" }}>
            {sources.length} sources · {rows.length} series · {staleRegions} series stale
          </Typography>
          <Box sx={{ overflow: "auto", maxHeight: "65vh", border: 1, borderColor: "divider", borderRadius: 1 }}>
            <Box component="table" sx={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
              <thead>
                <tr>
                  {["Source", "Data", "Status", "Newest data", "Age", "Regions", "Behind", "Last cleaned"].map((h) => (
                    <Box component="th" key={h} sx={{ position: "sticky", top: 0, zIndex: 1, bgcolor: "background.paper", textAlign: "left", p: 1, borderBottom: 1, borderColor: "divider", whiteSpace: "nowrap" }}>
                      {h}
                    </Box>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sources.map((s) => (
                  <SourceRows key={s.key} s={s} open={open === s.key} onToggle={() => setOpen(open === s.key ? null : s.key)} />
                ))}
              </tbody>
            </Box>
          </Box>
        </>
      )}
    </Box>
  );
}

function SourceRows({ s, open, onToggle }: { s: SourceSummary; open: boolean; onToggle: () => void }) {
  return (
    <>
      <Box component="tr" onClick={onToggle} sx={{ cursor: "pointer", "&:hover": { bgcolor: "action.hover" } }}>
        <Td>
          <strong>{open ? "▾" : "▸"} {s.source}</strong>
        </Td>
        <Td>{s.dataset}</Td>
        <Td>
          <Chip size="small" label={s.status} color={COLOUR[s.status]} />
        </Td>
        <Td>{day(s.latest)}</Td>
        <Td>{Math.round(s.ageDays)}d</Td>
        <Td>{s.regions}</Td>
        <Td>{s.behind.length ? <Chip size="small" color="warning" label={`${s.behind.length} behind`} /> : "-"}</Td>
        <Td>{day(s.lastCleaned)}</Td>
      </Box>
      {open &&
        s.rows.map((r) => {
          const behind = r.behind_source_days > BEHIND_DAYS && s.status !== "stale";
          return (
            <Box component="tr" key={r.region_code} sx={{ bgcolor: behind ? "rgba(245,158,11,0.12)" : "action.hover" }}>
              <Td>
                <span style={{ paddingLeft: 18 }}>
                  {r.region_code} <span style={{ opacity: 0.7 }}>{jurisdictionName(r.region_code) !== r.region_code ? jurisdictionName(r.region_code) : ""}</span>
                </span>
              </Td>
              <Td />
              <Td>
                <Chip size="small" variant="outlined" label={statusOf(r.age_days)} color={COLOUR[statusOf(r.age_days)]} />
              </Td>
              <Td>{day(r.last_ts)}</Td>
              <Td>{Math.round(r.age_days)}d</Td>
              <Td />
              <Td>{behind ? `${Math.round(r.behind_source_days)}d behind source` : "-"}</Td>
              <Td />
            </Box>
          );
        })}
    </>
  );
}

function Td({ children }: { children?: React.ReactNode }) {
  return (
    <Box component="td" sx={{ p: 1, borderBottom: 1, borderColor: "divider", whiteSpace: "nowrap" }}>
      {children}
    </Box>
  );
}
