/**
 * Same amber-to-aqua choropleth ramp as Deployment Explorer's own
 * lib/metrics.ts (`RAMP_STOPS`/`COLOR_NO_DATA`) - copied verbatim (not
 * imported cross-tree, matching this app family's own "duplicate small
 * shared concepts per app" convention) so WorldMap.tsx's colouring reads
 * as the same product family, per Andrew's own instruction 2026-09-16.
 */
export const RAMP_STOPS = [
  { stop: 0, color: "#FBB114" },
  { stop: 0.25, color: "#F8CB6E" },
  { stop: 0.5, color: "#F5E6C8" },
  { stop: 0.75, color: "#7AC8C1" },
  { stop: 1, color: "#00ABBB" },
];

export const COLOR_NO_DATA = "#E5E7EB";

/**
 * Log-scale 0-1 normalisation, same reasoning as Deployment Explorer's own
 * DeploymentMap.tsx - even though annual kWh/kWp only spans roughly
 * 700-2,200 across every country here (not the multiple orders of
 * magnitude installed-capacity data spans there), using the same formula
 * keeps the colouring approach consistent across the app family rather
 * than a bespoke linear scale just for this one map.
 */
export function logNormalize(value: number, min: number, max: number): number {
  const logMin = Math.log10(min || 1);
  const logMax = Math.log10(max || 1);
  const logSpan = logMax - logMin || 1;
  return Math.min(1, Math.max(0, (Math.log10(Math.max(value, min || 1)) - logMin) / logSpan));
}
