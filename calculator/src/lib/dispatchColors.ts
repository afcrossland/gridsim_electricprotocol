/**
 * Colors for the Dispatch tab's stacked charts - five identities, per
 * Andrew's own explicit mapping 2026-09-17 ("solar to demand = yellow,
 * solar to battery = orange, battery discharge = teal, grid import =
 * grey, grid export = red. Align as best you can to GSC palette"):
 * solar-to-demand, battery charge, battery discharge, grid import, solar
 * export. Battery charge/discharge now take their own distinct colors
 * (previously one shared hue, sign carrying the direction) since Andrew's
 * own mapping puts them in different hue families entirely.
 *
 * "As best you can" is doing real work here: yellow, orange and red are
 * three warm hues clustered on the same side of the wheel, which is
 * inherently hard to make CVD-distinguishable - `validate_palette.js`
 * fails this set (orange/red ΔE ~6-7, below the 15 normal-vision floor).
 * Andrew's own explicit five-role mapping is a deliberate choice that
 * overrides the validator here (same as the grid-grey exemption already
 * did for the chroma-floor check) - this file picks the most separated
 * GSC-aligned variant of each hue it can, and leans on this chart's own
 * always-present legend and hover tooltip (which label every series by
 * name, not just color) as the mitigation the validator itself calls for
 * when a pair can't clear the floor on hue alone.
 *
 * GSC brand hex used directly where the role already has an established
 * brand color elsewhere in this app: yellow = the same citrus as the
 * Generation chart, teal = the same teal as the Demand chart. Orange and
 * red don't have an existing brand hex in this app, so they're picked as
 * the most separated warm variants available rather than the dataviz
 * skill's own validated orange/red slots (which sit too close to each
 * other and to yellow once teal's own brand hue is fixed in place). Grid
 * import stays the deliberate neutral grey from earlier the same day -
 * still not run through the categorical validator, for the reason
 * explained above.
 *
 * Orange's own hex was picked twice: the first attempt (`#C2410C`, a
 * "burnt orange") sat only ~17deg of hue from the red - dark and
 * brownish enough that Andrew called it out 2026-09-18 as still reading
 * too close to red. Replaced with a true, saturated orange (`#F97316`,
 * Tailwind's own orange-500) instead of a darker/muddier variant -
 * pushing lightness/chroma apart reads more distinctly than hue alone
 * can, in this three-warm-hue cluster.
 */
export interface DispatchColors {
  solarToDemand: string;
  batteryCharge: string;
  batteryDischarge: string;
  gridImport: string;
  solarExport: string;
}

const LIGHT: DispatchColors = {
  solarToDemand: "#FBB114", // GSC citrus - same as the Generation chart
  batteryCharge: "#F97316", // true orange - distinct from the red, not a dark red-orange
  batteryDischarge: "#00ABBB", // GSC teal - same as the Demand chart
  gridImport: "#6B7280",
  solarExport: "#DC2626",
};

const DARK: DispatchColors = {
  solarToDemand: "#D4960F",
  batteryCharge: "#FB923C",
  batteryDischarge: "#008194",
  gridImport: "#9CA3AF",
  solarExport: "#EF4444",
};

export function getDispatchColors(mode: "light" | "dark"): DispatchColors {
  return mode === "dark" ? DARK : LIGHT;
}
