import subdivisionNames from "../data/subdivision-names.json";
import { continentOfRegion, continentOverrideFor, subregionOverrideFor } from "./continents";

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

/**
 * Cache of one Intl.DisplayNames instance per language - constructing one
 * isn't free, and every jurisdiction lookup for a given render would
 * otherwise build a fresh one.
 */
const regionDisplayNamesCache = new Map<string, Intl.DisplayNames | null>();

/**
 * A plain country code's own localised name, straight from the browser's
 * ICU data - covers every ISO 3166-1-ish code in the jurisdictions list
 * (confirmed directly, including the non-obvious ones: XK "Kosovo", EU
 * "European Union", TW, EH, VA, PS, MF, SX, CW, BQ, AX, BL all resolve
 * correctly in es/fr). Returns null on any miss or unsupported
 * language/code, so callers can fall back to the English name.
 */
function regionDisplayName(code: string, language: string): string | null {
  let dn = regionDisplayNamesCache.get(language);
  if (dn === undefined) {
    try {
      dn = new Intl.DisplayNames([language], { type: "region" });
    } catch {
      dn = null;
    }
    regionDisplayNamesCache.set(language, dn);
  }
  if (!dn) return null;
  try {
    const name = dn.of(code);
    return name && name !== code ? name : null;
  } catch {
    return null;
  }
}

/**
 * Everything the three apps ask of the list of jurisdictions (countries, and the states or provinces of a few of
 * them), built once from whichever list the app has. Written once here because Policy, Deployment and the Solar Homes
 * Calculator each carried their own near-identical copy (2026-10-23).
 *
 * The *list* stays per app on purpose: the Policy Explorer reads its own through `readPolicyData()` (the bundled
 * `src/data/jurisdictions.json`, or the policy database's copy of it, which the database imports with a strict field
 * check), where Deployment and the Calculator read the shared country-level copy generated from it
 * (`shared/data/jurisdictions.dissolved.json`, in which Australia, the US and Canada are single shapes).
 */
export function createJurisdictionIndex(jurisdictions: Jurisdiction[]) {
  const byCode = new Map(jurisdictions.map((j) => [j.code, j]));

  const childrenByParent = new Map<string, string[]>();
  for (const j of jurisdictions) {
    if (!j.parent) continue;
    const list = childrenByParent.get(j.parent) ?? [];
    list.push(j.code);
    childrenByParent.set(j.parent, list);
  }

  function getJurisdiction(code: string): Jurisdiction | undefined {
    return byCode.get(code);
  }

  /**
   * A jurisdiction's display name in `language`. English is the index's own `name`; a plain country code is
   * translated from the browser's ICU data; a subdivision (a code with a dash) from `subdivision-names.json`. Every
   * path falls back to the English name.
   */
  function jurisdictionName(code: string, language = "en"): string {
    const j = byCode.get(code);
    if (!j) return code;
    if (language === "en") return j.name;

    if (code.includes("-")) {
      const translations = (subdivisionNames as Record<string, Record<string, string>>)[code];
      return translations?.[language] ?? j.name;
    }
    return regionDisplayName(code, language) ?? j.name;
  }

  function childrenOf(code: string): string[] {
    return childrenByParent.get(code) ?? [];
  }

/**
 * True only for a country with no shape of its own - Australia, the US and
 * Canada, drawn entirely as their states/provinces. False for France despite
 * it having children, because "FR" still has a shape and still means
 * metropolitan France.
 */
  function isSubdivided(code: string): boolean {
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
  function resolveTargets(code: string): string[] {
    return isSubdivided(code) ? childrenOf(code) : [code];
  }

  /** The inverse of `resolveTargets` for a clicked map feature: a state of a subdivided country maps up to the country. */
  function canonicalCode(featureCode: string): string {
    const j = byCode.get(featureCode);
    if (j?.parent && isSubdivided(j.parent)) return j.parent;
    return featureCode;
  }

  /** Label showing a subnational jurisdiction in the context of its country. */
  function qualifiedName(code: string, language = "en"): string {
    const j = byCode.get(code);
    if (!j) return code;
    const name = jurisdictionName(code, language);
    if (!j.parent) return name;
    return `${name}, ${jurisdictionName(j.parent, language)}`;
  }

  /**
   * The UN geoscheme sub-region ("Western Europe", "Caribbean"...) a jurisdiction sits in - the grain the region filter
   * uses in every app. A state or province has no sub-region of its own (its `region` field holds its parent's name),
   * so this walks up to the parent country's, after the handful of overseas-territory overrides.
   */
  function subregionOf(code: string): string | null {
    const override = subregionOverrideFor(code);
    if (override) return override;
    const j = byCode.get(code);
    if (!j) return null;
    return (j.parent ? byCode.get(j.parent)?.region : j.region) ?? null;
  }

/**
 * A jurisdiction's continent, for filtering. Only meaningful for a top-level
 * country - a subnational
 * jurisdiction's own `region` field holds its parent's *name*, not a UN
 * sub-region (see the `region` doc comment above), so this looks the parent
 * up instead of trusting the child's own field. The region->continent table
 * itself is `shared/lib/continents.ts`'s own `continentOfRegion` now - as is
 * the handful of overseas-exclave overrides (`continentOverrideFor`) for
 * jurisdictions this parent-walk gets wrong (found 2026-09-28: Bonaire/Sint
 * Eustatius/Saba resolved to "Europe" via the Netherlands).
 */
  function continentOf(code: string): string | null {
    const override = continentOverrideFor(code);
    if (override) return override;
    const j = byCode.get(code);
    if (!j) return null;
    const region = j.parent ? byCode.get(j.parent)?.region : j.region;
    return continentOfRegion(region);
  }

  return {
    jurisdictions,
    getJurisdiction,
    jurisdictionName,
    childrenOf,
    isSubdivided,
    resolveTargets,
    canonicalCode,
    qualifiedName,
    subregionOf,
    continentOf,
  };
}
