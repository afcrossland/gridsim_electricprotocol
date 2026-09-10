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
