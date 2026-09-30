import raw from "../data/population.json";

export interface PopulationEntry {
  name: string;
  populationMillions: number;
  year: number;
}

/** Real population figures - see scripts/build_population.py for source (World Bank, Taiwan hand-added). */
export const POPULATION = raw.countries as Record<string, PopulationEntry>;

export function populationMillions(code: string): number | null {
  return POPULATION[code]?.populationMillions ?? null;
}

/**
 * Actual head count (not abbreviated to millions), rounded to the nearest
 * 1,000 once it's above 10,000 - every real country clears that threshold,
 * so this always rounds in practice, but the guard keeps the function
 * honest for a hypothetical tiny territory rather than baking in "always
 * round" as an assumption. Per Andrew's instruction 2026-09-13: the
 * population stat tile shows the real number, not "1,406.585M".
 */
function roundPopulation(actual: number): number {
  return actual > 10_000 ? Math.round(actual / 1000) * 1000 : Math.round(actual);
}

export function populationActual(code: string): number | null {
  const millions = populationMillions(code);
  if (millions === null) return null;
  return roundPopulation(millions * 1_000_000);
}

/**
 * Sum of population across a set of countries - used for the "Global" row's
 * own population stat tile (all codes) and, generalized 2026-09-30, the
 * continent filter's own regional aggregate row (just the filtered codes) -
 * see lib/aggregateSolar.ts's own doc comment for why "Global" moved onto
 * this same general mechanism instead of staying its own special case.
 * Each entry is that country's own latest World Bank year, not all the
 * same year, so this is a "most recent figure available per country, added
 * together" total rather than a true single-year census -
 * `regionPopulationYearRange()` reports the spread for the tile's tooltip.
 * Omit `codes` for every country (the old `worldPopulationMillions`'s own
 * behaviour).
 */
export function regionPopulationMillions(codes?: string[]): number {
  const entries = codes ? codes.map((c) => POPULATION[c]).filter((p): p is PopulationEntry => Boolean(p)) : Object.values(POPULATION);
  return entries.reduce((sum, p) => sum + p.populationMillions, 0);
}

/** [oldest, newest] year among the given countries' own population figures - see regionPopulationMillions. Omit `codes` for every country. */
export function regionPopulationYearRange(codes?: string[]): [number, number] {
  const entries = codes ? codes.map((c) => POPULATION[c]).filter((p): p is PopulationEntry => Boolean(p)) : Object.values(POPULATION);
  const years = entries.map((p) => p.year);
  return years.length ? [Math.min(...years), Math.max(...years)] : [0, 0];
}

/** regionPopulationMillions(codes), as a real head count rounded the same way populationActual() rounds a single country's. Omit `codes` for every country. */
export function regionPopulationActual(codes?: string[]): number {
  return roundPopulation(regionPopulationMillions(codes) * 1_000_000);
}
