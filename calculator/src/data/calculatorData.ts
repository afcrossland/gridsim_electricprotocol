import pc1Json from "./pc1-demand-profile.json";
import selfSufficiencyJson from "./country-self-sufficiency.json";

/**
 * The calculator's small datasets, in one place: the PC1 demand shape, the
 * precomputed self-sufficiency tiers and (from the database only) an index of
 * every country's irradiance point and annual yield.
 *
 * They start as the JSON bundled into the build. When the build sets
 * VITE_CALCULATOR_API (dev only, see deploy.yml), `main.tsx` calls
 * `loadCalculatorData()` before importing the app, and a good response from
 * `/api/calculator/summary` - the Electric Futures database's `calculator`
 * schema - replaces them and switches the 8760-hour irradiance profiles over
 * to the API too (lib/countryIrradiance.ts: one country at a time instead of
 * the whole 10.7 MB file). Any failure keeps the bundled data.
 *
 * lib/demandProfile.ts reads this at module load, so `readCalculatorData()`
 * locks it: a load that finishes after something has read it is refused, so
 * the app is never built from two sources.
 */

export interface IrradianceIndexEntry {
  lat: number;
  lon: number;
  tiltDeg: number;
  azimuthDeg: number;
  annualKWhPerKWp: number;
}

export interface SelfSufficiencyTiers {
  low: number;
  medium: number;
  high: number;
}

export interface CalculatorData {
  pc1: number[];
  selfSufficiency: Record<string, SelfSufficiencyTiers>;
  /** Only set when the data came from the API. */
  index: Record<string, IrradianceIndexEntry> | null;
}

export type CalculatorDataSource = "bundled" | "api";

export const CALCULATOR_API = "/api/calculator";

const data: CalculatorData = {
  pc1: pc1Json as number[],
  selfSufficiency: selfSufficiencyJson as Record<string, SelfSufficiencyTiers>,
  index: null,
};
let source: CalculatorDataSource = "bundled";
let read = false;

export function readCalculatorData(): CalculatorData {
  read = true;
  return data;
}

export function calculatorDataSource(): CalculatorDataSource {
  return source;
}

interface SummaryResponse {
  index: Record<string, IrradianceIndexEntry>;
  selfSufficiency: Record<string, SelfSufficiencyTiers>;
  pc1DemandProfile: number[];
}

function looksLikeSummary(value: unknown): value is SummaryResponse {
  const v = value as Partial<SummaryResponse> | null;
  return (
    !!v &&
    Array.isArray(v.pc1DemandProfile) &&
    v.pc1DemandProfile.length === 8760 &&
    !!v.index &&
    Object.keys(v.index).length > 0 &&
    !!v.selfSufficiency &&
    Object.keys(v.selfSufficiency).length > 0
  );
}

/**
 * Replace the bundled data with the API's, if it answers in time with
 * something of the right shape. Never throws; resolves to the source in use.
 */
export async function loadCalculatorData({
  url = `${CALCULATOR_API}/summary`,
  timeoutMs = 8000,
  fetchImpl = fetch,
}: { url?: string; timeoutMs?: number; fetchImpl?: typeof fetch } = {}): Promise<CalculatorDataSource> {
  if (read) {
    console.error("Calculator data was read before loadCalculatorData() finished; keeping the bundled JSON.");
    return source;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body: unknown = await response.json();
    if (!looksLikeSummary(body)) throw new Error("unexpected response shape");
    if (read) throw new Error("data was read while the request was in flight");
    data.pc1 = body.pc1DemandProfile;
    data.selfSufficiency = body.selfSufficiency;
    data.index = body.index;
    source = "api";
  } catch (error) {
    console.warn(`Calculator data: using the bundled JSON (${url} unavailable: ${String(error)})`);
  } finally {
    clearTimeout(timer);
  }
  return source;
}
