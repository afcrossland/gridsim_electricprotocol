import { calculateGeneric } from "./calculateGeneric";
import type { SavingsInputs, SavingsResults } from "./types";

/**
 * Top-level entry point - every location uses the generic 8760 generation/
 * demand/battery-dispatch model (calculateGeneric.ts) for now.
 *
 * A GB-specific path using the real MCS MGD003 lookup-table method (ported
 * from mygridgb) existed here briefly (calculateGB.ts, removed 2026-09-16
 * per Andrew's instruction) and will come back later - kept as its own
 * function/dispatcher specifically so re-adding a location-specific branch
 * later is a contained change here, not a rewrite of every call site.
 */
export function calculateSavings(inputs: SavingsInputs): Promise<SavingsResults> {
  return calculateGeneric(inputs);
}
