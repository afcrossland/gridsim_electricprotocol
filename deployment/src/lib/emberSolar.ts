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

function latestPoint(country: EmberCountry): { year: number; month: number; gw: number } {
  if (country.granularity === "monthly") {
    const p = country.series[country.series.length - 1];
    return { year: p.year, month: p.month, gw: p.gw };
  }
  const p = country.annualSeries[country.annualSeries.length - 1];
  return { year: p.year, month: 12, gw: p.gw }; // an annual figure means "as of the end of that year"
}

/** Most recent installed capacity, in MW - null if this code has no Ember data at all. */
export function latestSolarMW(code: string): number | null {
  const country = EMBER_SOLAR[code];
  if (!country) return null;
  return latestPoint(country).gw * 1000;
}

/**
 * World total installed solar capacity, in GW - each country's own latest
 * available point (whichever granularity it is), summed. Shown as a
 * headline stat tile on the map, not tied to whichever metric is currently
 * selected.
 */
export function totalInstalledGW(): number {
  return Object.values(EMBER_SOLAR).reduce((sum, c) => sum + latestPoint(c).gw, 0);
}

/**
 * The most recent (year, month) any country's own latest point reaches -
 * the "As of" date on the total-installed tile. Some countries' own latest
 * point trails behind this (not every country is on the same reporting
 * schedule, and an annual-only country's point is treated as "end of that
 * year"), so this reads as the freshest the total ever gets, not a
 * guarantee every country's contribution is this current.
 */
export function latestSolarMonth(): { year: number; month: number } {
  return Object.values(EMBER_SOLAR).reduce(
    (latest, c) => {
      const p = latestPoint(c);
      return p.year > latest.year || (p.year === latest.year && p.month > latest.month)
        ? { year: p.year, month: p.month }
        : latest;
    },
    { year: 0, month: 0 },
  );
}
