import type { HourlyProfile, PaybackRow, YearlySaving } from "./types";

/**
 * 23:00-07:00 - a common "off-peak overnight" window (the same shape as a
 * typical Economy-7-style cheap-rate period), used to split self-consumed
 * kWh into day/night for the day/night import tariff sliders (per Andrew's
 * own instruction 2026-09-17: "import price of electricity (day)
 * (night)"). Explicitly a placeholder - a fixed clock-hour boundary, not
 * location-specific (no timezone/DST handling, no real per-market
 * day/night definition) - same spirit as this app's other flagged
 * placeholders (see ROADMAP.md).
 */
const NIGHT_HOURS = new Set([23, 0, 1, 2, 3, 4, 5, 6]);

/** Splits an 8760-hour profile into day/night totals using `NIGHT_HOURS` above. */
export function splitByDayNight(profile: HourlyProfile): { day: number; night: number } {
  let day = 0;
  let night = 0;
  for (let h = 0; h < profile.length; h++) {
    if (NIGHT_HOURS.has(h % 24)) night += profile[h];
    else day += profile[h];
  }
  return { day, night };
}

/**
 * Cash-flow horizon for the IRR calculation below and for
 * `computeYearlySavings`'s own year-by-year table - a typical panel
 * warranty/lifetime figure, not tied to any real system's actual service
 * life (another of this app's placeholder assumptions, see ROADMAP.md).
 */
const CASH_FLOW_HORIZON_YEARS = 25;

/**
 * Pre-tax, unlevered IRR: one upfront outflow (`cost`) at year 0, then
 * `CASH_FLOW_HORIZON_YEARS` of annual savings inflowing (no financing, no
 * tax modelled - just the system's own cash flows). Solved by bisection
 * (no closed form, and no finance-math dependency in this app) rather than
 * Newton's method, since NPV is monotonically decreasing in the discount
 * rate here (every cash flow after year 0 is positive) so bisection always
 * converges. Returns null when the system's lifetime savings never even
 * recover the cost at a 0% discount rate - mirrors `paybackYears`'s own
 * null sentinel for "doesn't pay back."
 */
function computeIRR(cost: number, fixedAnnual: number, growingAnnual: number, inflationRate: number): number | null {
  if (cost <= 0) return null;

  function npv(rate: number): number {
    let total = -cost;
    for (let y = 1; y <= CASH_FLOW_HORIZON_YEARS; y++) {
      const cashFlow = fixedAnnual + growingAnnual * Math.pow(inflationRate, y - 1);
      total += cashFlow / Math.pow(1 + rate, y);
    }
    return total;
  }

  if (npv(0) < 0) return null;

  let lo = 0;
  let hi = 5; // 500%/yr - comfortably above any real solar IRR, just a search ceiling
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (npv(mid) > 0) lo = mid;
    else hi = mid;
  }
  return lo;
}

/**
 * The payback-year loop, ported from mygridgb's own `simplePayback`. Used
 * by calculateGeneric.ts today; kept separate from it (rather than inlined)
 * since a future location-specific calculation path is expected to reuse
 * it too, only supplying its own install-cost estimate and fixed/growing
 * annual-saving split.
 *
 * Per Andrew's own instruction 2026-09-17 ("given y1 and y5 saving are
 * same in every cost scenario... first tabulate three cost estimates and
 * the IRR... and payback"): year1/year5 saving dropped from this table -
 * they never varied by install cost (the annual saving is the same
 * regardless of what the system cost), so they belonged in a saving-over-
 * time table instead (see `computeYearlySavings` below), not repeated
 * identically across all three cost rows here.
 */
export function computePaybackRows(
  costs: [number, number, number],
  fixedAnnual: number,
  growingAnnual: number,
  inflationRate: number,
): PaybackRow[] {
  function simplePayback(cost: number): number | null {
    let cum = 0;
    for (let y = 1; y <= 50; y++) {
      cum += fixedAnnual + Math.round(growingAnnual * Math.pow(inflationRate, y - 1));
      if (cum >= cost) return y;
    }
    return null;
  }

  return costs.map((installCost) => ({
    installCost,
    irr: computeIRR(installCost, fixedAnnual, growingAnnual, inflationRate),
    paybackYears: simplePayback(installCost),
  }));
}

/**
 * The year-by-year saving table, broken into import savings (avoided grid
 * import, grows with `inflationRate` - see calculateGeneric.ts's own
 * `importSaved`) and export revenue (the export tariff, held flat over the
 * horizon - see the same file's `exportEarned`), added per Andrew's own
 * instruction 2026-09-17 alongside the IRR/payback table above, since the
 * cost table no longer shows saving figures at all.
 */
export function computeYearlySavings(
  importSavedYear1: number,
  exportEarnedYear1: number,
  inflationRate: number,
  years: number = CASH_FLOW_HORIZON_YEARS,
): YearlySaving[] {
  const rows: YearlySaving[] = [];
  for (let y = 1; y <= years; y++) {
    rows.push({
      year: y,
      importSaving: Math.round(importSavedYear1 * Math.pow(inflationRate, y - 1)),
      exportSaving: exportEarnedYear1,
    });
  }
  return rows;
}

/**
 * Install-cost estimate - $2,000 fixed + $0.40/Wp of panel + $400/kWh of
 * battery, per Andrew's own instruction 2026-09-17. Still a single global
 * ballpark, not real per-market pricing - flagged in ROADMAP.md alongside
 * the generation-profile placeholder, both need real per-market data
 * later. Takes total kWp directly (rather than panels x a single wattage)
 * since `SavingsInputs.arrays` can mix panel wattages across arrays.
 */
export function estimateGenericInstallCosts(totalKWp: number, batteryKWh: number): [number, number, number] {
  const rawCost = 400 * totalKWp + (batteryKWh >= 1 ? 400 * batteryKWh : 0) + 2000;
  const estimatedCost = Math.round(rawCost / 100) * 100;
  const spread = Math.round(estimatedCost * 0.15);
  return [Math.max(0, estimatedCost - spread), estimatedCost, estimatedCost + spread];
}
