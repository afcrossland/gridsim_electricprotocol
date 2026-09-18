import selfSufficiencyByCode from "../data/country-self-sufficiency.json";
import { annualKWhPerKWp, loadCountryIrradiance } from "./countryIrradiance";
import { logNormalize } from "./mapColor";

/**
 * The map's own metric selector, per Andrew's own instruction 2026-09-16
 * ("on the policy and deployment pages we have a selector that lets us
 * look at the map in different colours - add to this map") - same pattern
 * as Deployment Explorer's own `lib/metrics.ts` (a `Metric` union plus a
 * per-metric value/domain lookup driving one shared ramp), duplicated
 * locally rather than shared, per this app's own established convention.
 */
export type Metric = "selfSufficiency" | "generation";

export const METRIC_LABELS: Record<Metric, string> = {
  selfSufficiency: "Self-sufficiency",
  generation: "Generation",
};

export const METRIC_LEGEND_TITLES: Record<Metric, string> = {
  selfSufficiency: "Self-sufficiency (%)",
  generation: "Annual irradiance (kWh/kWp)",
};

/**
 * The self-sufficiency dataset (`data/country-self-sufficiency.json`) is a
 * precomputed % per country for one fixed default system - 10 panels at
 * 500Wp, a 10kWh battery, 3,500 kWh/yr demand - run through the exact same
 * generation/demand/dispatch model a real calculation uses (see
 * `scripts/build_self_sufficiency.ts`'s own doc comment). It is NOT
 * recalculated live, so it will drift out of date if the irradiance
 * database, the demand shape, or the dispatch model's own assumptions
 * change - regenerating it (re-running that script) is a manual step, not
 * yet wired into any build/CI check. Flagged in ROADMAP.md.
 */
export async function loadMetricValues(metric: Metric): Promise<Record<string, number>> {
  if (metric === "selfSufficiency") return selfSufficiencyByCode as Record<string, number>;

  const irradiance = await loadCountryIrradiance();
  const byCode: Record<string, number> = {};
  for (const [code, entry] of Object.entries(irradiance)) byCode[code] = annualKWhPerKWp(entry);
  return byCode;
}

/**
 * Self-sufficiency is normalised against a fixed 50-100% domain, not
 * 0-100% (and not the dataset's own min/max) - originally 60-100% per
 * Andrew's own instruction 2026-09-16 ("on self-sufficiency, low is 60%"),
 * widened at the low end 2026-09-18 ("midpoint of the legend on
 * self-sufficiency is 75%, i.e. 75% is middle of that colour scale") so
 * the ramp's own middle color (norm 0.5) lands exactly on 75%, not 80%.
 * With this default 10-panel/10kWh/3,500kWh system almost every country
 * clears 50% (see the doc comment above for the actual min/mean), so a
 * 0-100% domain would leave nearly the entire map looking uniformly "high"
 * and waste most of the ramp's own contrast on a range no country falls
 * into. Generation's own kWh/kWp figures are unbounded and right-skewed,
 * so they keep the log-scale normalisation against the dataset's own
 * min/max, same as before this metric selector existed.
 */
const SELF_SUFFICIENCY_RAMP_MIN = 50;
const SELF_SUFFICIENCY_RAMP_MAX = 100;

export function normalizeForMetric(metric: Metric, value: number, min: number, max: number): number {
  if (metric === "selfSufficiency") {
    return Math.min(1, Math.max(0, (value - SELF_SUFFICIENCY_RAMP_MIN) / (SELF_SUFFICIENCY_RAMP_MAX - SELF_SUFFICIENCY_RAMP_MIN)));
  }
  return logNormalize(value, min, max);
}

export function formatMetricValue(metric: Metric, value: number): string {
  // 1dp for self-sufficiency, not a whole percent, per Andrew's own
  // instruction 2026-09-18 ("allow 1dp on the self-sufficiency when
  // displaying it").
  return metric === "selfSufficiency" ? `${value.toFixed(1)}%` : `${Math.round(value).toLocaleString()} kWh/kWp/yr`;
}
