import { getHourlyDemandKWh } from "./demandProfile";
import { loadCountryIrradiance } from "./countryIrradiance";
import { genericSource } from "./genericSource";
import { simulateDispatch } from "./batteryDispatch";
import type { PanelArray } from "./types";

export interface GlobalSimConfig {
  panels: number;
  panelWatts: number;
  batteryKWh: number;
  annualKWh: number;
}

/**
 * Self-sufficiency (%) for every country at once, given one shared
 * panel/battery/demand configuration - the real computation behind the
 * member-only "Global simulator" map view (`WorldMap.tsx`), added
 * 2026-09-29 once Andrew asked for it to actually work ("let's get the
 * global simulator working... when I click members and login, enable this
 * mode"). Same per-country pipeline as
 * `scripts/build_self_sufficiency.ts`'s own `selfSufficiencyFor` (which
 * precomputes the three fixed low/medium/high tiers behind the ordinary
 * self-sufficiency map view) - just run live in the browser for whatever
 * configuration a member actually chose, not three tiers baked in ahead of
 * time. `genericSource`'s own generation lookup and `simulateDispatch`'s
 * own hour-by-hour loop are both cheap (array scaling and a single O(8760)
 * pass) once `country-irradiance.json` is loaded and cached - the whole
 * ~230-country run takes well under a second in practice, which is what
 * makes running it live on a button click ("click to simulate", not a
 * live recompute on every slider drag - kept explicit/deliberate for
 * stability) practical at all.
 */
export async function computeGlobalSelfSufficiency(config: GlobalSimConfig): Promise<Record<string, number>> {
  const countryIrradiance = await loadCountryIrradiance();
  const array: PanelArray = { panels: config.panels, panelWatts: config.panelWatts, tilt: 35, azimuth: 0 };
  const result: Record<string, number> = {};

  for (const [code, entry] of Object.entries(countryIrradiance)) {
    const generation = await genericSource.getHourlyGenerationKWh({
      lat: entry.lat,
      lon: entry.lon,
      countryCode: code,
      array,
    });
    const demand = getHourlyDemandKWh(config.annualKWh, entry.lat < 0);
    const { selfConsumedKWh } = simulateDispatch(generation, demand, config.batteryKWh);
    // Rounded DOWN (Math.floor) to a whole percent, same as
    // scripts/build_self_sufficiency.ts's own tiers and calculateGeneric.ts's
    // own pctDemandMet.
    result[code] = Math.min(100, Math.floor((selfConsumedKWh / config.annualKWh) * 100));
  }

  return result;
}
