import index from "../data/jurisdictions.json";

export interface Jurisdiction {
  code: string;
  name: string;
  level: "country" | "subnational";
  /** ISO 3166-1 code of the country this belongs to, or null for a country. */
  parent: string | null;
  /**
   * Grouping label for the search list: a UN sub-region for a country, or the
   * parent country's name for a subnational jurisdiction.
   */
  region: string | null;
  /**
   * Whether this jurisdiction is drawn on the map. False for a country that has
   * been subdivided: it keeps an index entry so its states can name their
   * parent, but has no shape of its own.
   */
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

/**
 * Subnational jurisdictions of a country, or an empty array.
 *
 * Having children does not by itself mean the country has no shape of its
 * own - France has five (its overseas exclaves, pulled out because they run
 * their own electricity regime) while keeping its own mappable, scoreable
 * "FR" shape for everywhere else. Use `isSubdivided` to tell the two cases
 * apart, since only a genuinely unmappable country needs an answer written
 * against it pushed down to its children.
 */
export function childrenOf(code: string): string[] {
  return childrenByParent.get(code) ?? [];
}

/**
 * True only for a country with no shape of its own - Australia, the US and
 * Canada, drawn entirely as their states/provinces. False for France despite
 * it having children, because "FR" still has a shape and still means
 * metropolitan France.
 */
export function isSubdivided(code: string): boolean {
  const j = byCode.get(code);
  return j != null && !j.mappable && childrenByParent.has(code);
}

/**
 * The codes an answer written against `code` actually applies to.
 *
 * Answering "AU" is a claim about Australian federal policy, which binds every
 * state; the map has no "AU" shape to colour, so the answer resolves to the
 * eight state codes instead. Answering "AU-SA" resolves to just South Australia.
 *
 * Answering "FR" resolves to just ["FR"] even though France has children: the
 * "FR" shape still exists and still means metropolitan France specifically,
 * so a directive-baseline EU answer written for France must not silently leak
 * onto French Guiana, which is not on the European synchronous grid and is not
 * bound by the same rules.
 */
export function resolveTargets(code: string): string[] {
  return isSubdivided(code) ? childrenOf(code) : [code];
}

/** Label showing a subnational jurisdiction in the context of its country. */
export function qualifiedName(code: string): string {
  const j = byCode.get(code);
  if (!j) return code;
  if (!j.parent) return j.name;
  return `${j.name}, ${byCode.get(j.parent)?.name ?? j.parent}`;
}
