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
export function populationActual(code: string): number | null {
  const millions = populationMillions(code);
  if (millions === null) return null;
  const actual = millions * 1_000_000;
  return actual > 10_000 ? Math.round(actual / 1000) * 1000 : Math.round(actual);
}
