import { aggregateEmberCountries } from "./aggregateSolar";
import { EMBER_SOLAR, latestPointOf } from "./emberSolar";

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
 * building a second one.
 *
 * Computed live (`aggregateEmberCountries`, every code `EMBER_SOLAR` has)
 * rather than precomputed offline - moved 2026-09-30 when the continent
 * filter's own regional aggregate row needed the exact same forward-fill
 * method for an arbitrary subset of countries, at which point keeping
 * "Global" as its own separately-precomputed special case (the old
 * `scripts/build_global_solar.py` + `data/global_solar.json`, now removed)
 * stopped making sense - it's just the aggregate of every country, the same
 * function a region's own filtered subset uses. Computed once at module
 * load (not per-render) since `EMBER_SOLAR` itself is static, ~230
 * countries x ~26 years - trivial even eagerly.
 *
 * This is a **derived, computed figure - not something Ember itself
 * publishes** as a single series (Ember's monthly API only covers 25
 * countries and its yearly CSV's Capacity (GW) column covers ~180 more,
 * each with its own start year and last-reported year - there is no
 * ready-made "world total over time" column to read). Per Ember's CC BY
 * 4.0 licence, a derived figure like this must be flagged as computed, not
 * presented as Ember's own number - see CountryDetail.tsx's own
 * `attributeToEmber` prop, `false` for this row.
 */
export const GLOBAL_SOLAR = aggregateEmberCountries(Object.keys(EMBER_SOLAR), "Global")!;

/** The latest point in GLOBAL_SOLAR's own series, in MW - same unit convention as lib/emberSolar.ts's latestSolarMW. */
export function globalLatestSolarMW(): number {
  return latestPointOf(GLOBAL_SOLAR).gw * 1000;
}
