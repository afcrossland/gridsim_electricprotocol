import { EMBER_SOLAR, latestSolarMW } from "./emberSolar";
import { EMBER_GENERATION, latestSharePct } from "./emberGeneration";
import { populationMillions } from "./population";

/**
 * The three things the map/sidebar can show - replaces the old
 * view+basis pair with one selector, per Andrew's instruction 2026-09-09.
 * All three read real Ember data only - the fabricated placeholder dataset
 * (dummyDeployment.ts) was removed the same day, so there is no fallback
 * for a country either Ember file doesn't cover; it just shows no data.
 */
export type Metric = "capacity" | "capacityPerCapita" | "share";

export const METRIC_LABELS: Record<Metric, string> = {
  capacity: "Installed Capacity",
  capacityPerCapita: "Installed Capacity per Capita",
  share: "Share of Electricity",
};

/** Every country the active metric's underlying dataset actually covers. */
export function codesForMetric(metric: Metric): string[] {
  return metric === "share" ? Object.keys(EMBER_GENERATION) : Object.keys(EMBER_SOLAR);
}

/**
 * The metric's value for one country - MW for "capacity", W per capita for
 * "capacityPerCapita" (null if the population needed to divide by is
 * missing), latest-year percent for "share". Null if the underlying Ember
 * dataset has no series for this code at all.
 */
export function valueForMetric(code: string, metric: Metric): number | null {
  if (metric === "share") return latestSharePct(code);

  const mw = latestSolarMW(code);
  if (mw === null) return null;
  if (metric === "capacity") return mw;

  const millions = populationMillions(code);
  return millions ? mw / millions : null;
}

/** Domain (min/max) of positive values actually present for this metric - drives the colour ramp's stops. */
export function domainForMetric(metric: Metric): [number, number] {
  const values = codesForMetric(metric)
    .map((code) => valueForMetric(code, metric))
    .filter((v): v is number => v !== null && v > 0);
  return [Math.min(...values), Math.max(...values)];
}

/**
 * Red to green, low value to high - dropped the orange-to-teal/aqua idea
 * 2026-09-10 (see the git history of this file for that version and the
 * two rounds of tuning it went through) in favour of the same red-to-green
 * scale Policy Explorer's own `SCORE_RAMP` uses (`ep_policymap/src/lib/scoring.ts`)
 * - same five stops, same hex values, kept as a separate copy here rather
 * than a shared import since the two apps' colour ramps aren't otherwise
 * linked and Policy Explorer's own ramp is scoped to that app's `scoring.ts`.
 */
export const RAMP_STOPS = [
  { stop: 0, color: "#c0392b" },
  { stop: 0.25, color: "#f47c2c" },
  { stop: 0.5, color: "#f9a825" },
  { stop: 0.75, color: "#c8e07b" },
  { stop: 1, color: "#1a9850" },
];

export const COLOR_NO_DATA = "#E5E7EB";
