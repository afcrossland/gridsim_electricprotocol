// The Future Grid Simulator backend, reached through the sign-in gate's proxy (the Vite dev
// server's proxy locally). The gate adds the klute password that /coverage needs, so the
// browser never sees it; /historic/* is the same public API the simulator's Explore tab uses.
export const FGS_API = "/klute/api/";

export class AuthError extends Error {}

async function get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(path, new URL(FGS_API, window.location.origin));
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url);
  // 401: the gate's sign-in session ran out (reloading shows the sign-in page), or the backend
  // rejected the password the gate sent. 503: the backend has no klute password configured.
  if (res.status === 401 || res.status === 503) throw new AuthError(res.status === 503 ? "The simulator's data explorer is not configured on the server." : "Your sign-in has expired or the simulator rejected the gate's password. Reload the page to sign in again.");
  if (!res.ok) throw new Error(`Simulator returned ${res.status}`);
  return res.json() as Promise<T>;
}

export type FgsDataset = "generation" | "demand" | "installed-capacity" | "weather";

export interface FgsCoverage {
  dataset: FgsDataset;
  kind: "months" | "years";
  regions: { region_code: string; sources?: string[]; months?: Record<string, number>; years?: number[] }[];
}

export const fetchCoverage = (dataset: FgsDataset, fresh = false) =>
  get<FgsCoverage>(`coverage/${dataset}`, fresh ? { refresh: String(Date.now()) } : {});

export type GenerationRow = { ts_utc: string; [fuel: string]: string | number };

export const fetchGeneration = (region: string, start: string, end: string) =>
  get<GenerationRow[]>("historic/generation", { region_code: region, start_ts: start, end_ts: end });

export interface FgsMetrics {
  carbon_intensity?: number;
  low_carbon_percentage?: number;
  total_generation_mwh?: number;
}

export const fetchMetrics = async (region: string, start: string, end: string) => {
  const d = await get<{ results?: FgsMetrics } & FgsMetrics>("historic/metrics", { region_code: region, start_ts: start, end_ts: end });
  return d.results ?? d;
};

export interface CapacityRow {
  year: number;
  source: string;
  asset_type: string;
  mw: number;
}

export const fetchInstalledCapacity = (region: string) =>
  get<{ region_code: string; rows: CapacityRow[] }>("coverage/data/installed-capacity", { region_code: region });

export interface WeatherSeriesMeta {
  source: string;
  variable: string;
  first: string;
  last: string;
}

export const fetchWeatherMeta = () => get<WeatherSeriesMeta[]>("coverage/data/weather/meta");

export type WeatherAgg = "hour" | "day" | "month";

export interface WeatherField {
  source: string;
  variable: string;
  agg: WeatherAgg;
  /** [lon, lat, value] per grid point */
  points: [number, number, number][];
  min: number | null;
  max: number | null;
}

export const fetchWeatherField = (source: string, variable: string, ts: string, agg: WeatherAgg) =>
  get<WeatherField>("coverage/data/weather", { source, variable, ts, agg });

export type FindingKind = "missing" | "zero" | "negative" | "low" | "partial" | "spike" | "dip" | "flat";

export interface Finding {
  kind: FindingKind;
  severity: "high" | "medium" | "low";
  from: string;
  to: string;
  days: number;
  detail: string;
}

export interface QualitySeries {
  source: string;
  days: { d: string; n: number; mean: number }[];
  findings: Finding[];
}

export const fetchQualityRegion = (dataset: "generation" | "demand", region: string) =>
  get<{ sources: QualitySeries[] }>("coverage/data/quality/region", { dataset, region_code: region });

export interface QualitySummaryRow {
  region_code: string;
  source: string;
  days: number;
  first: string;
  last: string;
  flagged_days: number;
  ranges: number;
  by_kind: Partial<Record<FindingKind, number>>;
  worst: "high" | "medium" | "low" | null;
}

export const fetchQualitySummary = (dataset: "generation" | "demand") =>
  get<{ series: QualitySummaryRow[] }>("coverage/data/quality/summary", { dataset });

export interface FreshnessRow {
  dataset: "generation" | "demand";
  source: string;
  region_code: string;
  last_ts: string;
  age_days: number;
  source_latest: string;
  behind_source_days: number;
  last_cleaned: string | null;
}

export const fetchFreshness = () => get<{ now: string; rows: FreshnessRow[] }>("coverage/data/freshness");

export const fetchRegionCountries = () => get<Record<string, string>>("coverage/data/region-countries");
