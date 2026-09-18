/** Axis-label formatting for this app's own hand-built SVG charts - the plain rounded number (with thousands separators), never abbreviated as "1.2k" (per Andrew's own instruction 2026-09-18, "on y axis say 2000 not 2.0k"). */
export function formatAxisValue(value: number): string {
  return Math.round(value).toLocaleString();
}

/**
 * "Nice" round y-axis tick values from 0 up to a ceiling >= max - e.g.
 * niceTicks(1900) -> [0, 500, 1000, 1500, 2000] (a sensible 500-kWh step,
 * ymax a clean multiple of it), never a raw fraction of the data's own max
 * like "0, 475, 950, 1425, 1900". Same 1/2/5-per-decade step snapping
 * every charting library uses. Per Andrew's own instruction 2026-09-17
 * ("on the yaxis use sensible spacing e.g. 100Wh or 200kWh") and
 * 2026-09-18 ("ensure ymax is a clean multiple e.g. if in steps of 500
 * then ymax is 2000, 2500 etc") - the ceiling is rounded *up* to the next
 * whole step past `max` (not just the largest whole-step multiple <=
 * max, which the original version returned - that could sit below the
 * real data max and clip the topmost bar/line off the chart). The last
 * tick returned is this axis's own ceiling - callers should scale
 * bars/lines against *that*, not the raw max, so the topmost gridline
 * lines up with the chart's own top edge.
 */
export function niceTicks(max: number, targetCount = 4): number[] {
  if (max <= 0) return [0];
  const rawStep = max / targetCount;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const residual = rawStep / magnitude;
  const niceResidual = residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 5 ? 5 : 10;
  const step = niceResidual * magnitude;
  const ceiling = Math.ceil((max - step * 0.001) / step) * step;

  const ticks: number[] = [];
  for (let v = 0; v <= ceiling + step * 0.001; v += step) ticks.push(Math.round((v + Number.EPSILON) * 1000) / 1000);
  return ticks;
}
