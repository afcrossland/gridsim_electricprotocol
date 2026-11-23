import { CALCULATOR_API, readCalculatorData, type IrradianceIndexEntry } from "../data/calculatorData";

/**
 * Loader/lookup for the per-country 8760-hour W/Wp profiles (see
 * scripts/build_country_irradiance.py and genericSource.ts's own doc comment
 * for the method and caveats), shared by the calculation, the map and the
 * league table.
 *
 * Two sources, chosen by data/calculatorData.ts:
 * - **Database** (dev builds, VITE_CALCULATOR_API): the summary that loaded
 *   before the app already holds every country's point, orientation and
 *   annual yield (`loadIrradianceIndex`), so the map and league table need no
 *   profiles at all. A calculation fetches just its own country's profile
 *   from `/api/calculator/irradiance/{code}` (about 11 KB gzipped); only the
 *   members' global simulator asks for every profile at once.
 * - **Bundled** (prod, or any API failure): `data/country-irradiance.json`
 *   (~10.7 MB, 227 countries x 8760 hours), loaded via a dynamic `import()`
 *   so Vite code-splits it into its own chunk, fetched once and cached in
 *   module scope. Dynamic import rather than `?url` + `fetch()` so it still
 *   resolves inside Vitest, which runs through Vite's own module graph.
 */
export interface CountryIrradiance {
  lat: number;
  lon: number;
  tiltDeg: number;
  azimuthDeg: number;
  profileWPerWp: number[];
}

let bundled: Promise<Record<string, CountryIrradiance>> | null = null;

function loadBundled(): Promise<Record<string, CountryIrradiance>> {
  bundled ??= import("../data/country-irradiance.json").then((mod) => mod.default as Record<string, CountryIrradiance>);
  return bundled;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as T;
}

function apiIndex(): Record<string, IrradianceIndexEntry> | null {
  return readCalculatorData().index;
}

let all: Promise<Record<string, CountryIrradiance>> | null = null;

/** Every country's full profile - only the global simulator needs this. */
export function loadCountryIrradiance(): Promise<Record<string, CountryIrradiance>> {
  if (!all) {
    all = apiIndex()
      ? fetchJson<Record<string, CountryIrradiance>>(`${CALCULATOR_API}/irradiance`).catch((error) => {
          console.warn(`Irradiance: using the bundled JSON (${String(error)})`);
          return loadBundled();
        })
      : loadBundled();
  }
  return all;
}

let index: Promise<Record<string, IrradianceIndexEntry>> | null = null;

/** Every country's point, orientation and annual kWh/kWp, without the hourly profiles. */
export function loadIrradianceIndex(): Promise<Record<string, IrradianceIndexEntry>> {
  if (!index) {
    const fromApi = apiIndex();
    index = fromApi
      ? Promise.resolve(fromApi)
      : loadBundled().then((entries) => {
          const out: Record<string, IrradianceIndexEntry> = {};
          for (const [code, e] of Object.entries(entries)) {
            out[code] = { lat: e.lat, lon: e.lon, tiltDeg: e.tiltDeg, azimuthDeg: e.azimuthDeg, annualKWhPerKWp: annualKWhPerKWp(e) };
          }
          return out;
        });
  }
  return index;
}

const perCountry = new Map<string, Promise<CountryIrradiance>>();

/**
 * The profile a calculation for this place should use: the country's own, or
 * the nearest country's when the code isn't in the dataset (see
 * `nearestCode`). From the API one country at a time when it's in use,
 * falling back to the bundled file if that request fails.
 */
export async function loadCountryEntry(countryCode: string, lat: number, lon: number): Promise<CountryIrradiance> {
  const fromApi = apiIndex();
  if (!fromApi) return findCountryIrradiance(await loadBundled(), countryCode, lat, lon);

  const code = nearestCode(fromApi, countryCode, lat, lon);
  let entry = perCountry.get(code);
  if (!entry) {
    entry = fetchJson<CountryIrradiance>(`${CALCULATOR_API}/irradiance/${encodeURIComponent(code)}`).catch(async (error) => {
      perCountry.delete(code);
      console.warn(`Irradiance for ${code}: using the bundled JSON (${String(error)})`);
      return findCountryIrradiance(await loadBundled(), countryCode, lat, lon);
    });
    perCountry.set(code, entry);
  }
  return entry;
}

/**
 * `countryCode` should match a jurisdictions.geojson code for almost every
 * real ISO 3166-1 country, but not guaranteed (a few edge-case territories
 * code differently between whatever's calling this and the dataset's own
 * keys) - falling back to the nearest country by straight-line lat/lon
 * distance keeps this always returning *something* plausible rather than
 * throwing.
 */
export function nearestCode(entries: Record<string, { lat: number; lon: number }>, countryCode: string, lat: number, lon: number): string {
  const upper = countryCode.toUpperCase();
  if (entries[upper]) return upper;
  let nearest = "";
  let nearestDist = Infinity;
  for (const [code, entry] of Object.entries(entries)) {
    const dist = (entry.lat - lat) ** 2 + (entry.lon - lon) ** 2;
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = code;
    }
  }
  return nearest;
}

export function findCountryIrradiance(
  countryIrradiance: Record<string, CountryIrradiance>,
  countryCode: string,
  lat: number,
  lon: number,
): CountryIrradiance {
  return countryIrradiance[nearestCode(countryIrradiance, countryCode, lat, lon)];
}

/** Summing a whole year of W/Wp values directly gives kWh/kWp (each hour's value is that hour's average output fraction, i.e. already "kWh that hour, per kWp installed"). */
export function annualKWhPerKWp(entry: CountryIrradiance): number {
  return entry.profileWPerWp.reduce((sum, v) => sum + v, 0);
}
