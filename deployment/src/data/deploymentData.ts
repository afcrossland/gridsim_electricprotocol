/**
 * The Deployment Explorer's three datasets - Ember solar capacity, Ember
 * generation and World Bank population - in one place.
 *
 * `main.tsx` calls `loadDeploymentData()` before importing the app. When the
 * build sets VITE_DEPLOYMENT_API (dev only, see deploy.yml) it first asks
 * `/api/deployment/data` - the `deployment` schema of the Electric Futures
 * database, served in exactly the shapes of `ember_solar.json`,
 * `ember_generation.json` and `population.json`. Any failure, or a build
 * without the flag, loads those bundled files instead, so the app always has
 * data. The bundled files are a separate chunk (dynamic `import()`), only
 * downloaded when the database isn't used.
 *
 * lib/emberSolar.ts, lib/emberGeneration.ts, lib/population.ts and
 * lib/globalSolar.ts read this once, at module load. That is why main.tsx
 * only imports the app after the load settles, and why reading before then
 * throws instead of quietly handing out nothing.
 */

export interface DatasetFile<C> {
  source: unknown;
  fetchedAt: string;
  note: string;
  countries: Record<string, C>;
}

export interface DeploymentData {
  solar: DatasetFile<unknown>;
  generation: DatasetFile<unknown>;
  population: DatasetFile<unknown>;
}

export type DeploymentDataSource = "bundled" | "api";

export const DEPLOYMENT_API_URL = "/api/deployment/data";

let data: DeploymentData | null = null;
let source: DeploymentDataSource = "bundled";
let pending: Promise<DeploymentDataSource> | null = null;

/** The datasets every consumer builds from. Only valid once loadDeploymentData() has resolved. */
export function readDeploymentData(): DeploymentData {
  if (!data) throw new Error("Deployment data was read before loadDeploymentData() finished.");
  return data;
}

/** Where the data in use came from. */
export function deploymentDataSource(): DeploymentDataSource {
  return source;
}

function isDataset(value: unknown): value is DatasetFile<unknown> {
  const v = value as Partial<DatasetFile<unknown>> | null;
  return !!v && typeof v.fetchedAt === "string" && !!v.countries && typeof v.countries === "object" && Object.keys(v.countries).length > 0;
}

function looksLikeDeploymentData(value: unknown): value is DeploymentData {
  const v = value as Partial<DeploymentData> | null;
  return !!v && isDataset(v.solar) && isDataset(v.generation) && isDataset(v.population);
}

async function loadBundled(): Promise<DeploymentData> {
  const [solar, generation, population] = await Promise.all([
    import("./ember_solar.json"),
    import("./ember_generation.json"),
    import("./population.json"),
  ]);
  return { solar: solar.default, generation: generation.default, population: population.default };
}

async function fromApi(url: string, timeoutMs: number, fetchImpl: typeof fetch): Promise<DeploymentData> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body: unknown = await response.json();
    if (!looksLikeDeploymentData(body)) throw new Error("unexpected response shape");
    return body;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Settle the data: from the API when `useApi`, falling back to the bundled
 * files. Never throws (unless the bundled chunk itself can't load); resolves
 * to the source in use. Calling it again returns the first call's result.
 */
export function loadDeploymentData({
  useApi = Boolean(import.meta.env.VITE_DEPLOYMENT_API),
  url = DEPLOYMENT_API_URL,
  timeoutMs = 8000,
  fetchImpl = fetch,
}: { useApi?: boolean; url?: string; timeoutMs?: number; fetchImpl?: typeof fetch } = {}): Promise<DeploymentDataSource> {
  pending ??= (async () => {
    if (useApi) {
      try {
        data = await fromApi(url, timeoutMs, fetchImpl);
        source = "api";
        return source;
      } catch (error) {
        console.warn(`Deployment data: using the bundled JSON (${url} unavailable: ${String(error)})`);
      }
    }
    data = await loadBundled();
    source = "bundled";
    return source;
  })();
  return pending;
}
