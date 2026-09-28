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

// Labels for these three used to live here as plain Record<Metric, string>
// constants (METRIC_LABELS/METRIC_SHORT_LABELS) - moved into i18next's
// `metrics`/`metricsShort` keys 2026-09-11 (see i18n/locales/*/common.json)
// as part of this app's localisation setup, so App.tsx and
// DeploymentMap.tsx now call `t(\`metrics.${metric}\`)` /
// `t(\`metricsShort.${metric}\`)` directly instead of importing a lookup
// table from here.

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

/**
 * Same as `valueForMetric`, but a real `0` is treated as "no data" too -
 * used for the map's fill colour and hover tooltip specifically, added
 * 2026-09-10. A log-scale ramp has no meaningful stop for exactly zero
 * (log10(0) is undefined), so without this a genuinely-zero country (a
 * few of the annual-capacity dataset's early years, before that country
 * had any solar at all) got clamped to the ramp's lowest colour and
 * looked like it had *some* capacity rather than none. The ranking list
 * in Sidebar.tsx still uses `valueForMetric` directly and keeps showing
 * these rows as "0 MW"/"0%" - a real, honest number there, just not a
 * colour the map's ramp can represent.
 */
export function valueForMap(code: string, metric: Metric): number | null {
  const value = valueForMetric(code, metric);
  return value === 0 ? null : value;
}

/** Domain (min/max) of positive values actually present for this metric - drives the colour ramp's stops. */
export function domainForMetric(metric: Metric): [number, number] {
  const values = codesForMetric(metric)
    .map((code) => valueForMetric(code, metric))
    .filter((v): v is number => v !== null && v > 0);
  return [Math.min(...values), Math.max(...values)];
}

