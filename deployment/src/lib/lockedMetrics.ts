import type { TimeseriesPoint } from "../components/TimeseriesChart";

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Placeholder per-year series for a "members only" chart Deployment
 * Explorer has no real data source for yet - Workforce, Cost, Solar
 * target, Auction price (added 2026-09-11 per Andrew's instruction, always
 * blurred - see LockedMetricChart.tsx). Deterministic from `seedKey`
 * (country code + metric name) so a given country's charts look the same
 * on every render instead of jumping around on reload - this is not real
 * data, just a plausible shape for something nobody is meant to actually
 * read.
 */
export function syntheticSeries(
  seedKey: string,
  startYear: number,
  endYear: number,
  from: number,
  to: number,
): TimeseriesPoint[] {
  const rand = mulberry32(hashString(seedKey));
  const years: number[] = [];
  for (let year = startYear; year <= endYear; year++) years.push(year);

  return years.map((year, i) => {
    const t = i / (years.length - 1 || 1);
    const base = from + (to - from) * t;
    const noise = (rand() - 0.5) * Math.abs(to - from) * 0.12;
    return { value: Math.max(0, base + noise), label: String(year), year };
  });
}
