import raw from "../data/ember_solar.json";

export interface EmberSeriesPoint {
  year: number;
  month: number;
  gw: number;
  unit: "GWDC";
}

export interface EmberCountry {
  name: string;
  series: EmberSeriesPoint[];
}

/**
 * Ember's real monthly solar capacity data - see scripts/build_ember_solar.py
 * for where this comes from and why it's solar-only (no rooftop/utility
 * split, no battery), and for why only the GWDC-rated figure is kept (Ember
 * also reports a parallel GWAC figure per country - dropped, not merged in,
 * since interleaving the two by month alone previously made capacity look
 * like it went up and down). Only 25 countries have a series at all;
 * everywhere else, callers should fall back to the placeholder dataset or
 * show no data, not assume coverage.
 */
export const EMBER_SOLAR = raw.countries as Record<string, EmberCountry>;

export function emberCountry(code: string): EmberCountry | undefined {
  return EMBER_SOLAR[code];
}

/** Most recent month's installed capacity, in MW - null if this code has no Ember series. */
export function latestSolarMW(code: string): number | null {
  const series = EMBER_SOLAR[code]?.series;
  if (!series || series.length === 0) return null;
  return series[series.length - 1].gw * 1000;
}

/**
 * World total installed solar capacity, in GW - each country's own latest
 * available month, summed (not all 25 countries necessarily share the same
 * latest month, so this is "the most current snapshot per country", not a
 * single point in time across all of them). Shown as a headline stat tile
 * on the map, not tied to whichever metric is currently selected.
 */
export function totalInstalledGW(): number {
  return Object.values(EMBER_SOLAR).reduce((sum, c) => sum + c.series[c.series.length - 1].gw, 0);
}
