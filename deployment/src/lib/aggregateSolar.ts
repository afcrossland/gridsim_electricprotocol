import { EMBER_SOLAR, type EmberCountry } from "./emberSolar";

const MIN_YEAR = 2000;

/** Every (year, gw) point a country has, sorted ascending - monthly countries collapse to one point per calendar year (their own last-reported month that year), same as `latestPointOf`'s own annual/monthly handling elsewhere. */
function pointsByYear(country: EmberCountry): [number, number][] {
  const points =
    country.granularity === "monthly"
      ? country.series.map((p): [number, number] => [p.year, p.gw])
      : country.annualSeries.map((p): [number, number] => [p.year, p.gw]);
  return [...points].sort((a, b) => a[0] - b[0]);
}

/**
 * Synthesizes a pseudo-`EmberCountry` aggregating installed solar capacity
 * across `codes`, structured exactly like a real one (annual granularity)
 * so `CountryDetail.tsx` can render it unchanged - same reasoning as the
 * old, single-purpose "Global" row's own `GLOBAL_SOLAR`
 * (`lib/globalSolar.ts`), generalized 2026-09-30 so any set of countries
 * (not just all of them) can get the same treatment - the continent
 * filter's own regional aggregate row, and "Global" itself, both go
 * through this now.
 *
 * Method (ported from `scripts/build_global_solar.py`, now run live in the
 * browser instead of precomputed offline - cheap enough at this data size,
 * ~230 countries x ~26 years, to not need a build step): for every year
 * from 2000 to the latest year any of `codes` reports, sum each country's
 * own latest known value *as of that year* - a country with no data yet by
 * year Y contributes 0, not a gap, since solar capacity before a country's
 * first reported point is genuinely ~0. This is a forward-fill sum applied
 * at every year in the range, not just the final one, so the resulting
 * series' own latest point reads as "right now" the same way a real
 * country's own latest point does.
 *
 * Returns `null` for an empty or entirely-dataless set of codes (e.g. a
 * continent filter matching nothing) - there is nothing meaningful to
 * aggregate.
 */
export function aggregateEmberCountries(codes: string[], name: string): EmberCountry | null {
  const seriesByCountry = codes
    .map((c) => EMBER_SOLAR[c])
    .filter((c): c is EmberCountry => Boolean(c))
    .map(pointsByYear);
  if (seriesByCountry.length === 0) return null;

  let maxYear = 0;
  for (const points of seriesByCountry) {
    if (points.length) maxYear = Math.max(maxYear, points[points.length - 1][0]);
  }
  if (maxYear < MIN_YEAR) return null;

  const annualSeries = [];
  for (let year = MIN_YEAR; year <= maxYear; year++) {
    let total = 0;
    for (const points of seriesByCountry) {
      let value = 0;
      for (const [y, gw] of points) {
        if (y <= year) value = gw;
        else break;
      }
      total += value;
    }
    annualSeries.push({ year, gw: Math.round(total * 100) / 100 });
  }

  return { name, granularity: "annual", annualSeries };
}
