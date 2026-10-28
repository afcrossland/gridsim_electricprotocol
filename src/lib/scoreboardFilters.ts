import { subregionOf } from "./jurisdictions";
import { scoreBand } from "./scoring";
import type { GroupedScore } from "./types";

/** Pseudo-band a reader can filter to explicitly, for jurisdictions with no score to band. */
export const NOT_ENOUGH_DATA_BAND = "Not enough data";

export interface ScoreboardFilters {
  /** UN geoscheme sub-regions to restrict to (the same region filter as the Deployment Explorer's - one at a time). Empty = every region. */
  subregions: string[];
  /** Score band labels (including NOT_ENOUGH_DATA_BAND) to restrict to. Empty = every band. */
  bands: string[];
}

export const DEFAULT_SCOREBOARD_FILTERS: ScoreboardFilters = {
  subregions: [],
  bands: [],
};

export function subregionOfGroup(group: GroupedScore): string | null {
  return subregionOf(group.code);
}

export function isDefaultFilters(filters: ScoreboardFilters): boolean {
  return (
    filters.subregions.length === 0 &&
    filters.bands.length === 0
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
 * (below the completeness threshold) has no band to match, so it only
 * survives a band filter if `NOT_ENOUGH_DATA_BAND` was explicitly selected.
 */
export function matchesFilters(group: GroupedScore, filters: ScoreboardFilters): boolean {
  if (filters.subregions.length > 0) {
    const subregion = subregionOfGroup(group);
    if (!subregion || !filters.subregions.includes(subregion)) return false;
  }

  if (!group.ranked) {
    if (filters.bands.length > 0) return filters.bands.includes(NOT_ENOUGH_DATA_BAND);
    return true;
  }

  if (filters.bands.length > 0 && !filters.bands.includes(scoreBand(group.score).label)) return false;
  return true;
}
