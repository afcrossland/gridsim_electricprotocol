import { simulateDispatch } from "../batteryDispatch";
import { computePaybackRows, estimateGenericInstallCosts, splitByDayNight } from "../payback";
import type { PanelArray, SavingsResults, Tariffs } from "../types";

/**
 * The report never gives a single exact figure: it gives a range between a cautious case and an optimistic case,
 * rounded to sensible values. The cases move the three things this model is least sure of, together:
 *
 *   cautious:   solar output 10% lower,  energy prices 20% lower,  installed cost 15% higher
 *   optimistic: solar output 10% higher, energy prices 20% higher, installed cost 15% lower
 *
 * so the range is deliberately wide - it says "somewhere between", not "about this". The central case is the
 * calculator's own result.
 */
export const OUTPUT_SPREAD = 0.1;
export const PRICE_SPREAD = 0.2;
// (The 15% cost spread is the calculator's own: estimateGenericInstallCosts returns lower / typical / higher.)

export interface Outcome {
  generationKWh: number;
  gridAvoidedKWh: number;
  exportedKWh: number;
  /** Share of the home's demand met by its own solar and battery, 0-100. */
  pctMet: number;
  yearOneSaving: number;
  /** Whole years, or null if it does not pay back within 50 years. */
  paybackYears: number | null;
  installCost: number;
}

export interface Range {
  cautious: Outcome;
  central: Outcome;
  optimistic: Outcome;
}

function outcome(
  results: SavingsResults,
  tariffs: Tariffs,
  batteryKWh: number,
  installCost: number,
  outputFactor: number,
  priceFactor: number,
): Outcome {
  const generation = results.generationProfile.map((v) => v * outputFactor);
  const { selfConsumedKWh, exportedKWh, hourly } = simulateDispatch(generation, results.demandProfile, batteryKWh);
  const selfConsumed = hourly.solarToDemand.map((v, h) => v + hourly.batteryDischarge[h]);
  const { day, night } = splitByDayNight(selfConsumed);
  const importSaved = Math.round((day * tariffs.importRateDay + night * tariffs.importRateNight) * priceFactor);
  const exportEarned = Math.round(exportedKWh * tariffs.exportRate * priceFactor);
  const payback = computePaybackRows([installCost, installCost, installCost], exportEarned, importSaved, tariffs.inflationRate)[0];
  const gridImport = hourly.gridImport.reduce((a, b) => a + b, 0);
  return {
    generationKWh: generation.reduce((a, b) => a + b, 0),
    gridAvoidedKWh: Math.max(0, results.demandKWh - gridImport),
    exportedKWh,
    pctMet: Math.min(100, (selfConsumedKWh / results.demandKWh) * 100),
    yearOneSaving: importSaved + exportEarned,
    paybackYears: payback.paybackYears,
    installCost,
  };
}

export function outcomeRange(results: SavingsResults, arrays: PanelArray[], batteryKWh: number, tariffs: Tariffs): Range {
  const kWp = arrays.reduce((a, x) => a + (x.panels * x.panelWatts) / 1000, 0);
  const [low, typical, high] = estimateGenericInstallCosts(kWp, batteryKWh);
  return {
    cautious: outcome(results, tariffs, batteryKWh, high, 1 - OUTPUT_SPREAD, 1 - PRICE_SPREAD),
    central: outcome(results, tariffs, batteryKWh, typical, 1, 1),
    optimistic: outcome(results, tariffs, batteryKWh, low, 1 + OUTPUT_SPREAD, 1 + PRICE_SPREAD),
  };
}

// ---- rounding and wording ----

/** Rounds to two significant figures: 718 -> 720, 5,699 -> 5,700, 71,800,000 -> 72,000,000. */
export function sig2(v: number): number {
  if (v === 0 || !Number.isFinite(v)) return 0;
  // toPrecision rounds in decimal, so 9.2 stays 9.2 - multiplying back by a fractional magnitude (72 * 0.1) would
  // leave floating-point noise such as 9.200000000000001 in the printed figure.
  return Number(v.toPrecision(2));
}

/** A sensible round figure for a sum of money: nearest 10 below 1,000, otherwise two significant figures. */
export function roundMoney(v: number): number {
  const r = Math.abs(v) < 1000 ? Math.round(v / 10) * 10 : sig2(v);
  return r === 0 ? 0 : r;
}

/** Rounds a percentage to the nearest 5. */
export const roundPct = (v: number) => Math.round(v / 5) * 5;

const grouped = (n: number) => n.toLocaleString("en-GB");

export function formatMoney(symbol: string, v: number): string {
  const r = roundMoney(v);
  const sign = r < 0 ? "-" : "";
  const a = Math.abs(r);
  if (a >= 1e9) return `${sign}${symbol}${sig2(a / 1e9)}bn`;
  if (a >= 1e6) return `${sign}${symbol}${sig2(a / 1e6)}m`;
  return `${sign}${symbol}${grouped(a)}`;
}

/** "5,700" - a quantity to two significant figures. */
export const formatQty = (v: number) => grouped(sig2(v));

/** A range of a quantity with its unit once, at the end: "51 to 63 GWh", or "about 38 GWh". */
export function rangeQty(lo: number, hi: number, unit: string): string {
  const a = formatQty(Math.min(lo, hi));
  const b = formatQty(Math.max(lo, hi));
  return a === b ? `about ${a} ${unit}` : `${a} to ${b} ${unit}`;
}

/** Low and high end of a range as text: "£550 to £880", or "about £700" when rounding makes them the same. */
export function rangeText(lo: number, hi: number, fmt: (v: number) => string, joiner = " to "): string {
  const a = fmt(Math.min(lo, hi));
  const b = fmt(Math.max(lo, hi));
  return a === b ? `about ${a}` : `${a}${joiner}${b}`;
}

/** Payback range from the optimistic (shorter) and cautious (longer) cases. */
export function paybackText(shorter: number | null, longer: number | null): string {
  if (shorter === null) return "more than 50 years";
  if (longer === null) return `${shorter} years or more, and possibly longer than 50`;
  return shorter === longer ? `about ${shorter} years` : `${shorter} to ${longer} years`;
}
