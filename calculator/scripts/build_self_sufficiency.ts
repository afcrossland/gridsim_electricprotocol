/**
 * Builds a per-country self-sufficiency (%) lookup for the map's own
 * "self-sufficiency" colour view (WorldMap.tsx), per Andrew's own
 * instruction 2026-09-16: a default system of 10 panels at 500Wp, a 10kWh
 * battery, and the Design tab's own default annual demand (panel count
 * changed from an initial 12 to 10 later the same day, to match the
 * Design tab's own default; demand was 3,500 kWh/yr until 2026-09-18,
 * when Andrew caught the map's own hover tooltip for the UK - 80.8% -
 * disagreeing with the sidebar's own live figure for the same default
 * system - 77.5% - because this constant had silently drifted out of
 * sync with `App.tsx`'s own `DEFAULT_DEMAND.annualKWh`, 4,000, at some
 * earlier point; fixed by matching it here instead), run through the
 * exact same
 * generation/demand/dispatch model the app's own calculation uses
 * (genericSource.ts, demandProfile.ts, batteryDispatch.ts) - not a
 * reimplementation, so this can never quietly drift from what a real
 * calculation would produce for the same inputs.
 *
 * This is a one-off generator (like build_country_irradiance.py and
 * build_pc1_demand_profile.py), run with `npx tsx
 * scripts/build_self_sufficiency.ts` from the calculator/ directory - its
 * output (src/data/country-self-sufficiency.json) is committed and loaded
 * directly, not regenerated at build/dev time.
 *
 * IMPORTANT - this file must be regenerated (this script re-run) any time
 * the underlying assumptions change: the country-irradiance.json dataset
 * itself (scripts/build_country_irradiance.py), the PC1 demand shape
 * (scripts/build_pc1_demand_profile.py), or the battery dispatch model
 * (lib/batteryDispatch.ts's own round-trip efficiency/charge-power-cap
 * logic). There's no build-time or CI check that catches this drift - it's
 * a manual step, flagged in ROADMAP.md's own "Known gaps flagged in code".
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getHourlyDemandKWh } from "../src/lib/demandProfile";
import { loadCountryIrradiance } from "../src/lib/countryIrradiance";
import { genericSource } from "../src/lib/genericSource";
import { simulateDispatch } from "../src/lib/batteryDispatch";
import type { PanelArray } from "../src/lib/types";

const DEFAULT_ARRAY: PanelArray = { panels: 10, panelWatts: 500, tilt: 35, azimuth: 0 };
const DEFAULT_BATTERY_KWH = 10;
const DEFAULT_ANNUAL_KWH = 4000; // matches App.tsx's own DEFAULT_DEMAND.annualKWh - see this file's own top doc comment

async function main() {
  const countryIrradiance = await loadCountryIrradiance();
  const codes = Object.keys(countryIrradiance);
  const result: Record<string, number> = {};

  for (const code of codes) {
    const entry = countryIrradiance[code];
    const generation = await genericSource.getHourlyGenerationKWh({
      lat: entry.lat,
      lon: entry.lon,
      countryCode: code,
      array: DEFAULT_ARRAY,
    });
    const demand = getHourlyDemandKWh(DEFAULT_ANNUAL_KWH, entry.lat < 0);
    const { selfConsumedKWh } = simulateDispatch(generation, demand, DEFAULT_BATTERY_KWH);
    // 1dp (not a whole percent) per Andrew's own instruction 2026-09-18
    // ("allow 1dp on the self-sufficiency when displaying it"), rounded
    // DOWN (Math.floor) per his own same-day follow-up ("round down to
    // nearest 0.1%") - matches calculateGeneric.ts's own pctDemandMet.
    result[code] = Math.min(100, Math.floor((selfConsumedKWh / DEFAULT_ANNUAL_KWH) * 1000) / 10);
  }

  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const outPath = path.join(scriptDir, "../src/data/country-self-sufficiency.json");
  fs.writeFileSync(outPath, JSON.stringify(result));

  const values = Object.values(result);
  console.log(`wrote ${outPath} (${codes.length} countries)`);
  console.log(`min ${Math.min(...values)}%, max ${Math.max(...values)}%, mean ${(values.reduce((a, b) => a + b, 0) / values.length).toFixed(1)}%`);
}

main();
