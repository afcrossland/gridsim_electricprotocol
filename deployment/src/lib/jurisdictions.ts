import index from "../../../shared/data/jurisdictions.dissolved.json";
import { SUBREGIONS } from "../../../shared/lib/continents";
import { createJurisdictionIndex, type Jurisdiction } from "../../../shared/lib/jurisdictionIndex";

/**
 * The Deployment Explorer's jurisdictions: the shared country-level list, in which Australia, the US and Canada are
 * single shapes (generated from the Policy Explorer's list by `scripts/dissolve_subdivided.py`). The lookups are the
 * shared ones every app uses (`shared/lib/jurisdictionIndex.ts`). `resolveTargets`/`canonicalCode` are kept for a
 * future dataset that reintroduces a genuinely subdivided country; for these three they are now a no-op.
 */
export type { Jurisdiction };

export const {
  jurisdictions,
  getJurisdiction,
  jurisdictionName,
  childrenOf,
  isSubdivided,
  resolveTargets,
  canonicalCode,
  subregionOf,
} = createJurisdictionIndex(index as Jurisdiction[]);

// Moved to shared/lib/continents.ts 2026-09-28.
export { SUBREGIONS };
