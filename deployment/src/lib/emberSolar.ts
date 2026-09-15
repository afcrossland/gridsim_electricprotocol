import raw from "../data/ember_solar.json";

export interface EmberMonthlyPoint {
  year: number;
  month: number;
  gw: number;
}

export interface EmberAnnualPoint {
  year: number;
  gw: number;
}

interface EmberCountryMonthly {
  name: string;
  granularity: "monthly";
  series: EmberMonthlyPoint[];
}

interface EmberCountryAnnual {
  name: string;
  granularity: "annual";
  annualSeries: EmberAnnualPoint[];
}

/**
 * A country's own best available capacity history - never both shapes at
 * once. See scripts/build_ember_solar.py: each country takes whichever of
 * Ember's two sources (the ~monthly capacity file, 25 countries; the
 * yearly generation file's own Capacity (GW) column, ~180 more) has the
 * more recent latest point, so a chart rendering one country's history is
 * never asked to mix monthly and yearly cadence in one line.
 */
export type EmberCountry = EmberCountryMonthly | EmberCountryAnnual;

/**
 * Ember's real solar capacity data - see scripts/build_ember_solar.py for
 * where this comes from, why it's solar-only (no rooftop/utility split, no
 * battery), and why only the GWDC-rated figure is kept for the monthly
 * source. 206 countries as of the last build.
 */
export const EMBER_SOLAR = raw.countries as Record<string, EmberCountry>;

export function emberCountry(code: string): EmberCountry | undefined {
  return EMBER_SOLAR[code];
}

/**
 * An EmberCountry's own most recent point - `month` is `null` for an
 * annual-granularity country rather than a sentinel value, so a caller
 * formatting "as of ..." text can tell the two shapes apart (see
 * CountryDetail.tsx's own monthly/annual branches, which this mirrors).
 * Exported (not just used internally by latestSolarMW below) so the
 * "Global" pseudo-country and Sidebar.tsx's stat tiles can read the same
 * latest-point logic off any EmberCountry - real or synthetic - without
 * duplicating it.
 */
export function latestPointOf(country: EmberCountry): { year: number; month: number | null; gw: number } {
  if (country.granularity === "monthly") {
    const p = country.series[country.series.length - 1];
    return { year: p.year, month: p.month, gw: p.gw };
  }
  const p = country.annualSeries[country.annualSeries.length - 1];
  return { year: p.year, month: null, gw: p.gw };
}

/** Most recent installed capacity, in MW - null if this code has no Ember data at all. */
export function latestSolarMW(code: string): number | null {
  const country = EMBER_SOLAR[code];
  if (!country) return null;
  return latestPointOf(country).gw * 1000;
}

