import { useEffect, useMemo, useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CountryMap from "../components/CountryMap";
import { LAYERS, buildCountryStatus } from "../lib/countryStatus";
import type { CountryStatus, LayerId } from "../lib/countryStatus";
import { downloadCsv } from "../lib/coverage";
import { fetchCoverage, fetchRegionCountries } from "../lib/fgs";
import type { FgsCoverage } from "../lib/fgs";

const TEAL = "#01ADBF";
const RED = "rgba(229,72,77,0.2)";

interface Props {
  onOpenExplorer: (tab: "fgs" | "policy" | "deployment" | "calculator") => void;
}

const EXPLORER_TAB: Record<string, "fgs" | "policy" | "deployment" | "calculator"> = {
  "Future Grid Simulator": "fgs",
  "Policy Explorer": "policy",
  "Deployment Explorer": "deployment",
  "Solar Homes Calculator": "calculator",
};

// Every country against every layer of every explorer: what exists, what is missing, and a map
// of how complete each country is. The simulator layers need the simulator backend; if it
// cannot be reached those cells read "not checked" rather than counting as missing.
export default function OverviewPanel({ onOpenExplorer }: Props) {
  const [fgs, setFgs] = useState<{ generation?: FgsCoverage; demand?: FgsCoverage; capacity?: FgsCoverage; regionCountries?: Record<string, string> } | null>(null);
  const [fgsError, setFgsError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [onlyIncomplete, setOnlyIncomplete] = useState(false);
  const [missing, setMissing] = useState<LayerId | "any">("any");
  const [selected, setSelected] = useState<string | null>(null);
  const rowRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    let live = true;
    Promise.all([fetchCoverage("generation"), fetchCoverage("demand"), fetchCoverage("installed-capacity"), fetchRegionCountries()])
      .then(([generation, demand, capacity, regionCountries]) => live && setFgs({ generation, demand, capacity, regionCountries }))
      .catch((e: Error) => {
        if (!live) return;
        setFgsError(e.message);
        setFgs({});
      });
    return () => {
      live = false;
    };
  }, []);

  const countries = useMemo(() => (fgs ? buildCountryStatus(fgs) : []), [fgs]);
  const byCode = useMemo(() => new Map(countries.map((c) => [c.code, c])), [countries]);
  const scores = useMemo(() => Object.fromEntries(countries.map((c) => [c.code, c.score])), [countries]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return countries
      .filter((c) => !q || c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q))
      .filter((c) => !onlyIncomplete || c.missing.length > 0)
      .filter((c) => missing === "any" || c.missing.includes(missing))
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  }, [countries, query, onlyIncomplete, missing]);

  const select = (code: string) => {
    setSelected(code);
    // make sure the row is in the table, then bring it into view
    setQuery("");
    setOnlyIncomplete(false);
    setMissing("any");
    setTimeout(() => rowRefs.current[code]?.scrollIntoView({ block: "center", behavior: "smooth" }), 50);
  };

  if (!fgs) {
    return (
      <Box sx={{ display: "flex", gap: 2, alignItems: "center", mt: 4 }}>
        <CircularProgress size={22} />
        <Typography variant="body2">Gathering every explorer&apos;s data. The first load can take up to a minute.</Typography>
      </Box>
    );
  }

  const complete = countries.filter((c) => c.missing.length === 0 && c.score > 0).length;
  const layerCounts = LAYERS.map((l) => ({ l, n: countries.filter((c) => c.layers[l.id].has).length }));
  const sel = selected ? byCode.get(selected) : undefined;

  return (
    <Box>
      <Typography variant="body2" sx={{ color: "text.secondary", my: 2 }}>
        {countries.length} countries against {LAYERS.length} data layers across the four explorers. The map fills each country by the share of layers it has; click a country (or a row)
        for the detail.
      </Typography>
      {fgsError && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Simulator layers could not be checked ({fgsError}). They show as &quot;not checked&quot; and are left out of each country&apos;s score.
        </Alert>
      )}

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 4, mb: 2 }}>
        <Stat label="Complete in every layer" value={`${complete} of ${countries.length}`} />
        {layerCounts.map(({ l, n }) => (
          <Stat key={l.id} label={l.label} value={String(n)} />
        ))}
      </Box>

      <CountryMap
        scores={scores}
        selected={selected}
        onSelect={select}
        describe={(code) => {
          const c = byCode.get(code);
          return c ? `${c.name}: ${Math.round(c.score * 100)}% of layers${c.missing.length ? ` · missing ${c.missing.map((m) => LAYERS.find((l) => l.id === m)!.label).join(", ")}` : ""}` : code;
        }}
      />

      {sel && <Detail c={sel} onClose={() => setSelected(null)} onOpenExplorer={onOpenExplorer} />}

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center", my: 2 }}>
        <TextField size="small" label="Filter" value={query} onChange={(e) => setQuery(e.target.value)} />
        <TextField size="small" select label="Missing layer" value={missing} onChange={(e) => setMissing(e.target.value as LayerId | "any")} sx={{ minWidth: 190 }}>
          <MenuItem value="any">Any</MenuItem>
          {LAYERS.map((l) => (
            <MenuItem key={l.id} value={l.id}>
              {l.explorer.split(" ")[0]} · {l.label}
            </MenuItem>
          ))}
        </TextField>
        <FormControlLabel control={<Switch checked={onlyIncomplete} onChange={(e) => setOnlyIncomplete(e.target.checked)} />} label="Only incomplete" />
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Showing {shown.length} of {countries.length}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Button
          size="small"
          onClick={() =>
            downloadCsv(
              "country-layer-status.csv",
              [["code", "country", "score_pct", ...LAYERS.map((l) => l.label), "missing"].join(","), ...shown.map((c) => [c.code, `"${c.name}"`, Math.round(c.score * 100), ...LAYERS.map((l) => (c.layers[l.id].unknown ? "n/a" : c.layers[l.id].has ? "yes" : "no")), `"${c.missing.map((m) => LAYERS.find((l) => l.id === m)!.label).join("; ")}"`].join(","))].join("\n"),
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
              <Th>Country</Th>
              <Th>Layers</Th>
              {LAYERS.map((l) => (
                <Th key={l.id} title={l.explorer}>
                  {l.label}
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((c) => (
              <Box
                component="tr"
                key={c.code}
                ref={(el: HTMLElement | null) => {
                  rowRefs.current[c.code] = el;
                }}
                onClick={() => setSelected(c.code)}
                sx={{ cursor: "pointer", bgcolor: c.code === selected ? "action.selected" : undefined, "&:hover": { bgcolor: "action.hover" } }}
              >
                <Td>
                  <strong>{c.code}</strong> {c.name}
                </Td>
                <Td>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Box sx={{ width: 60, height: 6, borderRadius: 1, bgcolor: "action.hover", overflow: "hidden" }}>
                      <Box sx={{ width: `${c.score * 100}%`, height: "100%", bgcolor: TEAL }} />
                    </Box>
                    {Math.round(c.score * 100)}%
                  </Box>
                </Td>
                {LAYERS.map((l) => {
                  const s = c.layers[l.id];
                  return (
                    <Td key={l.id} title={s.detail} bg={s.unknown ? undefined : s.has ? undefined : RED}>
                      {s.unknown ? <span style={{ opacity: 0.4 }}>n/c</span> : s.has ? (s.pct !== undefined ? `${Math.round(s.pct * 100)}%` : "✓") : "-"}
                    </Td>
                  );
                })}
              </Box>
            ))}
          </tbody>
        </Box>
      </Box>
    </Box>
  );
}

function Detail({ c, onClose, onOpenExplorer }: { c: CountryStatus; onClose: () => void; onOpenExplorer: Props["onOpenExplorer"] }) {
  return (
    <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 2, mt: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
        <Typography sx={{ fontWeight: 700, flex: 1 }}>
          {c.name} <span style={{ opacity: 0.6, fontWeight: 400 }}>{c.code} · {Math.round(c.score * 100)}% of layers</span>
        </Typography>
        <Button size="small" onClick={onClose}>
          Close
        </Button>
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 0.5 }}>
        {LAYERS.map((l) => {
          const s = c.layers[l.id];
          return (
            <Box key={l.id} sx={{ display: "flex", gap: 1, alignItems: "baseline" }}>
              <span style={{ width: 16, color: s.unknown ? "#9CA3AF" : s.has ? TEAL : "#E5484D" }}>{s.unknown ? "?" : s.has ? "✓" : "✗"}</span>
              <Typography variant="body2">
                <strong>{l.label}</strong> <span style={{ opacity: 0.6 }}>({l.explorer})</span>: {s.detail}{" "}
                <Button size="small" sx={{ minWidth: 0, p: 0, ml: 0.5 }} onClick={() => onOpenExplorer(EXPLORER_TAB[l.explorer])}>
                  open
                </Button>
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
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

function Th({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <Box component="th" title={title} sx={{ position: "sticky", top: 0, zIndex: 1, bgcolor: "background.paper", textAlign: "left", p: 1, borderBottom: 1, borderColor: "divider", whiteSpace: "nowrap" }}>
      {children}
    </Box>
  );
}

function Td({ children, title, bg }: { children: React.ReactNode; title?: string; bg?: string }) {
  return (
    <Box component="td" title={title} sx={{ p: 1, borderBottom: 1, borderColor: "divider", whiteSpace: "nowrap", bgcolor: bg }}>
      {children}
    </Box>
  );
}
