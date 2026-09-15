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
 * Sum of every country's own populationMillions - used for the "Global" row's
 * population stat tile (see lib/globalSolar.ts / Sidebar.tsx's GLOBAL_CODE
 * handling). Each entry is that country's own latest World Bank year, not
 * all the same year, so this is a "most recent figure available per
 * country, added together" total rather than a true single-year census -
 * `worldPopulationYearRange()` reports the spread for the tile's tooltip.
 */
export function worldPopulationMillions(): number {
  return Object.values(POPULATION).reduce((sum, p) => sum + p.populationMillions, 0);
}

/** [oldest, newest] year among every country's own population figure - see worldPopulationMillions. */
export function worldPopulationYearRange(): [number, number] {
  const years = Object.values(POPULATION).map((p) => p.year);
  return [Math.min(...years), Math.max(...years)];
}

/** worldPopulationMillions(), as a real head count rounded the same way populationActual() rounds a single country's. */
export function worldPopulationActual(): number {
  return roundPopulation(worldPopulationMillions() * 1_000_000);
}
