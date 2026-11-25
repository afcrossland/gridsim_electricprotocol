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
 * too. src/data/selfSufficiency.test.ts recomputes
 * every figure and fails if this file no longer matches the model, so a
 * forgotten run now shows up in CI.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { computeSelfSufficiency } from "../src/lib/selfSufficiency";

async function main() {
  const result = await computeSelfSufficiency();

  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const outPath = path.join(scriptDir, "../src/data/country-self-sufficiency.json");
  fs.writeFileSync(outPath, JSON.stringify(result));

  console.log(`wrote ${outPath} (${Object.keys(result).length} countries)`);
  for (const tier of ["low", "medium", "high"] as const) {
    const values = Object.values(result).map((r) => r[tier]);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    console.log(`  ${tier}: min ${Math.min(...values)}%, max ${Math.max(...values)}%, mean ${mean.toFixed(1)}%`);
  }
}

main();
