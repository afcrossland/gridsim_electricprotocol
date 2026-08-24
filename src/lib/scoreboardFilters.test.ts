import { describe, expect, it } from "vitest";

import {
  DEFAULT_SCOREBOARD_FILTERS,
  NOT_ENOUGH_DATA_BAND,
  compareGroups,
  isDefaultFilters,
  matchesFilters,
} from "./scoreboardFilters";
import type { GroupedScore } from "./types";

function group(overrides: Partial<GroupedScore>): GroupedScore {
  return {
    code: "GB",
    name: "United Kingdom",
    isGroup: false,
    children: [],
    score: 0.7,
    completeness: 1,
    ranked: true,
    rankedChildren: 0,
    totalChildren: 0,
    hasOwnScore: true,
    ...overrides,
  };
}

describe("matchesFilters", () => {
  it("matches everything under the default filters", () => {
    expect(matchesFilters(group({}), DEFAULT_SCOREBOARD_FILTERS)).toBe(true);
    expect(isDefaultFilters(DEFAULT_SCOREBOARD_FILTERS)).toBe(true);
  });

  it("filters by continent", () => {
    const gb = group({ code: "GB" }); // Northern Europe -> Europe
    expect(
      matchesFilters(gb, { ...DEFAULT_SCOREBOARD_FILTERS, continents: ["Europe"] }),
    ).toBe(true);
    expect(
      matchesFilters(gb, { ...DEFAULT_SCOREBOARD_FILTERS, continents: ["Asia"] }),
    ).toBe(false);
  });

  it("matches any of several selected continents", () => {
    const gb = group({ code: "GB" });
    expect(
      matchesFilters(gb, { ...DEFAULT_SCOREBOARD_FILTERS, continents: ["Asia", "Europe"] }),
    ).toBe(true);
  });

  it("resolves the EU bloc's continent without a jurisdiction index entry", () => {
    const eu = group({ code: "EU", name: "European Union" });
    expect(
      matchesFilters(eu, { ...DEFAULT_SCOREBOARD_FILTERS, continents: ["Europe"] }),
    ).toBe(true);
    expect(
      matchesFilters(eu, { ...DEFAULT_SCOREBOARD_FILTERS, continents: ["Africa"] }),
    ).toBe(false);
  });

  it("filters by an explicit list of countries", () => {
    const gb = group({ code: "GB" });
    expect(
      matchesFilters(gb, { ...DEFAULT_SCOREBOARD_FILTERS, countries: ["GB", "DE"] }),
    ).toBe(true);
    expect(matchesFilters(gb, { ...DEFAULT_SCOREBOARD_FILTERS, countries: ["DE"] })).toBe(false);
  });

  it("filters by score band", () => {
    const good = group({ score: 0.65, ranked: true }); // Effective
    expect(
      matchesFilters(good, { ...DEFAULT_SCOREBOARD_FILTERS, bands: ["Effective"] }),
    ).toBe(true);
    expect(
      matchesFilters(good, { ...DEFAULT_SCOREBOARD_FILTERS, bands: ["Very effective"] }),
    ).toBe(false);
  });

  it("filters by percentage range", () => {
    const mid = group({ score: 0.5, ranked: true });
    expect(
      matchesFilters(mid, { ...DEFAULT_SCOREBOARD_FILTERS, minScore: 40, maxScore: 60 }),
    ).toBe(true);
    expect(
      matchesFilters(mid, { ...DEFAULT_SCOREBOARD_FILTERS, minScore: 60, maxScore: 100 }),
    ).toBe(false);
  });

  it("excludes an unranked row from a non-default score filter unless 'not enough data' is selected", () => {
    const thin = group({ ranked: false, score: 0 });
    expect(matchesFilters(thin, DEFAULT_SCOREBOARD_FILTERS)).toBe(true);
    expect(
      matchesFilters(thin, { ...DEFAULT_SCOREBOARD_FILTERS, minScore: 10 }),
    ).toBe(false);
    expect(
      matchesFilters(thin, { ...DEFAULT_SCOREBOARD_FILTERS, bands: ["Effective"] }),
    ).toBe(false);
    expect(
      matchesFilters(thin, { ...DEFAULT_SCOREBOARD_FILTERS, bands: [NOT_ENOUGH_DATA_BAND] }),
    ).toBe(true);
  });
});

describe("compareGroups", () => {
  it("never lets an unranked row's placeholder 0 score sort it among genuinely low scorers", () => {
    const veryLow = group({ ranked: true, score: 0.01, completeness: 0.4 });
    const unranked = group({ ranked: false, score: 0, completeness: 0.05 });

    // Low to high: a real 1% score comes before an unranked row, not after -
    // the unranked row's underlying `score` of 0 would otherwise put it
    // first, ahead of an actually-measured (if very low) score.
    expect(compareGroups(veryLow, unranked, "score-asc")).toBeLessThan(0);
    expect(compareGroups(unranked, veryLow, "score-asc")).toBeGreaterThan(0);

    // High to low: still ranked-before-unranked, regardless of direction.
    expect(compareGroups(veryLow, unranked, "score-desc")).toBeLessThan(0);
  });

  it("orders two ranked rows normally in both score directions", () => {
    const higher = group({ ranked: true, score: 0.8 });
    const lower = group({ ranked: true, score: 0.3 });
    expect(compareGroups(higher, lower, "score-desc")).toBeLessThan(0);
    expect(compareGroups(higher, lower, "score-asc")).toBeGreaterThan(0);
  });

  it("has no unranked-placeholder problem for completeness - it orders every row", () => {
    const thin = group({ ranked: false, score: 0, completeness: 0.05 });
    const full = group({ ranked: true, score: 0.6, completeness: 1 });
    expect(compareGroups(full, thin, "completeness-desc")).toBeLessThan(0);
    expect(compareGroups(thin, full, "completeness-asc")).toBeLessThan(0);
  });
});
