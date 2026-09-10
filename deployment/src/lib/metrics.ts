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
 * Amber to teal/aqua, low value to high, with a warm cream midpoint -
 * fixed 2026-09-10: a straight RGB blend from amber (#FBB114) to aqua
 * (#00ABBB) naturally passes through green in the middle (R drops, G stays
 * high, B rises - a green midpoint is just what that particular pair of
 * endpoints blends through in RGB space), and Andrew didn't want a green
 * stop in an amber-to-teal ramp. Routed through a pale warm cream instead
 * (#F5E6C8) - distinct from both amber and teal, and, importantly, warm
 * enough not to read as `COLOR_NO_DATA` (#E5E7EB, a cool grey) the way an
 * earlier neutral-grey midpoint attempt did.
 */
export const RAMP_STOPS = [
  { stop: 0, color: "#FBB114" },
  { stop: 0.25, color: "#F8CB6E" },
  { stop: 0.5, color: "#F5E6C8" },
  { stop: 0.75, color: "#7AC8C1" },
  { stop: 1, color: "#00ABBB" },
];

export const COLOR_NO_DATA = "#E5E7EB";
