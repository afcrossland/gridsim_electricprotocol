/** A "nice" axis for values from 0 (or `min`) to `max`: round tick values and a ceiling at or above `max`. */
export function niceScale(max: number, ticks: number, min = 0): { min: number; max: number; values: number[] } {
  const span = Math.max(1e-9, max - min);
  const rough = span / Math.max(1, ticks);
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= rough) ?? 10 * pow;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const values: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) values.push(Math.round(v * 1e6) / 1e6);
  return { min: lo, max: hi, values };
}

/** 12345.6 -> "12,346" (the report is read in English, so the separator is fixed). */
export const fmtInt = (n: number): string => Math.round(n).toLocaleString("en-GB");
