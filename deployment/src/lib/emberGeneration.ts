import raw from "../data/ember_generation.json";

export interface GenerationSeriesPoint {
  year: number;
  solarTWh: number;
  totalTWh: number;
  sharePct: number;
}

export interface GenerationCountry {
  name: string;
  series: GenerationSeriesPoint[];
}

/**
 * Solar's share of each country's own annual electricity generation - see
 * scripts/build_ember_generation.py for how the annual figures are built
 * (summed from 12 months of TWh, not an average of monthly percentages).
 * 77 countries, wider coverage than ember_solar.json's 25 since generation
 * is reported from grid data even where a capacity register is thin.
 */
export const EMBER_GENERATION = raw.countries as Record<string, GenerationCountry>;

export function generationCountry(code: string): GenerationCountry | undefined {
  return EMBER_GENERATION[code];
}

/** Most recent complete year's solar share of generation, in percent - null if this code has no series. */
export function latestSharePct(code: string): number | null {
  const series = EMBER_GENERATION[code]?.series;
  if (!series || series.length === 0) return null;
  return series[series.length - 1].sharePct;
}
