import index from "../data/jurisdictions.json";

export interface Jurisdiction {
  code: string;
  name: string;
  level: "country" | "subnational";
  parent: string | null;
  region: string | null;
  mappable: boolean;
}

export const jurisdictions = index as Jurisdiction[];

const byCode = new Map(jurisdictions.map((j) => [j.code, j]));

const childrenByParent = new Map<string, string[]>();
for (const j of jurisdictions) {
  if (!j.parent) continue;
  const list = childrenByParent.get(j.parent) ?? [];
  list.push(j.code);
  childrenByParent.set(j.parent, list);
}

export function getJurisdiction(code: string): Jurisdiction | undefined {
  return byCode.get(code);
}

export function jurisdictionName(code: string): string {
  return byCode.get(code)?.name ?? code;
}

export function childrenOf(code: string): string[] {
  return childrenByParent.get(code) ?? [];
}

/**
 * True only for a country with no shape of its own on the map - Australia
 * and the US, drawn entirely as their states. Ported from
 * ep_policymap/src/lib/jurisdictions.ts - this app's placeholder dataset
 * uses "AU"/"US" as plain country codes, but the shared geometry has no
 * "AU"/"US" polygon at all (only its states/provinces do), so a click or a
 * fitBounds against the bare code silently does nothing without this - see
 * the bug this was written to fix.
 */
export function isSubdivided(code: string): boolean {
  const j = byCode.get(code);
  return j != null && !j.mappable && childrenByParent.has(code);
}

/** The codes a value written against `code` actually applies to on the map - see isSubdivided. */
export function resolveTargets(code: string): string[] {
  return isSubdivided(code) ? childrenOf(code) : [code];
}

/**
 * The inverse of resolveTargets - given a code straight off a clicked map
 * feature (which, for a subdivided country, is a state/province like
 * "US-CA"), what should actually get selected/highlighted/ranked: the
 * parent country if that parent is subdivided, otherwise the feature's own
 * code unchanged. Without this, clicking anywhere in the US/AU/CA would
 * select a state code the ranking list and dummy dataset don't know about,
 * instead of the country the placeholder data is actually keyed by.
 */
export function canonicalCode(featureCode: string): string {
  const j = byCode.get(featureCode);
  if (j?.parent && isSubdivided(j.parent)) return j.parent;
  return featureCode;
}

// Ported from ep_policymap/src/lib/jurisdictions.ts - same reasoning there
// applies here (a short, ordinary continent list rather than the ~20-value
// `region` field).
export const CONTINENTS = ["Africa", "Asia", "Europe", "North America", "South America", "Oceania"] as const;

const CONTINENT_BY_REGION: Record<string, string> = {
  "Northern Africa": "Africa",
  "Eastern Africa": "Africa",
  "Middle Africa": "Africa",
  "Southern Africa": "Africa",
  "Western Africa": "Africa",
  "Central Asia": "Asia",
  "Eastern Asia": "Asia",
  "South-Eastern Asia": "Asia",
  "Southern Asia": "Asia",
  "Western Asia": "Asia",
  "Eastern Europe": "Europe",
  "Northern Europe": "Europe",
  "Southern Europe": "Europe",
  "Western Europe": "Europe",
  Caribbean: "North America",
  "Central America": "North America",
  "Northern America": "North America",
  "South America": "South America",
  "Australia and New Zealand": "Oceania",
  Melanesia: "Oceania",
  Micronesia: "Oceania",
  Polynesia: "Oceania",
};

export function continentOf(code: string): string | null {
  const j = byCode.get(code);
  if (!j) return null;
  return (j.region && CONTINENT_BY_REGION[j.region]) ?? null;
}
