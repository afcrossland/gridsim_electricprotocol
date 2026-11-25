/**
 * The per-country self-sufficiency (%) behind the map and league table, for three system tiers. Shared by the generator
 * (scripts/build_self_sufficiency.ts), which writes it to data/country-self-sufficiency.json, and the test that
 * recomputes it to catch a file left behind by a change to the model.
 *
 * Uses the same generation, demand and dispatch functions as the app's own calculation, so it cannot drift from it.
 */
import { simulateDispatch } from "./batteryDispatch";
import { loadCountryIrradiance } from "./countryIrradiance";
import { getHourlyDemandKWh } from "./demandProfile";
import { genericSource } from "./genericSource";
import type { PanelArray } from "./types";

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

export interface SelfSufficiencyTiers {
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

export async function computeSelfSufficiency(): Promise<Record<string, SelfSufficiencyTiers>> {
  const countryIrradiance = await loadCountryIrradiance();
  const result: Record<string, SelfSufficiencyTiers> = {};
  for (const [code, entry] of Object.entries(countryIrradiance)) {
    const row = {} as SelfSufficiencyTiers;
    for (const tier of TIERS) row[tier.label] = await selfSufficiencyFor(tier, entry.lat, entry.lon, code);
    result[code] = row;
  }
  return result;
}
