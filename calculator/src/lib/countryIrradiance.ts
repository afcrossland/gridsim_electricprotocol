/**
 * Loader/lookup for `data/country-irradiance.json` - the dummy per-country
 * 8760-hour W/Wp database (see scripts/build_country_irradiance.py and
 * genericSource.ts's own doc comment for the full method/caveats). Split
 * out of genericSource.ts 2026-09-16 so WorldMap.tsx can share the exact
 * same loaded/cached dataset to colour the choropleth by the same figures
 * a calculation would use, rather than duplicating the fetch-and-cache
 * logic in two places.
 *
 * The dataset is ~10MB (234 countries x 8760 hours), so it's loaded via a
 * dynamic `import()` rather than a static top-level one - a plain
 * `import ... from "../data/country-irradiance.json"` bundles the whole
 * thing straight into the app's own JS chunk, bloating the initial parse;
 * Vite code-splits a dynamic import into its own chunk instead, fetched
 * (and cached in module scope, shared across every caller) only once
 * something actually needs it. Dynamic import rather than `?url` +
 * `fetch()` (WorldMap.tsx's own pattern for jurisdictions.geojson)
 * specifically so this still resolves inside Vitest too, which runs
 * through Vite's own module graph rather than a real browser fetch.
 */
export interface CountryIrradiance {
  lat: number;
  lon: number;
  tiltDeg: number;
  azimuthDeg: number;
  profileWPerWp: number[];
}

let cache: Promise<Record<string, CountryIrradiance>> | null = null;

export function loadCountryIrradiance(): Promise<Record<string, CountryIrradiance>> {
  if (!cache) {
    cache = import("../data/country-irradiance.json").then(
      (mod) => mod.default as Record<string, CountryIrradiance>,
    );
  }
  return cache;
}

/**
 * `countryCode` should match a jurisdictions.geojson code for almost every
 * real ISO 3166-1 country, but not guaranteed (a few edge-case territories
 * code differently between whatever's calling this and the dataset's own
 * keys) - falling back to the nearest country by straight-line lat/lon
 * distance keeps this always returning *something* plausible rather than
 * throwing, appropriate for a dummy dataset.
 */
export function findCountryIrradiance(
  countryIrradiance: Record<string, CountryIrradiance>,
  countryCode: string,
  lat: number,
  lon: number,
): CountryIrradiance {
  const exact = countryIrradiance[countryCode.toUpperCase()];
  if (exact) return exact;

  const entries = Object.values(countryIrradiance);
  let nearest = entries[0];
  let nearestDist = Infinity;
  for (const entry of entries) {
    const dist = (entry.lat - lat) ** 2 + (entry.lon - lon) ** 2;
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = entry;
    }
  }
  return nearest;
}

/** Summing a whole year of W/Wp values directly gives kWh/kWp (each hour's value is that hour's average output fraction, i.e. already "kWh that hour, per kWp installed"). */
export function annualKWhPerKWp(entry: CountryIrradiance): number {
  return entry.profileWPerWp.reduce((sum, v) => sum + v, 0);
}
