import type { FeatureCollection } from "geojson";
import { describe, expect, it } from "vitest";

import { boundsOfCodes, boundsOfSubregions, regionFrameWindow } from "./mapBounds";

/** A polygon given as a ring of [lng, lat] points. */
const feature = (code: string, ring: [number, number][]) => ({
  type: "Feature" as const,
  properties: { code },
  geometry: { type: "Polygon" as const, coordinates: [ring] },
});

// A "Russia" that runs from Murmansk-ish longitudes to past the antimeridian, a "Poland", and a "New Zealand" whose
// Chatham Islands sit at -176.
const world: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    feature("RU", [[30, 45], [30, 69], [100, 75], [172, 65], [-170, 66], [-170, 64], [100, 50], [44, 41]]),
    feature("PL", [[14, 49], [14, 54], [24, 54], [24, 49]]),
    feature("NZ", [[166, -47], [178, -34], [-176, -44]]),
  ],
};

const bySubregion: Record<string, string> = { RU: "Eastern Europe", PL: "Eastern Europe", NZ: "Australia and New Zealand" };
const subregionOf = (code: string) => bySubregion[code] ?? null;

describe("mapBounds", () => {
  it("frames a region by its features, safely across the antimeridian", () => {
    const nz = boundsOfCodes(world, ["NZ"])!;
    // Not the whole planet: the shifted box (166 to 184) is tighter than the plain one (-176 to 178).
    expect(nz[1][0] - nz[0][0]).toBeLessThan(30);
  });

  it("stops Eastern Europe at Volgograd's longitude, so Russia's far east is not framed", () => {
    expect(regionFrameWindow(["Eastern Europe"])?.lng).toEqual([-10, 44.5]);
    const frame = boundsOfSubregions(world, ["Eastern Europe"], subregionOf)!;
    expect(frame[1][0]).toBeLessThanOrEqual(44.5); // east edge
    expect(frame[0][0]).toBeGreaterThanOrEqual(14); // west edge: Poland, not Chukotka at -170
    // Without the window the same region would stretch right across the map.
    const unclipped = boundsOfCodes(world, ["RU", "PL"])!;
    expect(unclipped[1][0] - unclipped[0][0]).toBeGreaterThan(100);
  });

  it("also stops Eastern Europe at 57 degrees north, so Russia's Arctic does not make the frame tall", () => {
    const frame = boundsOfSubregions(world, ["Eastern Europe"], subregionOf)!;
    expect(frame[1][1]).toBeLessThanOrEqual(57); // north edge
    expect(frame[0][1]).toBeGreaterThanOrEqual(40); // south edge
  });

  it("only applies a window to a single chosen region that has one", () => {
    expect(regionFrameWindow([])).toBeUndefined();
    expect(regionFrameWindow(["Eastern Europe", "Western Europe"])).toBeUndefined();
    expect(regionFrameWindow(["Western Europe"])).toBeUndefined();
  });

  it("returns null when nothing is chosen or nothing matches", () => {
    expect(boundsOfSubregions(world, [], subregionOf)).toBeNull();
    expect(boundsOfSubregions(world, ["Caribbean"], subregionOf)).toBeNull();
  });
});
