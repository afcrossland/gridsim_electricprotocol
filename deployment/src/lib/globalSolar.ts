import raw from "../data/global_solar.json";
import { latestPointOf, type EmberCountry } from "./emberSolar";

/**
 * Pseudo-jurisdiction code for the sidebar's pinned "Global" row - not a
 * real ISO code, so it deliberately doesn't appear in data/jurisdictions.json
 * (no map shape, no flag) and every lookup keyed by a real country code
 * (jurisdictionName, FlagImg, the Policy Explorer/Future Grid cross-links,
 * ...) has to special-case it. Sidebar.tsx is where all of that lives.
 */
export const GLOBAL_CODE = "GLOBAL";

/**
 * The world's total installed solar capacity, structured exactly like any
 * other EmberCountry (annual granularity) so CountryDetail.tsx can render
 * it completely unchanged - "click shows the same details as per country"
 * per Andrew's instruction, satisfied by reusing that component rather than
 * building a second one. See scripts/build_global_solar.py for how this is
 * computed (it is *not* an Ember-published figure - summed/forward-filled
 * from ember_solar.json, flagged as derived per Ember's CC BY 4.0 terms).
 */
export const GLOBAL_SOLAR = raw.country as EmberCountry;

/** The latest point in GLOBAL_SOLAR's own series, in MW - same unit convention as lib/emberSolar.ts's latestSolarMW. */
export function globalLatestSolarMW(): number {
  return latestPointOf(GLOBAL_SOLAR).gw * 1000;
}

/** The (year, month) GLOBAL_SOLAR's own latest point is as of - month is always null, it's annual-granularity. See emberSolar.ts's latestPointOf. */
export function globalLatestSolarDate(): { year: number; month: number | null } {
  return latestPointOf(GLOBAL_SOLAR);
}
