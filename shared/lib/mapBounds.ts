import type { FeatureCollection } from "geojson";

export type Bounds = [[number, number], [number, number]];

/** Only points inside this window count towards a frame: longitude [west, east] and, optionally, latitude [south, north]. */
export interface FrameWindow {
  lng: [number, number];
  lat?: [number, number];
}

/**
 * Some UN sub-regions contain a country so big that framing the whole region shows half the planet: Eastern Europe
 * includes Russia, which runs to the Pacific and up to the Arctic. For those, only the part of the map inside this
 * window is framed. Eastern Europe stops at Volgograd's longitude (about 44.5 degrees east) and at 57 degrees north,
 * so the frame is Poland and the Czech Republic to the Black Sea and Moscow, not Siberia, Murmansk or the western
 * seaboard. (The northern limit matters as much as the eastern one: Russia's far north makes the frame tall, and a tall
 * frame on a wide screen shows a lot of the west.) Applied when exactly one such region is chosen.
 */
const REGION_FRAME_WINDOW: Record<string, FrameWindow> = {
  "Eastern Europe": { lng: [-10, 44.5], lat: [40, 57] },
};

/** The frame window for the chosen region(s), if it has one (see `REGION_FRAME_WINDOW`). */
export function regionFrameWindow(subregions: readonly string[]): FrameWindow | undefined {
  return subregions.length === 1 ? REGION_FRAME_WINDOW[subregions[0]] : undefined;
}

/**
 * Bounding box of every feature whose `code` property is in `codes`, safe for territories that straddle the
 * antimeridian (New Zealand's Chathams, Alaska's Aleutians, Fiji, Russia): the longitude span is measured twice - once
 * on [-180, 180] and once with negative longitudes shifted into [0, 360) - and the tighter one is kept. MapLibre accepts
 * longitudes past 180 and wraps them, so the shifted box can be handed straight to `fitBounds`. The same logic as
 * Deployment's own `boundsOf`, shared so every app frames a region the same way.
 */
export function boundsOfCodes(
  data: FeatureCollection,
  codes: Iterable<string>,
  /** Only points inside this window count towards the frame - see `regionFrameWindow`. */
  window?: FrameWindow,
): Bounds | null {
  const codeSet = new Set(codes);
  const lngs: number[] = [];
  let minLat = Infinity;
  let maxLat = -Infinity;

  const visit = (coords: unknown): void => {
    if (!Array.isArray(coords)) return;
    if (typeof coords[0] === "number" && typeof coords[1] === "number") {
      const [lng, lat] = coords as [number, number];
      if (window && (lng < window.lng[0] || lng > window.lng[1])) return;
      if (window?.lat && (lat < window.lat[0] || lat > window.lat[1])) return;
      lngs.push(lng);
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      return;
    }
    for (const part of coords) visit(part);
  };

  for (const feature of data.features) {
    if (!codeSet.has(feature.properties?.code)) continue;
    if (feature.geometry && "coordinates" in feature.geometry) visit(feature.geometry.coordinates);
  }

  if (lngs.length === 0) return null;

  const plain = { min: Math.min(...lngs), max: Math.max(...lngs) };
  const shiftedLngs = lngs.map((lng) => (lng < 0 ? lng + 360 : lng));
  const shifted = { min: Math.min(...shiftedLngs), max: Math.max(...shiftedLngs) };
  const best = shifted.max - shifted.min < plain.max - plain.min ? shifted : plain;
  return [
    [best.min, minLat],
    [best.max, maxLat],
  ];
}

/**
 * The frame for a selected UN sub-region (or sub-regions): the union of every map feature that sits in one, according to
 * `subregionOf`. Null when nothing is selected or nothing on the map matches, so the caller falls back to the world.
 */
export function boundsOfSubregions(
  data: FeatureCollection,
  subregions: readonly string[],
  subregionOf: (code: string) => string | null,
): Bounds | null {
  if (subregions.length === 0) return null;
  const codes = new Set<string>();
  for (const feature of data.features) {
    const code = feature.properties?.code;
    if (typeof code !== "string") continue;
    const subregion = subregionOf(code);
    if (subregion !== null && subregions.includes(subregion)) codes.add(code);
  }
  return boundsOfCodes(data, codes, regionFrameWindow(subregions));
}
