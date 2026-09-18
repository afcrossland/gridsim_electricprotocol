import { describe, expect, it } from "vitest";

import { genericSource } from "./genericSource";
import type { PanelArray } from "./types";

const ARRAY: PanelArray = { panels: 10, panelWatts: 425, tilt: 35, azimuth: 0 };

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
});
