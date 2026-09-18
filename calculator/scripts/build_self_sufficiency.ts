/**
 * Builds a per-country self-sufficiency (%) lookup for the map's own
 * "self-sufficiency" colour view (WorldMap.tsx) - three system tiers per
 * country (low/medium/high), per Andrew's own instruction 2026-09-18
 * ("so for each country/region, calculate the self-sufficiency for low,
 * med and high case and save in our database"). "Medium" is the same
 * default system this dataset always used (10 panels at 500Wp, a 10kWh
 * battery, matching the Design tab's own default annual demand - panel
 * count changed from an initial 12 to 10, and demand from 3,500 to 4,000
 * kWh/yr on 2026-09-18 to fix it silently drifting out of sync with
 * App.tsx's own default, see git history for that fix); "low" and "high"
 * are the two other tiers Andrew asked about the same day (8 panels/5kWh
 * battery/5,000 kWh demand, and 14 panels/15kWh battery/3,500 kWh demand
 * respectively) - all three run through the exact same
 * generation/demand/dispatch model the app's own calculation uses
 * (genericSource.ts, demandProfile.ts, batteryDispatch.ts) - not a
 * reimplementation, so this can never quietly drift from what a real
 * calculation would produce for the same inputs.
 *
 * This is a one-off generator (like build_country_irradiance.py and
 * build_pc1_demand_profile.py), run with `npx tsx
 * scripts/build_self_sufficiency.ts` from the calculator/ directory - its
 * output (src/data/country-self-sufficiency.json, now `{ [code]: { low,
 * medium, high } }` rather than a bare number per code) is committed and
 * loaded directly, not regenerated at build/dev time. `WorldMap.tsx`'s own
 * self-sufficiency colour view still reads just the "medium" figure (see
 * lib/mapMetrics.ts) - low/high are computed and stored per Andrew's own
 * instruction but not yet surfaced in the UI.
 *
 * IMPORTANT - this file must be regenerated (this script re-run) any time
 * the underlying assumptions change: the country-irradiance.json dataset
 * itself (scripts/build_country_irradiance.py), the PC1 demand shape
 * (scripts/build_pc1_demand_profile.py), or the battery dispatch model
 * (lib/batteryDispatch.ts's own round-trip efficiency/charge-power-cap
 * logic). Per Andrew's own instruction 2026-09-18 ("update the code so
 * this repeats every time we update the demand profile/irradiance"), the
 * three generator scripts are now chained under one root `package.json`
 * script - see `npm run calculator:build-datasets` - so re-running the
 * irradiance or demand-profile build always re-derives this file in the
 * same step, rather than relying on someone remembering to run this one
 * too. There's still no build-time or CI check that *forces* that command
 * to run, though - it's a manual step you choose to take, just no longer
 * one you have to remember to chain by hand. Flagged in ROADMAP.md's own
 * "Known gaps flagged in code".
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getHourlyDemandKWh } from "../src/lib/demandProfile";
import { loadCountryIrradiance } from "../src/lib/countryIrradiance";
import { genericSource } from "../src/lib/genericSource";
import { simulateDispatch } from "../src/lib/batteryDispatch";
import type { PanelArray } from "../src/lib/types";

interface Tier {
  label: "low" | "medium" | "high";
  array: PanelArray;
  batteryKWh: number;
  annualKWh: number;
}

// "Medium" matches App.tsx's own DEFAULT_ARRAYS/DEFAULT_BATTERY_KWH/
// DEFAULT_DEMAND - the same "normal house" default a real calculation
// starts from. "Low" and "high" are the two other system sizes Andrew
// asked about 2026-09-18 (a smaller system covering more demand, and a
// bigger system covering less), not tied to any other part of the app.
const TIERS: Tier[] = [
  { label: "low", array: { panels: 8, panelWatts: 500, tilt: 35, azimuth: 0 }, batteryKWh: 5, annualKWh: 5000 },
  { label: "medium", array: { panels: 10, panelWatts: 500, tilt: 35, azimuth: 0 }, batteryKWh: 10, annualKWh: 4000 },
  { label: "high", array: { panels: 14, panelWatts: 500, tilt: 35, azimuth: 0 }, batteryKWh: 15, annualKWh: 3500 },
];

interface CountryResult {
  low: number;
  medium: number;
  high: number;
}

async function selfSufficiencyFor(tier: Tier, lat: number, lon: number, countryCode: string): Promise<number> {
  const generation = await genericSource.getHourlyGenerationKWh({ lat, lon, countryCode, array: tier.array });
  const demand = getHourlyDemandKWh(tier.annualKWh, lat < 0);
  const { selfConsumedKWh } = simulateDispatch(generation, demand, tier.batteryKWh);
  // Rounded DOWN (Math.floor) to a whole percent per Andrew's own
  // instruction 2026-09-18 - matches calculateGeneric.ts's own
  // pctDemandMet.
  return Math.min(100, Math.floor((selfConsumedKWh / tier.annualKWh) * 100));
}

async function main() {
  const countryIrradiance = await loadCountryIrradiance();
  const codes = Object.keys(countryIrradiance);
  const result: Record<string, CountryResult> = {};

  for (const code of codes) {
    const entry = countryIrradiance[code];
    const row = {} as CountryResult;
    for (const tier of TIERS) {
      row[tier.label] = await selfSufficiencyFor(tier, entry.lat, entry.lon, code);
    }
    result[code] = row;
  }

  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const outPath = path.join(scriptDir, "../src/data/country-self-sufficiency.json");
  fs.writeFileSync(outPath, JSON.stringify(result));

  console.log(`wrote ${outPath} (${codes.length} countries)`);
  for (const tier of TIERS) {
    const values = Object.values(result).map((r) => r[tier.label]);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    console.log(`  ${tier.label}: min ${Math.min(...values)}%, max ${Math.max(...values)}%, mean ${mean.toFixed(1)}%`);
  }
}

main();
