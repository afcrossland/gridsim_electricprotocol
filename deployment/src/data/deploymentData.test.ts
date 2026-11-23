import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import solarJson from "./ember_solar.json";

/** A fresh copy of the module each time - it holds load state. */
async function freshModule() {
  vi.resetModules();
  return import("./deploymentData");
}

function respond(body: unknown, status = 200): typeof fetch {
  return vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
}

const dataset = (name: string) => ({ source: "test", fetchedAt: "2026-01-01", note: "", countries: { XX: { name } } });
const apiData = { solar: dataset("From the DB"), generation: dataset("g"), population: dataset("p") };

beforeEach(() => vi.spyOn(console, "warn").mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

describe("deploymentData", () => {
  it("refuses to be read before it is loaded", async () => {
    const m = await freshModule();
    expect(() => m.readDeploymentData()).toThrow(/before loadDeploymentData/);
  });

  it("loads the bundled JSON without the API flag, and never fetches", async () => {
    const m = await freshModule();
    const fetchImpl = respond(apiData);
    expect(await m.loadDeploymentData({ useApi: false, fetchImpl })).toBe("bundled");
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(m.readDeploymentData().solar.countries).toEqual(solarJson.countries);
  });

  it("uses the API's data when it answers with the right shape", async () => {
    const m = await freshModule();
    expect(await m.loadDeploymentData({ useApi: true, fetchImpl: respond(apiData) })).toBe("api");
    expect(m.deploymentDataSource()).toBe("api");
    expect(m.readDeploymentData().solar.countries).toEqual({ XX: { name: "From the DB" } });
  });

  it.each([
    ["an error status", respond({ error: "x" }, 503)],
    ["a wrong shape", respond({ solar: dataset("s") })],
    ["empty countries", respond({ ...apiData, population: { ...dataset("p"), countries: {} } })],
    ["a network failure", vi.fn(async () => Promise.reject(new TypeError("offline"))) as unknown as typeof fetch],
  ])("falls back to the bundled JSON on %s", async (_label, fetchImpl) => {
    const m = await freshModule();
    expect(await m.loadDeploymentData({ useApi: true, fetchImpl })).toBe("bundled");
    expect(m.readDeploymentData().solar.countries).toEqual(solarJson.countries);
  });

  it("loads once", async () => {
    const m = await freshModule();
    const fetchImpl = respond(apiData);
    await Promise.all([m.loadDeploymentData({ useApi: true, fetchImpl }), m.loadDeploymentData({ useApi: true, fetchImpl })]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
