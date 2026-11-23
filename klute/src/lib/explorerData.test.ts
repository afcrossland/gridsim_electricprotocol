import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import solarJson from "../../../deployment/src/data/ember_solar.json";
import selfJson from "../../../calculator/src/data/country-self-sufficiency.json";
import { loadCalculatorPart, loadDeploymentPart } from "./explorerData";


function respond(body: unknown, status = 200): typeof fetch {
  return vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
}

beforeEach(() => vi.spyOn(console, "warn").mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

describe("/klute explorer data", () => {
  it("reads the deployment data from the database endpoint", async () => {
    const ds = (name: string) => ({ fetchedAt: "2026-11-23T00:00:00", countries: { XX: { name, series: [] } } });
    const part = await loadDeploymentPart(respond({ solar: ds("s"), generation: ds("g"), population: ds("p") }));
    expect(part.source).toBe("database");
    expect(part.solar.XX.name).toBe("s");
    expect(part.solarFetchedAt).toBe("2026-11-23T00:00:00");
  });

  it("falls back to the bundled deployment JSON", async () => {
    const part = await loadDeploymentPart(respond({ error: "x" }, 503));
    expect(part.source).toBe("bundled");
    expect(Object.keys(part.solar)).toEqual(Object.keys(solarJson.countries));
  });

  it("reads the calculator summary, without any profiles", async () => {
    const part = await loadCalculatorPart(
      respond({ index: { XX: { lat: 1, lon: 2, tiltDeg: 3, azimuthDeg: 0, annualKWhPerKWp: 1500 } }, selfSufficiency: { XX: { low: 1, medium: 2, high: 3 } }, pc1DemandProfile: [] }),
    );
    expect(part.source).toBe("database");
    expect(part.irradiance.XX.annualKWhPerKWp).toBe(1500);
  });

  it("falls back to the bundled calculator JSON and derives the annual yield", async () => {
    const part = await loadCalculatorPart(respond({}, 502));
    expect(part.source).toBe("bundled");
    expect(part.selfSufficiency).toEqual(selfJson);
    expect(Object.keys(part.irradiance)).toHaveLength(Object.keys(selfJson).length);
    expect(Object.values(part.irradiance).every((e) => e.annualKWhPerKWp > 0)).toBe(true);
  });
});
