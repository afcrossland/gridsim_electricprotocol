/**
 * Colour assignment for the side-by-side Compare mode's own panels. A
 * deployment-local copy of ep_policymap's own `src/lib/compareColors.ts`
 * (same hex values, same dataviz-validated categorical set), not a shared
 * import - this round only touches `deployment/`, per Andrew's own
 * instruction 2026-10-13 ("we are only implementing in deployment
 * explorer"). Validated with the dataviz skill's `validate_palette.js`
 * (categorical, light mode) - `node scripts/validate_palette.js
 * "#2a78d6,#eb6834,#1baf7a,#eda100,#e87ba4" --mode light` passes every
 * check (lightness band, chroma floor, CVD adjacent-pair separation, the
 * normal-vision floor) in this exact order; reordering or swapping a hex
 * breaks that guarantee.
 */
export const PRIMARY_SERIES_COLOR = "#2a78d6";

export const COMPARE_SERIES_COLORS = ["#eb6834", "#1baf7a", "#eda100", "#e87ba4"] as const;

/** A compare row gets busy past this many comparators (5 total with the primary). */
export const MAX_COMPARE_COUNTRIES = COMPARE_SERIES_COLORS.length;

/** Colour for the Nth comparator (0-indexed, insertion order - stable regardless of removals elsewhere in the list). */
export function compareColorFor(index: number): string {
  return COMPARE_SERIES_COLORS[index % COMPARE_SERIES_COLORS.length];
}
