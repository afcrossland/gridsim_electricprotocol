import pc1Shape from "../data/pc1-demand-profile.json";
import type { DemandBand, HourlyProfile } from "./types";

/**
 * Placeholder annual totals for the beginner mode's Low/Medium/High bands -
 * ported from mygridgb's own `demand-preset-btn` values (its beginner
 * wizard's own Low/Medium/High kWh presets). Andrew's own instruction:
 * "I'll define how [these bands work] later" - these are provisional
 * defaults so the app works end-to-end, not a finished definition.
 */
export const DEMAND_BAND_KWH: Record<DemandBand, number> = {
  low: 1800,
  medium: 2700,
  high: 4100,
};

/**
 * The one demand SHAPE this app has (per Andrew's own instruction
 * 2026-09-16: "just PC1"), reused for every location and every band -
 * fractions of a year's demand per hour, summing to exactly 1. Built by
 * scripts/build_pc1_demand_profile.py from Elexon's own published Profile
 * Class 1 (Domestic Unrestricted) half-hourly load profile coefficients -
 * see that script's own docstring for the source and its simplifications
 * (approximated season boundaries, no bank holidays, GB-only data reused
 * globally). Still explicitly a placeholder - see ROADMAP.md's "Known gaps
 * flagged in code": no PC2/Economy 7 shape, no occupancy/house-size
 * variation, and the same GB shape is used for every country.
 */
const PC1_SHAPE = pc1Shape as HourlyProfile;

// Half a (365-day) year, in days - shifting the shape by this rotates its
// northern-hemisphere winter (Dec/Jan) onto the southern hemisphere's own
// winter (Jun/Jul), per Andrew's own instruction 2026-09-16 ("invert the
// demand months so Dec maps to June... add 6mo").
const SOUTHERN_HEMISPHERE_SHIFT_DAYS = 182;

/**
 * The PC1 shape scaled to sum to exactly `annualKWh`. `southernHemisphere`
 * rotates the shape by six months first, so the same GB-sourced heating-
 * driven seasonal curve still peaks in the visitor's own winter rather than
 * peaking in June for, say, Australia or South Africa - still just a
 * rotation of one hemisphere's shape, not a real southern-hemisphere
 * dataset (see ROADMAP.md's "Known gaps flagged in code").
 */
export function getHourlyDemandKWh(annualKWh: number, southernHemisphere = false): HourlyProfile {
  if (!southernHemisphere) return PC1_SHAPE.map((fraction) => fraction * annualKWh);

  const shiftedHours = SOUTHERN_HEMISPHERE_SHIFT_DAYS * 24;
  return PC1_SHAPE.map((_, i) => PC1_SHAPE[(i + shiftedHours) % PC1_SHAPE.length] * annualKWh);
}
