import index from "../data/jurisdictions.json";
import { continentOfRegion, continentOverrideFor } from "../../../shared/lib/continents";

export interface Jurisdiction {
  code: string;
  name: string;
  level: "country" | "subnational";
  parent: string | null;
  region: string | null;
  mappable: boolean;
}

/**
 * Same dataset as the sibling deployment/policy apps' own
 * lib/jurisdictions.ts (~317 entries, Natural Earth-derived) - copied
 * rather than imported cross-tree, matching this app family's own
 * "duplicate small shared concepts per app" convention. Trimmed down to
 * just what the map click/search needs (a code -> name lookup) - no
 * Intl.DisplayNames translation (this app is English-only v1, see
 * README.md), no isSubdivided/resolveTargets machinery (the calculator
 * treats a US/AU state click as its own distinct location, not something
 * that needs pushing back up to a country-level answer the way the policy
 * tool's scoring model does).
 */
export const jurisdictions = index as Jurisdiction[];

const byCode = new Map(jurisdictions.map((j) => [j.code, j]));

export function getJurisdiction(code: string): Jurisdiction | undefined {
  return byCode.get(code);
}

export function jurisdictionName(code: string): string {
  return byCode.get(code)?.name ?? code;
}

/** The ISO 3166-1 alpha-2 country code a (possibly subnational, e.g. "US-CA") jurisdiction code belongs to. */
export function countryCodeOf(code: string): string {
  return code.split("-")[0];
}

/**
 * A jurisdiction's continent, for the ranked list's own filter (added
 * 2026-09-28 per Andrew's own instruction "this should use a common
 * element" - deployment's and policy's own lists already had this). Same
 * parent-walk as policy's own `continentOf` (not deployment's simpler
 * version, which never needs one) - a subnational jurisdiction's own
 * `region` field holds its parent's *name*, not a UN sub-region, so this
 * looks the parent up instead.
 */
export function continentOf(code: string): string | null {
  const override = continentOverrideFor(code);
  if (override) return override;
  const j = byCode.get(code);
  if (!j) return null;
  const region = j.parent ? byCode.get(j.parent)?.region : j.region;
  return continentOfRegion(region);
}
