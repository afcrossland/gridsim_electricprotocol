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
 * Orange to teal/aqua, low value to high - replaced the original single-hue
 * Aqua sequential ramp 2026-09-10 at Andrew's request, trying the same
 * two-brand-colour idea first explored (then reverted) on Policy Explorer's
 * own score ramp - see that app's `lib/scoring.ts` for the fuller history.
 * Both ends are drawn from the GSC brand palette (see mui-theme.tsx's own
 * brand-colour comment): Burnt Orange (#EF864C) at the low end, Aqua
 * (#00ABBB, the same hue as `primary.main`) at the high end.
 *
 * **Fixed 2026-09-10**: the original midpoint was a muted grey-tan
 * (#D8D3C6), picked as a "neutral" stop between the two brand colours -
 * but a neutral that close to `COLOR_NO_DATA` (#E5E7EB) read as "no data"
 * on the map rather than "medium value". Replaced with GSC's own Citrus
 * (#FBB114), a real brand colour rather than an invented neutral, and
 * rebuilt the two remaining stops as actual RGB midpoints between their
 * neighbours (Burnt Orange↔Citrus, Citrus↔Aqua) rather than hand-picked -
 * the ramp now reads as a coherent sunset-to-ocean gradient (orange, gold,
 * yellow, green, teal) with every stop clearly distinct from grey.
 */
export const RAMP_STOPS = [
  { stop: 0, color: "#EF864C" },
  { stop: 0.25, color: "#F59B30" },
  { stop: 0.5, color: "#FBB114" },
  { stop: 0.75, color: "#7DAE67" },
  { stop: 1, color: "#00ABBB" },
];

export const COLOR_NO_DATA = "#E5E7EB";
