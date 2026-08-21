import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { FeatureCollection } from "geojson";

import { boundsOf } from "./PolicyMap";

// Read from the repo root rather than import.meta.url: the jsdom environment
// resolves module URLs to http, which readFileSync will not accept.
const world = JSON.parse(
  readFileSync(resolve(process.cwd(), "src/assets/jurisdictions.geojson"), "utf8"),
) as FeatureCollection;

/** Longitude span of a bounding box, in degrees. */
function span(code: string): number {
  const b = boundsOf(world, code);
  if (!b) throw new Error(`no geometry for ${code}`);
  return b[1][0] - b[0][0];
}

describe("boundsOf", () => {
  it("frames a country that does not cross the antimeridian", () => {
    // France's mainland is roughly 10 degrees wide.
    expect(span("DE")).toBeLessThan(20);
  });

  it("frames New Zealand tightly despite the Chathams crossing 180", () => {
    // The bug: a plain min/max gave ~354 degrees and framed the whole planet,
    // because the Chatham Islands are stored at about -176.
    const s = span("NZ");
    expect(s).toBeLessThan(30);
    expect(s).toBeGreaterThan(0);
  });

  it("frames Fiji, which straddles the antimeridian outright", () => {
    expect(span("FJ")).toBeLessThan(30);
  });

  it("frames Alaska, the US state that crosses 180", () => {
    expect(span("US-AK")).toBeLessThan(90);
  });

  it("returns null for a code with no geometry", () => {
    // Subdivided countries have no shape of their own.
    expect(boundsOf(world, "AU")).toBeNull();
    expect(boundsOf(world, "NOT-A-CODE")).toBeNull();
  });

  it("keeps latitudes in range for a crossing territory", () => {
    const b = boundsOf(world, "NZ")!;
    expect(b[0][1]).toBeGreaterThan(-60);
    expect(b[1][1]).toBeLessThan(0);
  });
});
