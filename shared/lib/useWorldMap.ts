import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MapRef, StyleSpecification } from "react-map-gl/maplibre";
import type { FeatureCollection } from "geojson";

import { loadMapStyle } from "./mapStyle";

/** The world frame every app's "reset" and clear-selection fit uses (all of it but Antarctica's far south). */
export const WORLD_BOUNDS: [[number, number], [number, number]] = [
  [-170, -58],
  [180, 78],
];

export interface MapHover {
  code: string;
  x: number;
  y: number;
}

/**
 * The plumbing every app's world map needs, written once (Policy, Deployment and the Calculator each had their own
 * identical copy): the map handle, the GeoJSON of the world's shapes, the GSC map style for the current theme, whether the
 * shapes' source has loaded, and the hovered shape. What each map then paints on the shapes, how it frames them and what its
 * hover says stay in the map itself.
 *
 * `transformStyle` (optional) adjusts the style after it is loaded - Policy uses it to hide a few label layers. It must be
 * a stable reference (declared outside the component), or the style is rebuilt on every render.
 */
export function useWorldMap(
  geoUrl: string,
  mode: "light" | "dark",
  transformStyle?: (style: StyleSpecification) => void,
) {
  const mapRef = useRef<MapRef>(null);
  const [worldData, setWorldData] = useState<FeatureCollection | null>(null);
  const [sourceReady, setSourceReady] = useState(false);
  const [hover, setHover] = useState<MapHover | null>(null);

  const mapStyle = useMemo(() => {
    const style = loadMapStyle(mode);
    transformStyle?.(style);
    return style;
  }, [mode, transformStyle]);

  // Switching `mapStyle` (light/dark) makes MapLibre re-style the whole map, which recreates the "countries" GeoJSON
  // source from scratch and wipes every feature-state previously set on it via setFeatureState (bug found 2026-09-11:
  // colours vanished on toggling dark mode). Nothing in a map's colouring effect re-runs on its own when only the theme
  // mode changes, so resetting `sourceReady` here forces it through "not ready" and back to "ready" once `onSourceData`
  // fires again for the freshly-recreated source - that retrigger is what gets the colours re-applied.
  useEffect(() => {
    setSourceReady(false);
  }, [mapStyle]);

  useEffect(() => {
    let mounted = true;
    fetch(geoUrl)
      .then((r) => r.json())
      .then((data) => mounted && setWorldData(data))
      .catch((err) => console.error("failed to load world geometry", err));
    return () => {
      mounted = false;
    };
  }, [geoUrl]);

  /** Pass to the map's `onSourceData`. */
  const onSourceData = useCallback((e: { sourceId?: string; isSourceLoaded?: boolean }) => {
    if (e.sourceId === "countries" && e.isSourceLoaded) setSourceReady(true);
  }, []);

  return { mapRef, worldData, mapStyle, sourceReady, onSourceData, hover, setHover };
}
