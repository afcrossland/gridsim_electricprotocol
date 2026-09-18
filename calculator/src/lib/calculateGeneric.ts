import { simulateDispatch } from "./batteryDispatch";
import { DEMAND_BAND_KWH, getHourlyDemandKWh } from "./demandProfile";
import { genericSource } from "./genericSource";
import { computePaybackRows, computeYearlySavings, estimateGenericInstallCosts, splitByDayNight } from "./payback";
import { EV_ANNUAL_KWH_DUMMY } from "./types";
import type { HourlyProfile, SavingsInputs, SavingsResults } from "./types";

/**
 * The (currently only) calculation path: an 8760 generation profile per
 * array (see genericSource.ts - a location-agnostic placeholder for now),
 * summed elementwise across every array, load-matched hour-by-hour against
 * an 8760 demand profile (demandProfile.ts - also provisional) via a
 * simple battery dispatch model (batteryDispatch.ts), per Andrew's own
 * instruction.
 */
export async function calculateGeneric(inputs: SavingsInputs): Promise<SavingsResults> {
  const { arrays, batteryKWh, demand, tariffs, location, evCharging } = inputs;
  const annualKWh = (demand.annualKWh ?? DEMAND_BAND_KWH[demand.band]) + (evCharging ? EV_ANNUAL_KWH_DUMMY : 0);

  const perArrayGeneration = await Promise.all(
    arrays.map((array) =>
      genericSource.getHourlyGenerationKWh({
        lat: location.lat,
        lon: location.lon,
        countryCode: location.countryCode,
        array,
      }),
    ),
  );
  const generation: HourlyProfile = perArrayGeneration.reduce((sum, profile) =>
    sum.map((v, h) => v + profile[h]),
  );
  const demandProfile = getHourlyDemandKWh(annualKWh, location.lat < 0);
  const { selfConsumedKWh, exportedKWh, hourly: dispatchHourly } = simulateDispatch(generation, demandProfile, batteryKWh);

  const annualGenerationKWh = Math.round(generation.reduce((sum, v) => sum + v, 0));
  // 1dp, not a whole percent, per Andrew's own instruction 2026-09-18
  // ("allow 1dp on the self-sufficiency when displaying it"); rounded DOWN
  // (Math.floor, not Math.round) per his own follow-up instruction the
  // same day ("when calc self sufficiency, round down to nearest 0.1%") -
  // never overstate how much of demand solar+battery actually covers.
  const pctDemandMet = Math.min(100, Math.floor((selfConsumedKWh / annualKWh) * 1000) / 10);

  // Self-consumed kWh (solar used directly + battery discharge) split by
  // hour into day/night, so the day/night import-tariff sliders each apply
  // to the kWh they actually cover - see splitByDayNight's own doc comment.
  const selfConsumedProfile = dispatchHourly.solarToDemand.map((v, h) => v + dispatchHourly.batteryDischarge[h]);
  const { day: selfConsumedDayKWh, night: selfConsumedNightKWh } = splitByDayNight(selfConsumedProfile);
  const importSaved = Math.round(selfConsumedDayKWh * tariffs.importRateDay + selfConsumedNightKWh * tariffs.importRateNight);
  const exportEarned = Math.round(exportedKWh * tariffs.exportRate);

  const totalKWp = arrays.reduce((sum, a) => sum + (a.panels * a.panelWatts) / 1000, 0);
  const costs = estimateGenericInstallCosts(totalKWp, batteryKWh);

  return {
    generationProfile: generation,
    demandProfile,
    dispatchHourly,
    annualGenerationKWh,
    selfConsumedKWh: Math.round(selfConsumedKWh),
    exportedKWh: Math.round(exportedKWh),
    demandKWh: annualKWh,
    pctDemandMet,
    // No battery-arbitrage term here - the simple dispatch model above
    // only tracks same-hour self-consumption/export/import, so this
    // model's whole saving is just import-avoided + export-earned.
    paybackRows: computePaybackRows(costs, exportEarned, importSaved, tariffs.inflationRate),
    yearlySavings: computeYearlySavings(importSaved, exportEarned, tariffs.inflationRate),
    source: "generic",
  };
}
