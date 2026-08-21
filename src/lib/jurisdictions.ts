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
 * A country is either drawn whole or drawn as its states, never both — so a
 * non-empty result here means the country itself is not on the map and answers
 * given at country level have to be pushed down to its children.
 */
export function childrenOf(code: string): string[] {
  return childrenByParent.get(code) ?? [];
}

export function isSubdivided(code: string): boolean {
  return childrenByParent.has(code);
}

/**
 * The codes an answer written against `code` actually applies to.
 *
 * Answering "AU" is a claim about Australian federal policy, which binds every
 * state; the map has no "AU" shape to colour, so the answer resolves to the
 * eight state codes instead. Answering "AU-SA" resolves to just South Australia.
 */
export function resolveTargets(code: string): string[] {
  const children = childrenOf(code);
  return children.length > 0 ? children : [code];
}

/** Label showing a subnational jurisdiction in the context of its country. */
export function qualifiedName(code: string): string {
  const j = byCode.get(code);
  if (!j) return code;
  if (!j.parent) return j.name;
  return `${j.name}, ${byCode.get(j.parent)?.name ?? j.parent}`;
}
