export interface CoverageRow {
  key: string;
  label: string;
  sub?: string;
  /** column key -> fill 0..1 */
  cells: Record<string, number>;
  first: string;
  last: string;
  /** share of the row's own first..last span that has data (0..1) */
  completeness: number;
  /** columns inside the span with no data */
  gaps: number;
}

export function daysInMonth(key: string): number {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function monthRange(from: string, to: string): string[] {
  const out: string[] = [];
  let [y, m] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

/** Row from a set of years that have data (each year fully filled). */
export function yearRow(key: string, label: string, years: number[], sub?: string): CoverageRow {
  const sorted = [...new Set(years)].sort((a, b) => a - b);
  const cells: Record<string, number> = {};
  if (sorted.length) for (let y = sorted[0]; y <= sorted[sorted.length - 1]; y++) cells[String(y)] = sorted.includes(y) ? 1 : 0;
  const span = sorted.length ? sorted[sorted.length - 1] - sorted[0] + 1 : 0;
  return {
    key,
    label,
    sub,
    cells,
    first: sorted.length ? String(sorted[0]) : "",
    last: sorted.length ? String(sorted[sorted.length - 1]) : "",
    completeness: span ? sorted.length / span : 0,
    gaps: span - sorted.length,
  };
}

/** Row from "YYYY-MM" -> days-with-data. */
export function monthRow(key: string, label: string, months: Record<string, number>, sub?: string): CoverageRow {
  const ordered = Object.keys(months).sort();
  const cells: Record<string, number> = {};
  let have = 0;
  let want = 0;
  let gaps = 0;
  if (ordered.length) {
    for (const k of monthRange(ordered[0], ordered[ordered.length - 1])) {
      const dim = daysInMonth(k);
      const fill = Math.min(1, (months[k] ?? 0) / dim);
      cells[k] = fill;
      have += fill * dim;
      want += dim;
      if (!months[k]) gaps += 1;
    }
  }
  return {
    key,
    label,
    sub,
    cells,
    first: ordered[0] ?? "",
    last: ordered[ordered.length - 1] ?? "",
    completeness: want ? have / want : 0,
    gaps,
  };
}

/** Whole days between the end of a "YYYY-MM" / "YYYY" period and now (Infinity if empty). */
export function daysSince(last: string, now = new Date()): number {
  if (!last) return Infinity;
  const [y, m] = last.length === 4 ? [Number(last), 12] : last.split("-").map(Number);
  return Math.max(0, Math.floor((now.getTime() - Date.UTC(y, m, 0)) / 86_400_000));
}

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function rowsToCsv(rows: CoverageRow[]): string {
  const head = ["key", "name", "detail", "first", "last", "completeness_pct", "gap_columns"];
  return [
    head.join(","),
    ...rows.map((r) => [r.key, r.label, r.sub ?? "", r.first, r.last, Math.round(r.completeness * 100), r.gaps].map(csvCell).join(",")),
  ].join("\n");
}

export function downloadCsv(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
