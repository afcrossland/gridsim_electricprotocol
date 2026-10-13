import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import irradiance from "../../../calculator/src/data/country-irradiance.json";
import selfSufficiency from "../../../calculator/src/data/country-self-sufficiency.json";
import jurisdictions from "../../../src/data/jurisdictions.json";
import { jurisdictionName } from "../../../src/lib/jurisdictions";

type Irr = { lat: number; lon: number; tiltDeg: number; azimuthDeg: number; profileWPerWp?: number[] };
type Self = { low: number; medium: number; high: number };
const irr = irradiance as unknown as Record<string, Irr>;
const self = selfSufficiency as unknown as Record<string, Self>;

// The Solar Homes Calculator's data: which countries have a representative-site irradiance
// profile and a self-sufficiency table, and the values themselves.
export default function CalculatorPanel() {
  const countries = (jurisdictions as { code: string; level: string }[]).filter((j) => j.level === "country").map((j) => j.code);
  const rows = useMemo(
    () =>
      [...new Set([...countries, ...Object.keys(irr), ...Object.keys(self)])]
        .map((code) => ({ code, name: jurisdictionName(code), irr: irr[code], self: self[code] }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [query, setQuery] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(false);
  const q = query.trim().toLowerCase();
  const shown = rows.filter((r) => (!q || r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q)) && (!onlyMissing || !r.irr || !r.self));
  const haveBoth = rows.filter((r) => r.irr && r.self).length;
  const f = (n?: number) => (n === undefined ? "-" : String(n));

  return (
    <Box>
      <Typography variant="body2" sx={{ color: "text.secondary", my: 2 }}>
        {haveBoth} of {rows.length} countries have both an irradiance profile and a self-sufficiency table. Self-sufficiency is the share of a household&apos;s demand met by solar plus
        storage at low / medium / high sizing.
      </Typography>
      <Box sx={{ display: "flex", gap: 2, alignItems: "center", mb: 2 }}>
        <TextField size="small" label="Filter" value={query} onChange={(e) => setQuery(e.target.value)} />
        <label>
          <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} /> Only countries missing data
        </label>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Showing {shown.length} of {rows.length}
        </Typography>
      </Box>
      <Box sx={{ overflow: "auto", maxHeight: "65vh", border: 1, borderColor: "divider", borderRadius: 1 }}>
        <Box component="table" sx={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
          <thead>
            <tr>
              {["Country", "Irradiance", "Lat / lon", "Tilt / azimuth", "Self-sufficiency low", "medium", "high"].map((h) => (
                <Box component="th" key={h} sx={{ position: "sticky", top: 0, bgcolor: "background.paper", textAlign: "left", p: 1, borderBottom: 1, borderColor: "divider", whiteSpace: "nowrap" }}>
                  {h}
                </Box>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.code}>
                <Td>
                  <strong>{r.code}</strong> {r.name}
                </Td>
                <Td bad={!r.irr}>{r.irr ? `${r.irr.profileWPerWp?.length ?? 0} values` : "none"}</Td>
                <Td>{r.irr ? `${r.irr.lat.toFixed(2)}, ${r.irr.lon.toFixed(2)}` : "-"}</Td>
                <Td>{r.irr ? `${r.irr.tiltDeg}° / ${r.irr.azimuthDeg}°` : "-"}</Td>
                <Td bad={!r.self}>{r.self ? `${f(r.self.low)}%` : "none"}</Td>
                <Td>{r.self ? `${f(r.self.medium)}%` : "-"}</Td>
                <Td>{r.self ? `${f(r.self.high)}%` : "-"}</Td>
              </tr>
            ))}
          </tbody>
        </Box>
      </Box>
    </Box>
  );
}

function Td({ children, bad }: { children: React.ReactNode; bad?: boolean }) {
  return (
    <Box component="td" sx={{ p: 1, borderBottom: 1, borderColor: "divider", whiteSpace: "nowrap", bgcolor: bad ? "rgba(229,72,77,0.18)" : undefined }}>
      {children}
    </Box>
  );
}
