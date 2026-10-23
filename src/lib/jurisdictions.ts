import { readPolicyData } from "../data/policyData";
import { CONTINENTS } from "../../shared/lib/continents";
import { createJurisdictionIndex, type Jurisdiction } from "../../shared/lib/jurisdictionIndex";

/**
 * The Policy Explorer's jurisdictions: countries, and the states or provinces of Australia, the US and Canada (which are
 * the ones with a map shape of their own here - see `isSubdivided`). The list comes from `readPolicyData()` - the bundled
 * `src/data/jurisdictions.json`, or the policy database's copy of it when the build points at the API - and the lookups
 * (names, children, sub-region, continent...) are the shared ones every app uses (`shared/lib/jurisdictionIndex.ts`).
 */
export type { Jurisdiction };

export const {
  jurisdictions,
  getJurisdiction,
  jurisdictionName,
  childrenOf,
  isSubdivided,
  resolveTargets,
  qualifiedName,
  subregionOf,
  continentOf,
} = createJurisdictionIndex(readPolicyData().jurisdictions as Jurisdiction[]);

/** Options for the Scoreboard's continent filter, in display order - now `shared/lib/continents.ts`, see its own doc comment. */
export { CONTINENTS };
