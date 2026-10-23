import index from "../../../shared/data/jurisdictions.dissolved.json";
import { createJurisdictionIndex, type Jurisdiction } from "../../../shared/lib/jurisdictionIndex";

/**
 * The Solar Homes Calculator's jurisdictions: the same shared country-level list the Deployment Explorer uses, with the
 * shared lookups (`shared/lib/jurisdictionIndex.ts`). The calculator treats a US or Australian state click as its own
 * location, so it does not use the subdivision helpers (`resolveTargets` and the rest) the other apps do.
 */
export type { Jurisdiction };

export const { jurisdictions, getJurisdiction, jurisdictionName, subregionOf, continentOf } = createJurisdictionIndex(
  index as Jurisdiction[],
);

/** The ISO 3166-1 alpha-2 country code a (possibly subnational, e.g. "US-CA") jurisdiction code belongs to. */
export function countryCodeOf(code: string): string {
  return code.split("-")[0];
}
