/**
 * The amber-to-aqua choropleth ramp shared by all three apps' own maps -
 * confirmed byte-identical (`calculator/src/lib/mapColor.ts`'s own
 * `RAMP_STOPS`, `deployment/src/lib/metrics.ts`'s own `RAMP_STOPS`, and
 * the root app's `src/lib/scoring.ts`'s own `SCORE_RAMP`) before this
 * shared copy was written 2026-09-19. Named `GSC_RAMP` here rather than
 * either app's own metric-specific name, since it isn't tied to one
 * app's own vocabulary (a "score," a "metric," a "self-sufficiency %").
 */
export const GSC_RAMP: { stop: number; color: string }[] = [
  { stop: 0, color: "#FBB114" },
  { stop: 0.25, color: "#F8CB6E" },
  { stop: 0.5, color: "#F5E6C8" },
  { stop: 0.75, color: "#7AC8C1" },
  { stop: 1, color: "#00ABBB" },
];

/** Fill colour for a country with no value for the current metric - same grey across all three apps. */
export const COLOR_NO_DATA = "#E5E7EB";

/**
 * Log-scale 0-1 normalisation for a right-skewed, unbounded metric (e.g.
 * annual generation kWh/kWp) - ported verbatim from
 * `calculator/src/lib/mapColor.ts`'s own `logNormalize` (deployment's own
 * `metrics.ts` uses the identical logic for its own right-skewed
 * metrics).
 */
export function logNormalize(value: number, min: number, max: number): number {
  const logMin = Math.log10(min || 1);
  const logMax = Math.log10(max || 1);
  const logSpan = logMax - logMin || 1;
  return Math.min(1, Math.max(0, (Math.log10(Math.max(value, min || 1)) - logMin) / logSpan));
}

/**
 * Plain linear 0-1 normalisation against a fixed domain - the shape the
 * root app's own `PolicyMap.tsx` uses inline for its 0-100 score (a
 * bounded, not right-skewed, metric) rather than `logNormalize` above.
 */
export function linearNormalize(value: number, min: number, max: number): number {
  return Math.min(1, Math.max(0, (value - min) / (max - min || 1)));
}
