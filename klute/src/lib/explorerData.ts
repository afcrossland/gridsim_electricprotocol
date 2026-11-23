import { useEffect, useState } from "react";

/**
 * The Deployment Explorer's and Solar Homes Calculator's data, as /klute shows it: read from the
 * Electric Futures database through the same public endpoints those explorers use
 * (`/api/deployment/data`, `/api/calculator/summary`), so /klute reports what the database actually
 * serves. If an endpoint fails - prod's database has no `deployment`/`calculator` schema yet, or
 * the local dev server runs without a gate - that part falls back to the bundled JSON, loaded with
 * a dynamic `import()` so neither file (the calculator's is 10.7 MB) is in /klute's own bundle.
 * `source` says which one each part came from.
 */

export type DataSource = "database" | "bundled";

export interface SolarCountry {
  name: string;
  granularity: string;
  annualSeries?: { year: number; gw: number }[];
  series?: { year: number; month: number; gw: number }[];
}

export interface GenCountry {
  name: string;
  series: { year: number; solarTWh: number; totalTWh: number; sharePct: number }[];
}

export interface IrradianceIndexEntry {
  lat: number;
  lon: number;
  tiltDeg: number;
  azimuthDeg: number;
  annualKWhPerKWp: number;
}

export interface SelfSufficiency {
  low: number;
  medium: number;
  high: number;
}

export interface DeploymentPart {
  source: DataSource;
  solar: Record<string, SolarCountry>;
  generation: Record<string, GenCountry>;
  solarFetchedAt: string;
}

export interface CalculatorPart {
  source: DataSource;
  irradiance: Record<string, IrradianceIndexEntry>;
  selfSufficiency: Record<string, SelfSufficiency>;
}

export interface ExplorerData {
  deployment: DeploymentPart;
  calculator: CalculatorPart;
}

type Dataset<C> = { fetchedAt: string; countries: Record<string, C> };

async function getJson(url: string, fetchImpl: typeof fetch): Promise<unknown> {
  const response = await fetchImpl(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

const nonEmpty = (v: unknown) => !!v && typeof v === "object" && Object.keys(v).length > 0;

export async function loadDeploymentPart(fetchImpl: typeof fetch = fetch): Promise<DeploymentPart> {
  try {
    const body = (await getJson("/api/deployment/data", fetchImpl)) as { solar?: Dataset<SolarCountry>; generation?: Dataset<GenCountry> };
    if (!nonEmpty(body.solar?.countries) || !nonEmpty(body.generation?.countries)) throw new Error("unexpected response shape");
    return { source: "database", solar: body.solar!.countries, generation: body.generation!.countries, solarFetchedAt: body.solar!.fetchedAt };
  } catch (error) {
    console.warn(`/klute deployment data: using the bundled JSON (${String(error)})`);
    const [solar, generation] = await Promise.all([
      import("../../../deployment/src/data/ember_solar.json"),
      import("../../../deployment/src/data/ember_generation.json"),
    ]);
    return {
      source: "bundled",
      solar: solar.default.countries as unknown as Record<string, SolarCountry>,
      generation: generation.default.countries as unknown as Record<string, GenCountry>,
      solarFetchedAt: solar.default.fetchedAt,
    };
  }
}

export async function loadCalculatorPart(fetchImpl: typeof fetch = fetch): Promise<CalculatorPart> {
  try {
    const body = (await getJson("/api/calculator/summary", fetchImpl)) as { index?: Record<string, IrradianceIndexEntry>; selfSufficiency?: Record<string, SelfSufficiency> };
    if (!nonEmpty(body.index) || !nonEmpty(body.selfSufficiency)) throw new Error("unexpected response shape");
    return { source: "database", irradiance: body.index!, selfSufficiency: body.selfSufficiency! };
  } catch (error) {
    console.warn(`/klute calculator data: using the bundled JSON (${String(error)})`);
    const [irradiance, selfSufficiency] = await Promise.all([
      import("../../../calculator/src/data/country-irradiance.json"),
      import("../../../calculator/src/data/country-self-sufficiency.json"),
    ]);
    const index: Record<string, IrradianceIndexEntry> = {};
    for (const [code, e] of Object.entries(irradiance.default as Record<string, Omit<IrradianceIndexEntry, "annualKWhPerKWp"> & { profileWPerWp: number[] }>)) {
      index[code] = { lat: e.lat, lon: e.lon, tiltDeg: e.tiltDeg, azimuthDeg: e.azimuthDeg, annualKWhPerKWp: e.profileWPerWp.reduce((s, v) => s + v, 0) };
    }
    return { source: "bundled", irradiance: index, selfSufficiency: selfSufficiency.default as Record<string, SelfSufficiency> };
  }
}

let cached: Promise<ExplorerData> | null = null;

/** Both parts, loaded once per page and shared by every panel. Never rejects (each part falls back). */
export function loadExplorerData(): Promise<ExplorerData> {
  cached ??= Promise.all([loadDeploymentPart(), loadCalculatorPart()]).then(([deployment, calculator]) => ({ deployment, calculator }));
  return cached;
}

export function useExplorerData(): ExplorerData | null {
  const [data, setData] = useState<ExplorerData | null>(null);
  useEffect(() => {
    let live = true;
    void loadExplorerData().then((d) => live && setData(d));
    return () => {
      live = false;
    };
  }, []);
  return data;
}

export function sourceLabel(source: DataSource): string {
  return source === "database" ? "from the Electric Futures database" : "from the JSON bundled with the site (the database didn't answer)";
}
