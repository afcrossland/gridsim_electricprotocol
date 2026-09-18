import type { HourlyProfile } from "./types";

export interface DispatchResult {
  selfConsumedKWh: number;
  exportedKWh: number;
  importedKWh: number;
  /** Hour-by-hour breakdown of the same dispatch, for the Dispatch tab's own charts - see DispatchPanel.tsx. */
  hourly: {
    /** Solar consumed directly, same hour it's generated. */
    solarToDemand: HourlyProfile;
    /** AC-side power directed into the battery (before the one-way charging loss is applied). */
    batteryCharge: HourlyProfile;
    /** AC-side power delivered by the battery (after the one-way discharging loss is applied). */
    batteryDischarge: HourlyProfile;
    gridImport: HourlyProfile;
    solarExport: HourlyProfile;
    /** State of charge at the end of each hour, as a percentage (0-100) of `batteryKWh` - 0 for every hour when there's no battery. */
    batteryLevelPct: HourlyProfile;
  };
}

/**
 * Round-trip battery efficiency - per Andrew's own instruction 2026-09-16.
 * Charging and discharging each take the square root of this as their own
 * one-way efficiency, so charge-then-discharge compounds back to exactly
 * this round-trip figure.
 */
const ROUND_TRIP_EFFICIENCY = 0.85;
const ONE_WAY_EFFICIENCY = Math.sqrt(ROUND_TRIP_EFFICIENCY);

/**
 * Hour-by-hour dispatch, per Andrew's own instruction 2026-09-16:
 * 1. Solar meets demand first (same-hour direct use).
 * 2. Any surplus solar charges the battery, capped by the battery's own 1C
 *    max charge power (its kWh capacity, divided by the 1-hour step) and by
 *    the room actually left in it - `ONE_WAY_EFFICIENCY` of whatever AC
 *    power goes in is what actually ends up stored.
 * 3. Solar still left over after that exports, up to `exportLimitKW`
 *    (infinite for now, per Andrew's own instruction - "we assume the grid
 *    export limit is infinite at this stage" - so nothing curtails yet, but
 *    the parameter and the curtailment math are here for when a real limit
 *    is introduced).
 * 4. If solar doesn't cover demand, the battery discharges to make up the
 *    difference (no power cap on discharge, only on charge, per Andrew's
 *    own instruction) - `ONE_WAY_EFFICIENCY` again on the way out - down
 *    until it's flat.
 * 5. Whatever demand is still unmet imports from the grid.
 */
export function simulateDispatch(
  generation: HourlyProfile,
  demand: HourlyProfile,
  batteryKWh: number,
  exportLimitKW = Infinity,
): DispatchResult {
  const hours = generation.length;
  const solarToDemand: HourlyProfile = new Array(hours);
  const batteryCharge: HourlyProfile = new Array(hours);
  const batteryDischarge: HourlyProfile = new Array(hours);
  const gridImport: HourlyProfile = new Array(hours);
  const solarExport: HourlyProfile = new Array(hours);
  const batteryLevelPct: HourlyProfile = new Array(hours);

  const maxChargePowerKW = batteryKWh / 1; // 1C - the battery's own kWh capacity, per 1-hour step
  let batteryLevel = 0;

  for (let h = 0; h < hours; h++) {
    const gen = generation[h];
    const dem = demand[h];

    const directUse = Math.min(gen, dem);
    solarToDemand[h] = directUse;

    let surplus = gen - directUse;
    let deficit = dem - directUse;

    let charge = 0;
    if (surplus > 0 && batteryKWh > 0) {
      const roomInBattery = batteryKWh - batteryLevel;
      const acPowerAvailable = Math.min(surplus, maxChargePowerKW);
      const acPowerToFillRoom = roomInBattery / ONE_WAY_EFFICIENCY;
      charge = Math.min(acPowerAvailable, acPowerToFillRoom);
      batteryLevel += charge * ONE_WAY_EFFICIENCY;
      surplus -= charge;
    }
    batteryCharge[h] = charge;

    let discharge = 0;
    if (deficit > 0 && batteryLevel > 0) {
      const acPowerDeliverable = batteryLevel * ONE_WAY_EFFICIENCY;
      discharge = Math.min(deficit, acPowerDeliverable);
      batteryLevel -= discharge / ONE_WAY_EFFICIENCY;
      deficit -= discharge;
    }
    batteryDischarge[h] = discharge;

    solarExport[h] = Math.min(surplus, exportLimitKW); // the rest, if any, curtails (not tracked as its own series - see doc comment)
    gridImport[h] = deficit;
    batteryLevelPct[h] = batteryKWh > 0 ? (batteryLevel / batteryKWh) * 100 : 0;
  }

  const sum = (arr: HourlyProfile) => arr.reduce((a, b) => a + b, 0);

  return {
    selfConsumedKWh: sum(solarToDemand) + sum(batteryDischarge),
    exportedKWh: sum(solarExport),
    importedKWh: sum(gridImport),
    hourly: { solarToDemand, batteryCharge, batteryDischarge, gridImport, solarExport, batteryLevelPct },
  };
}
