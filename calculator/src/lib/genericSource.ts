import { findCountryIrradiance, loadCountryIrradiance } from "./countryIrradiance";
import type { HourlyProfile, PanelArray } from "./types";

/**
 * Dummy per-country 8760 generation source - built by
 * scripts/build_country_irradiance.py (see that script's own docstring for
 * the full method) from each country's own `representative_point()` on its
 * jurisdictions.geojson shape, per Andrew's own instruction 2026-09-16.
 * `country-irradiance.json` (loaded/looked-up via lib/countryIrradiance.ts,
 * shared with WorldMap.tsx's own choropleth) stores W/Wp (watts of output
 * per watt-peak installed) at a country-specific fixed orientation - due
 * south in the northern hemisphere, due north in the southern hemisphere,
 * tilt matching the country's own latitude (clamped to 5-35°) - NOT the
 * array's own `tilt`/`azimuth` inputs, which this source doesn't apply yet
 * (see the TODO below). Still explicitly a placeholder (see ROADMAP.md's
 * "Known gaps") - a real per-location dataset (PVGIS's `seriescalc`,
 * confirmed 2026-09-16 to be free/no-key/near-global-coverage, or later
 * `gridsim-database`'s own irradiance data) is the intended eventual
 * replacement, swapped in behind this same `GenerationSource` interface.
 */
export interface GenerationSource {
  getHourlyGenerationKWh(params: { lat: number; lon: number; countryCode: string; array: PanelArray }): Promise<HourlyProfile>;
}

export const genericSource: GenerationSource = {
  async getHourlyGenerationKWh({ lat, lon, countryCode, array }) {
    const countryIrradiance = await loadCountryIrradiance();
    const entry = findCountryIrradiance(countryIrradiance, countryCode, lat, lon);
    // TODO (tracked in ROADMAP.md's "Known gaps flagged in code"): every
    // array in a system shares the same country-level profile regardless
    // of its own `tilt`/`azimuth` - those inputs only affect kWp (via
    // `panels`/`panelWatts`) for this source today, not orientation. A
    // real per-orientation adjustment (like the removed GB path's own
    // tilt/azimuth lookup) can come back once this is backed by a real
    // irradiance dataset with more than one fixed angle per location.
    const wp = array.panels * array.panelWatts;
    return entry.profileWPerWp.map((wPerWp) => (wPerWp * wp) / 1000);
  },
};
