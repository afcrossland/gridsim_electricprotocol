import { describe, expect, it, vi } from "vitest";

import { genericSource, toLocalSolarTime } from "./genericSource";
import type { PanelArray } from "./types";

const ARRAY: PanelArray = { panels: 10, panelWatts: 425, tilt: 35, azimuth: 0 };

// The first call loads the ~10 MB irradiance dataset, which can take longer than vitest's default 5 s when the whole
// suite runs in parallel (it passes alone) - so a slow machine or CI runner does not fail the deploy.
vi.setConfig({ testTimeout: 20_000 });

describe("genericSource", () => {
  it("returns a full 8760-hour profile", async () => {
    const profile = await genericSource.getHourlyGenerationKWh({
      lat: 40.4,
      lon: -3.7,
      countryCode: "es",
      array: ARRAY,
    });
    expect(profile).toHaveLength(8760);
  });

  it("scales linearly with installed Wp", async () => {
    const base = await genericSource.getHourlyGenerationKWh({
      lat: 40.4,
      lon: -3.7,
      countryCode: "es",
      array: ARRAY,
    });
    const doublePanels = await genericSource.getHourlyGenerationKWh({
      lat: 40.4,
      lon: -3.7,
      countryCode: "es",
      array: { ...ARRAY, panels: ARRAY.panels * 2 },
    });
    const baseTotal = base.reduce((sum, v) => sum + v, 0);
    const doubleTotal = doublePanels.reduce((sum, v) => sum + v, 0);
    expect(doubleTotal).toBeCloseTo(baseTotal * 2, 3);
  });

  it("gives more annual generation to a low-latitude country than a high-latitude one", async () => {
    const equatorial = await genericSource.getHourlyGenerationKWh({
      lat: -1.8,
      lon: -78.5,
      countryCode: "ec",
      array: ARRAY,
    });
    const nordic = await genericSource.getHourlyGenerationKWh({
      lat: 64.5,
      lon: 11.0,
      countryCode: "no",
      array: ARRAY,
    });
    const equatorialTotal = equatorial.reduce((sum, v) => sum + v, 0);
    const nordicTotal = nordic.reduce((sum, v) => sum + v, 0);
    expect(equatorialTotal).toBeGreaterThan(nordicTotal);
  });

  it("falls back to the nearest country when the code isn't in the dataset", async () => {
    // "xx" isn't a real country code, but (0, 0) is close to a real entry.
    const profile = await genericSource.getHourlyGenerationKWh({
      lat: 0,
      lon: 0,
      countryCode: "xx",
      array: ARRAY,
    });
    const total = profile.reduce((sum, v) => sum + v, 0);
    expect(total).toBeGreaterThan(0);
  });

  it("is in local solar time: a typical day peaks near noon whatever the country's longitude", async () => {
    const peakHour = async (countryCode: string, lat: number, lon: number) => {
      const profile = await genericSource.getHourlyGenerationKWh({ lat, lon, countryCode, array: ARRAY });
      const byHour = new Array(24).fill(0);
      profile.forEach((v, i) => (byHour[i % 24] += v));
      return byHour.indexOf(Math.max(...byHour));
    };
    // New Zealand is 12-13 hours ahead of UTC: unshifted, its noon fell around 00:00 UTC (the bug this guards).
    for (const [code, lat, lon] of [["nz", -36.8, 174.8], ["gb", 51.5, -0.1], ["us", 40.7, -74], ["jp", 35.7, 139.7]] as const) {
      const hour = await peakHour(code, lat, lon);
      expect(hour, `${code} peaks at ${hour}:00`).toBeGreaterThanOrEqual(11);
      expect(hour, `${code} peaks at ${hour}:00`).toBeLessThanOrEqual(13);
    }
  });
});

describe("toLocalSolarTime", () => {
  it("rotates by longitude / 15 hours, keeps every value, and leaves longitude ~0 alone", () => {
    const day = Array.from({ length: 48 }, (_, i) => i % 24);
    const shifted = toLocalSolarTime(day, 180); // +12 h: local hour i shows UTC hour i - 12
    expect(shifted[12]).toBe(0);
    expect(shifted[0]).toBe(12);
    expect([...shifted].sort((a, b) => a - b)).toEqual([...day].sort((a, b) => a - b));
    expect(toLocalSolarTime(day, 3)).toEqual(day);
    expect(toLocalSolarTime(day, -165)[0]).toBe(11); // -11 h
  });
});
