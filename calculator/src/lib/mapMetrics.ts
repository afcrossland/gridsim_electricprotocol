import selfSufficiencyByCode from "../data/country-self-sufficiency.json";
import { annualKWhPerKWp, loadCountryIrradiance } from "./countryIrradiance";
import { logNormalize } from "../../../shared/lib/mapColor";

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
 * precomputed % per country for three fixed system tiers (low/medium/high
 * - see `scripts/build_self_sufficiency.ts`'s own doc comment for the
 * exact panel/battery/demand figures each one uses), run through the
 * exact same generation/demand/dispatch model a real calculation uses.
 * The map's own colour view reads only "medium" here (the same "normal
 * house" default the app's own Design tab starts from) - low/high are
 * computed and stored per Andrew's own instruction 2026-09-18 but have no
 * UI surface yet. It is NOT recalculated live, so it will drift out of
 * date if the irradiance database, the demand shape, or the dispatch
 * model's own assumptions change - regenerating it (re-running that
 * script, or `npm run calculator:build-datasets` to chain it after the
 * irradiance/demand-profile scripts) is still a step someone has to
 * choose to take, just no longer one they have to remember to chain by
 * hand. Flagged in ROADMAP.md.
 */
export async function loadMetricValues(metric: Metric): Promise<Record<string, number>> {
  if (metric === "selfSufficiency") {
    const byTier = loadSelfSufficiencyTiers();
    const byCode: Record<string, number> = {};
    for (const [code, tiers] of Object.entries(byTier)) byCode[code] = tiers.medium;
    return byCode;
  }

  const irradiance = await loadCountryIrradiance();
  const byCode: Record<string, number> = {};
  for (const [code, entry] of Object.entries(irradiance)) byCode[code] = annualKWhPerKWp(entry);
  return byCode;
}

/**
 * The raw low/medium/high tiers behind `loadMetricValues`'s own
 * self-sufficiency figure (which collapses to "medium" alone) - exposed
 * separately for CountryLeagueTable.tsx, per Andrew's own instruction
 * 2026-09-18 ("on the self-sufficiency rank, show low-high value instead
 * of mid, but just rank on the mid"): the list still sorts by medium
 * (via `loadMetricValues`, unchanged), but each row displays its own
 * low-high range instead of the single medium figure.
 */
export function loadSelfSufficiencyTiers(): Record<string, { low: number; medium: number; high: number }> {
  return selfSufficiencyByCode as Record<string, { low: number; medium: number; high: number }>;
}

/**
 * Self-sufficiency is normalised against a fixed 50-100% domain, not
 * 0-100% (and not the dataset's own min/max) - originally 60-100% per
 * Andrew's own instruction 2026-09-16 ("on self-sufficiency, low is 60%"),
 * widened at the low end 2026-09-18 ("midpoint of the legend on
 * self-sufficiency is 75%, i.e. 75% is middle of that colour scale") so
 * the ramp's own middle color (norm 0.5) lands exactly on 75%, not 80%.
 * With this "medium" 10-panel/10kWh/4,000kWh system almost every country
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
  return metric === "selfSufficiency" ? `${value}%` : `${Math.round(value).toLocaleString()} kWh/kWp/yr`;
}
