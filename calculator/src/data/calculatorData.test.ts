import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import pc1Json from "./pc1-demand-profile.json";
import irradianceJson from "./country-irradiance.json";

async function fresh() {
  vi.resetModules();
  const data = await import("./calculatorData");
  const irradiance = await import("../lib/countryIrradiance");
  return { data, irradiance };
}

const CODE = Object.keys(irradianceJson)[0] as keyof typeof irradianceJson;
const entry = irradianceJson[CODE];
const summary = {
  index: { [CODE]: { lat: entry.lat, lon: entry.lon, tiltDeg: entry.tiltDeg, azimuthDeg: entry.azimuthDeg, annualKWhPerKWp: 1234 } },
  selfSufficiency: { [CODE]: { low: 1, medium: 2, high: 3 } },
  pc1DemandProfile: new Array(8760).fill(1 / 8760),
};

function respond(routes: Record<string, unknown>): typeof fetch {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    return url in routes ? new Response(JSON.stringify(routes[url])) : new Response("{}", { status: 404 });
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("calculatorData", () => {
  it("starts as the bundled JSON", async () => {
    const { data } = await fresh();
    expect(data.readCalculatorData().pc1).toEqual(pc1Json);
    expect(data.readCalculatorData().index).toBeNull();
  });

  it("takes the API's summary and then fetches one country's profile", async () => {
    const { data, irradiance } = await fresh();
    const fetchImpl = respond({ "/api/calculator/summary": summary, [`/api/calculator/irradiance/${CODE}`]: entry });
    vi.stubGlobal("fetch", fetchImpl);
    expect(await data.loadCalculatorData({ fetchImpl })).toBe("api");
    expect((await irradiance.loadIrradianceIndex())[CODE].annualKWhPerKWp).toBe(1234);
    // An unknown code falls back to the nearest country in the index - here the only one.
    const got = await irradiance.loadCountryEntry("zz", entry.lat, entry.lon);
    expect(got.profileWPerWp).toEqual(entry.profileWPerWp);
    expect(fetchImpl).toHaveBeenCalledWith(`/api/calculator/irradiance/${CODE}`, expect.anything());
  });

  it("falls back to the bundled profile when the per-country request fails", async () => {
    const { data, irradiance } = await fresh();
    const fetchImpl = respond({ "/api/calculator/summary": summary });
    vi.stubGlobal("fetch", fetchImpl);
    await data.loadCalculatorData({ fetchImpl });
    const got = await irradiance.loadCountryEntry(CODE, entry.lat, entry.lon);
    expect(got.profileWPerWp).toEqual(entry.profileWPerWp);
  });

  it.each([
    ["an error status", respond({})],
    ["a short demand profile", respond({ "/api/calculator/summary": { ...summary, pc1DemandProfile: [1] } })],
  ])("keeps the bundled data on %s", async (_label, fetchImpl) => {
    const { data } = await fresh();
    expect(await data.loadCalculatorData({ fetchImpl })).toBe("bundled");
    expect(data.readCalculatorData().index).toBeNull();
  });

  it("refuses a load that finishes after the data was read", async () => {
    const { data } = await fresh();
    data.readCalculatorData();
    expect(await data.loadCalculatorData({ fetchImpl: respond({ "/api/calculator/summary": summary }) })).toBe("bundled");
  });

  it("derives the same annual yield from the bundled file as the API would store", async () => {
    const { irradiance } = await fresh();
    const index = await irradiance.loadIrradianceIndex();
    expect(index[CODE].annualKWhPerKWp).toBe(entry.profileWPerWp.reduce((s, v) => s + v, 0));
  });
});
