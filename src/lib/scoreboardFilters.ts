import { continentOf } from "./jurisdictions";
import { scoreBand } from "./scoring";
import type { GroupedScore } from "./types";

/** Pseudo-band a reader can filter to explicitly, for jurisdictions with no score to band. */
export const NOT_ENOUGH_DATA_BAND = "Not enough data";

export interface ScoreboardFilters {
  /** Continents to restrict to. Empty = every continent. */
  continents: string[];
  /** Jurisdiction codes to restrict to. Empty = every jurisdiction. */
  countries: string[];
  /** Score band labels (including NOT_ENOUGH_DATA_BAND) to restrict to. Empty = every band. */
  bands: string[];
  /** Percentage, 0-100 inclusive. */
  minScore: number;
  maxScore: number;
}

export const DEFAULT_SCOREBOARD_FILTERS: ScoreboardFilters = {
  continents: [],
  countries: [],
  bands: [],
  minScore: 0,
  maxScore: 100,
};

/** The EU bloc has no jurisdiction index entry of its own to look a continent up from. */
const BLOC_CONTINENTS: Record<string, string> = {
  EU: "Europe",
};

export function continentOfGroup(group: GroupedScore): string | null {
  return BLOC_CONTINENTS[group.code] ?? continentOf(group.code);
}

export function isDefaultFilters(filters: ScoreboardFilters): boolean {
  return (
    filters.continents.length === 0 &&
    filters.countries.length === 0 &&
    filters.bands.length === 0 &&
    filters.minScore === 0 &&
    filters.maxScore === 100
  );
}

export type ScoreboardSort =
  | "completeness-desc"
  | "completeness-asc"
  | "score-desc"
  | "score-asc";

export const DEFAULT_SCOREBOARD_SORT: ScoreboardSort = "score-desc";

export function isCompletenessSort(sort: ScoreboardSort): boolean {
  return sort === "completeness-desc" || sort === "completeness-asc";
}

/**
 * Orders two scoreboard rows for the given sort. Ties break on the other
 * measure, so a sort never looks arbitrarily shuffled within a tied group -
 * sorting by completeness still puts the higher scorer first among equally
 * complete rows, and vice versa.
 *
 * A row below the ranking threshold has no real score - `score` is just 0 on
 * the underlying record, not a measured "very poor" - so a score sort always
 * places every unranked row after every ranked one, in both directions,
 * rather than letting that placeholder 0 sort them in among genuinely
 * low-scoring rows. Completeness has no such placeholder problem: it is a
 * real, always-known number even below the threshold, so a completeness sort
 * orders every row on equal footing.
 *
 * Typed structurally (just the three fields it needs) rather than against
 * `GroupedScore` specifically, so the same comparator also orders a group's
 * expanded `CountryScore[]` children.
 */
export function compareGroups(
  a: { score: number; completeness: number; ranked: boolean },
  b: { score: number; completeness: number; ranked: boolean },
  sort: ScoreboardSort,
): number {
  switch (sort) {
    case "score-desc":
      if (a.ranked !== b.ranked) return a.ranked ? -1 : 1;
      return b.score - a.score || b.completeness - a.completeness;
    case "score-asc":
      if (a.ranked !== b.ranked) return a.ranked ? -1 : 1;
      return a.score - b.score || b.completeness - a.completeness;
    case "completeness-desc":
      return b.completeness - a.completeness || b.score - a.score;
    case "completeness-asc":
      return a.completeness - b.completeness || b.score - a.score;
  }
}

/**
 * Whether a scoreboard row survives the current filters. A row with no score
 * (below the completeness threshold) has nothing for the score-range filter
 * to compare against, so it is excluded by a non-default range and only
 * included by the band filter if `NOT_ENOUGH_DATA_BAND` was explicitly
 * selected - a range slider left at its default does not silently hide it,
 * but touching it expresses an intent to filter by score, which an unscored
 * row cannot satisfy.
 */
export function matchesFilters(group: GroupedScore, filters: ScoreboardFilters): boolean {
  if (filters.continents.length > 0) {
    const continent = continentOfGroup(group);
    if (!continent || !filters.continents.includes(continent)) return false;
  }
  if (filters.countries.length > 0 && !filters.countries.includes(group.code)) return false;

  if (!group.ranked) {
    if (filters.bands.length > 0) return filters.bands.includes(NOT_ENOUGH_DATA_BAND);
    if (filters.minScore > 0 || filters.maxScore < 100) return false;
    return true;
  }

  const pct = group.score * 100;
  if (filters.minScore > 0 && pct < filters.minScore) return false;
  if (filters.maxScore < 100 && pct > filters.maxScore) return false;
  if (filters.bands.length > 0 && !filters.bands.includes(scoreBand(group.score).label)) return false;
  return true;
}
