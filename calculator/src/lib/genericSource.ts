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

/**
 * The dataset's hourly profiles are in UTC (PVGIS's `seriescalc` returns UTC timestamps, so index 0 is 00:00 UTC on
 * 1 January), but demand is a pattern of people's local day. Left in UTC, solar peaks at the wrong time of day
 * everywhere away from the Greenwich meridian - New Zealand's noon sits at about midnight UTC - and the battery and
 * self-consumption results are wrong with it. This rotates a profile into local solar time: local solar time is UTC
 * plus longitude / 15 hours, rounded to a whole hour because the profile is hourly.
 *
 * Local *solar* time, not the clock on the wall: it ignores legal time zones and daylight saving (a country on one
 * zone, like China or India, or a clock that is an hour ahead of the sun, is off by up to an hour or so). Using each
 * country's real time zone is a known refinement (see ROADMAP.md).
 */
export function toLocalSolarTime(profile: number[], lonDeg: number): number[] {
  const offset = Math.round(lonDeg / 15);
  const n = profile.length;
  return profile.map((_, i) => profile[(((i - offset) % n) + n) % n]);
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
    // The profile is for the country's own representative point, so shift by that point's longitude.
    return toLocalSolarTime(entry.profileWPerWp, entry.lon).map((wPerWp) => (wPerWp * wp) / 1000);
  },
};
