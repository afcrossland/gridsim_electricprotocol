import { sessionPassword } from "./gate";

// The Future Grid Simulator backend. /coverage needs the klute password; /historic/* is the
// same public API the simulator's own Explore tab uses.
export const FGS_API = (import.meta.env.VITE_FGS_API_BASE_URL as string | undefined) ?? "http://localhost:8000";

export class AuthError extends Error {}

async function get<T>(path: string, params: Record<string, string> = {}, auth = false): Promise<T> {
  const url = new URL(path, FGS_API.endsWith("/") ? FGS_API : `${FGS_API}/`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url, { headers: auth ? { "X-Klute-Password": sessionPassword() } : undefined });
  if (res.status === 401 || res.status === 503) throw new AuthError(res.status === 503 ? "The simulator's data explorer is not configured on the server." : "The simulator rejected the password.");
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
  get<FgsCoverage>(`coverage/${dataset}`, fresh ? { refresh: String(Date.now()) } : {}, true);

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
