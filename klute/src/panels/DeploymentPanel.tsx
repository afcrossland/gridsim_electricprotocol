import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { LineChart } from "@mui/x-charts/LineChart";
import { jurisdictionName } from "../../../src/lib/jurisdictions";
import CoverageTable from "../components/CoverageTable";
import { yearRow } from "../lib/coverage";
import type { CoverageRow } from "../lib/coverage";
import { sourceLabel, useExplorerData } from "../lib/explorerData";
import type { GenCountry, SolarCountry } from "../lib/explorerData";

const TEAL = "#01ADBF";

// The Solar Deployment Explorer's data: Ember solar capacity (annual for most countries,
// monthly for a few) and solar's share of generation. Pick a country to chart it; the grid
// below shows which years/months each country actually has.
export default function DeploymentPanel() {
  const data = useExplorerData();
  if (!data) return <Typography sx={{ my: 2 }}>Loading the Deployment Explorer&apos;s data…</Typography>;
  return <DeploymentView solarData={data.deployment.solar} genData={data.deployment.generation} fetchedAt={data.deployment.solarFetchedAt} note={sourceLabel(data.deployment.source)} />;
}

function DeploymentView({ solarData, genData, fetchedAt, note }: { solarData: Record<string, SolarCountry>; genData: Record<string, GenCountry>; fetchedAt: string; note: string }) {
  const codes = useMemo(() => [...new Set([...Object.keys(solarData), ...Object.keys(genData)])].sort(), [solarData, genData]);
  const [country, setCountry] = useState<string | null>("DE");
  const [dataset, setDataset] = useState<"capacity" | "share">("capacity");

  const rows: CoverageRow[] = useMemo(() => {
    if (dataset === "share") return Object.entries(genData).map(([c, v]) => yearRow(c, v.name, v.series.map((s) => s.year), "solar share of generation"));
    // Monthly countries are collapsed to the years they cover so every row shares one axis.
    return Object.entries(solarData).map(([c, v]) => {
      const years = v.granularity === "monthly" && v.series ? v.series.map((p) => p.year) : (v.annualSeries ?? []).map((p) => p.year);
      return yearRow(c, v.name, years, v.granularity === "monthly" ? "monthly source" : "annual source");
    });
  }, [dataset, solarData, genData]);

  const cap = country ? solarData[country] : undefined;
  const gen = country ? genData[country] : undefined;
  // Monthly series are charted at their latest value of each year (year-end capacity).
  const capPoints = (() => {
    if (!cap) return [];
    if (cap.granularity === "monthly" && cap.series) {
      const byYear = new Map<number, number>();
      for (const p of cap.series) byYear.set(p.year, p.gw);
      return [...byYear].map(([x, y]) => ({ x: String(x), y }));
    }
    return (cap.annualSeries ?? []).map((p) => ({ x: String(p.year), y: p.gw }));
  })();

  return (
    <Box>
      <Typography variant="body2" sx={{ color: "text.secondary", my: 2 }}>
        Ember data {note} (fetched from Ember {fetchedAt.slice(0, 10)}).
      </Typography>
      <Autocomplete
        size="small"
        sx={{ width: 320, mb: 2 }}
        options={codes}
        value={country}
        onChange={(_, v) => setCountry(v)}
        getOptionLabel={(c) => `${c} ${jurisdictionName(c)}`}
        renderInput={(p) => <TextField {...p} label="Country" />}
      />
      {country && (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2, mb: 3 }}>
          <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 2 }}>
            <Typography sx={{ fontWeight: 600 }}>Solar installed capacity (GW, year-end)</Typography>
            {capPoints.length ? (
              <LineChart height={260} xAxis={[{ scaleType: "point", data: capPoints.map((p) => p.x) }]} series={[{ data: capPoints.map((p) => p.y), color: TEAL, showMark: false }]} />
            ) : (
              <Typography variant="body2">No capacity series for this country.</Typography>
            )}
          </Box>
          <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 2 }}>
            <Typography sx={{ fontWeight: 600 }}>Solar share of generation (%)</Typography>
            {gen ? (
              <LineChart height={260} xAxis={[{ scaleType: "point", data: gen.series.map((p) => String(p.year)) }]} series={[{ data: gen.series.map((p) => p.sharePct), color: "#F59E0B", showMark: false }]} />
            ) : (
              <Typography variant="body2">No generation series for this country.</Typography>
            )}
          </Box>
        </Box>
      )}
      <ToggleButtonGroup size="small" exclusive value={dataset} onChange={(_, v) => v && setDataset(v)} sx={{ mb: 1 }}>
        <ToggleButton value="capacity">Capacity coverage</ToggleButton>
        <ToggleButton value="share">Generation-share coverage</ToggleButton>
      </ToggleButtonGroup>
      <CoverageTable key={dataset} rows={rows} kind="years" csvName={`deployment-${dataset}-coverage`} onSelect={(r) => setCountry(r.key)} />
    </Box>
  );
}
