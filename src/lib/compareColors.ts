/**
 * Colour assignment for multi-country compare (the windrose lines and the
 * rubric tiles' flag clusters). Validated with the dataviz skill's
 * `validate_palette.js` (categorical, light mode - this app has no dark
 * mode) - `node scripts/validate_palette.js "#2a78d6,#eb6834,#1baf7a,#eda100,#e87ba4" --mode light`
 * passes every check (lightness band, chroma floor, CVD adjacent-pair
 * separation, normal-vision floor) in this exact order. Reordering or
 * swapping a hex breaks that guarantee - re-run the validator first.
 *
 * The primary series deliberately is NOT the app's usual GSC Aqua
 * (`primary.main`, used everywhere else for "this jurisdiction") - Aqua
 * sits too close in hue to a plausible comparator colour to pass CVD
 * separation as a 5-series set, and re-stepping the brand hue was ruled
 * out (see the skill's "documented-palette rule"). The windrose carries
 * its own legend precisely because its line colours diverge from the rest
 * of the app's colour language.
 */
export const PRIMARY_SERIES_COLOR = "#2a78d6";

export const COMPARE_SERIES_COLORS = ["#eb6834", "#1baf7a", "#eda100", "#e87ba4"] as const;

/** Windrose lines get busy past this many comparators (5 total with the primary). */
export const MAX_COMPARE_COUNTRIES = COMPARE_SERIES_COLORS.length;

/** Colour for the Nth comparator (0-indexed, insertion order - stable regardless of removals elsewhere in the list). */
export function compareColorFor(index: number): string {
  return COMPARE_SERIES_COLORS[index % COMPARE_SERIES_COLORS.length];
}
