import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Map as MapGL, Source, Layer } from "react-map-gl/maplibre";
import type {
  LayerProps,
  MapLayerMouseEvent,
  MapRef,
  StyleSpecification,
} from "react-map-gl/maplibre";
import { Box, Paper, Typography } from "@mui/material";
import type { FeatureCollection } from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";

import World from "../../assets/jurisdictions.geojson?url";
import mapStyleJson from "../../assets/map_gsc.json";
import { COLOR_INSUFFICIENT, COLOR_NO_DATA, SCORE_RAMP } from "../../lib/scoring";
import { qualifiedName } from "../../lib/jurisdictions";
import FlagImg from "../ui/FlagImg";
import type { CountryScore } from "../../lib/types";
import MapLegend from "./MapLegend";
import JurisdictionSearch from "./JurisdictionSearch";

/** Whole-globe camera: the opening view, and where clearing a selection returns. */
const INITIAL_VIEW = { longitude: 15, latitude: 25, zoom: 1.4 };

interface Props {
  scores: CountryScore[];
  selectedCountry: string | null;
  onCountryClick: (code: string) => void;
}

/**
 * Fill expression driven by feature-state rather than by properties, so that
 * rescoring a country repaints it without touching the 5MB GeoJSON.
 *
 * `score` is only set for countries that clear the completeness threshold;
 * everything else falls through to the grey defaults, which is what keeps a
 * country with three answers from showing up as a confident dark teal.
 */
const FILL_COLOR = [
  "case",
  ["!=", ["feature-state", "score"], null],
  [
    "interpolate",
    ["linear"],
    ["feature-state", "score"],
    ...SCORE_RAMP.flatMap((s) => [s.stop, s.color]),
  ],
  ["==", ["feature-state", "insufficient"], true],
  COLOR_INSUFFICIENT,
  COLOR_NO_DATA,
];

/**
 * Bounding box of every feature sharing a jurisdiction code.
 *
 * Handles territories that straddle the antimeridian. New Zealand is the case
 * that matters here: the Chathams sit just east of 180° and are stored as about
 * -176°, so a plain min/max spans 354° of longitude and frames the whole planet
 * instead of New Zealand. Alaska, Fiji and Russia have the same shape of
 * problem.
 *
 * The fix is to measure the span twice — once on [-180, 180] and once with
 * negative longitudes shifted into [0, 360) — and keep whichever is tighter.
 * MapLibre accepts longitudes past 180 and wraps them, so the shifted box can
 * be handed straight to fitBounds.
 */
export function boundsOf(
  data: FeatureCollection,
  code: string,
): [[number, number], [number, number]] | null {
  const lngs: number[] = [];
  let minLat = Infinity;
  let maxLat = -Infinity;

  const visit = (coords: unknown): void => {
    if (!Array.isArray(coords)) return;
    if (typeof coords[0] === "number" && typeof coords[1] === "number") {
      const [lng, lat] = coords as [number, number];
      lngs.push(lng);
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      return;
    }
    for (const part of coords) visit(part);
  };

  for (const feature of data.features) {
    if (feature.properties?.code !== code) continue;
    if (feature.geometry && "coordinates" in feature.geometry) {
      visit(feature.geometry.coordinates);
    }
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

export default function PolicyMap({ scores, selectedCountry, onCountryClick }: Props) {
  const mapRef = useRef<MapRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [worldData, setWorldData] = useState<FeatureCollection | null>(null);
  const [sourceReady, setSourceReady] = useState(false);
  const [hover, setHover] = useState<{ code: string; x: number; y: number } | null>(null);

  const mapStyle = useMemo(() => {
    const style = structuredClone(mapStyleJson) as unknown as StyleSpecification;
    const key = import.meta.env.VITE_MAPTILER_KEY;
    const source = (style.sources as Record<string, { url?: string }>)?.maptiler_planet_v4;
    if (source?.url) source.url = source.url.replace("placeholder", key);
    if (style.glyphs) style.glyphs = style.glyphs.replace("placeholder", key);
    return style;
  }, []);

  useEffect(() => {
    let mounted = true;
    fetch(World)
      .then((r) => r.json())
      .then((data) => mounted && setWorldData(data))
      .catch((err) => console.error("failed to load world geometry", err));
    return () => {
      mounted = false;
    };
  }, []);

  const scoreByCode = useMemo(() => new Map(scores.map((s) => [s.code, s])), [scores]);

  // Push scores into feature state. Every feature carries a unique `code`,
  // either an ISO 3166-1 country or an ISO 3166-2 subnational jurisdiction, and
  // a country that has been subdivided has no whole-country shape of its own.
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !sourceReady) return;

    for (const s of scores) {
      map.setFeatureState(
        { source: "countries", id: s.code },
        s.ranked
          ? { score: s.score, insufficient: false }
          : { score: null, insufficient: s.answered > 0 },
      );
    }
  }, [scores, sourceReady]);

  const handleSourceData = useCallback((e: { sourceId?: string; isSourceLoaded?: boolean }) => {
    if (e.sourceId === "countries" && e.isSourceLoaded) setSourceReady(true);
  }, []);

  // The panel is a flex sibling rather than an overlay, so opening it shrinks
  // the map's container. MapLibre sizes its canvas from the container, and will
  // keep rendering at the old width until told otherwise.
  useEffect(() => {
    const container = containerRef.current;
    const map = mapRef.current?.getMap();
    if (!container || !map) return;

    const observer = new ResizeObserver(() => map.resize());
    observer.observe(container);
    return () => observer.disconnect();
  }, [worldData]);

  // Frame the selected jurisdiction, or return to the whole globe when the
  // selection is cleared. Both run after an explicit resize, so the camera is
  // computed against the width the map actually ends up with rather than the
  // width it had before the panel opened or closed.
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !worldData) return;

    const bounds = selectedCountry ? boundsOf(worldData, selectedCountry) : null;

    const frame = requestAnimationFrame(() => {
      map.resize();

      if (bounds) {
        map.fitBounds(bounds, {
          padding: 48,
          // Small jurisdictions would otherwise fill the screen with one state
          // and no surrounding context.
          maxZoom: 6,
          duration: 900,
        });
      } else {
        map.easeTo({ ...INITIAL_VIEW, duration: 900 });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedCountry, worldData]);

  const handleClick = useCallback(
    (event: MapLayerMouseEvent) => {
      const code = event.features?.[0]?.properties?.code;
      if (code) onCountryClick(code as string);
    },
    [onCountryClick],
  );

  const handleMouseMove = useCallback((event: MapLayerMouseEvent) => {
    const code = event.features?.[0]?.properties?.code;
    if (code) {
      setHover({ code: code as string, x: event.point.x, y: event.point.y });
    } else {
      setHover(null);
    }
  }, []);

  const fillLayer: LayerProps = {
    id: "country-fill",
    type: "fill",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    paint: { "fill-color": FILL_COLOR as any, "fill-opacity": 0.85 },
  };

  const lineLayer: LayerProps = {
    id: "country-line",
    type: "line",
    paint: { "line-color": "#FFFFFF", "line-width": 0.5 },
  };

  const selectedLayer: LayerProps = {
    id: "country-selected",
    type: "line",
    filter: ["==", ["get", "code"], selectedCountry ?? " "],
    paint: { "line-color": "#3B3838", "line-width": 2 },
  };

  const hovered = hover ? scoreByCode.get(hover.code) : null;

  return (
    <Box ref={containerRef} sx={{ position: "relative", width: "100%", height: "100%" }}>
      <MapGL
        ref={mapRef}
        mapStyle={mapStyle}
        initialViewState={INITIAL_VIEW}
        style={{ width: "100%", height: "100%" }}
        interactiveLayerIds={worldData ? ["country-fill"] : []}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseOut={() => setHover(null)}
        onSourceData={handleSourceData}
        cursor={hover ? "pointer" : "grab"}
      >
        {worldData && (
          <Source id="countries" type="geojson" data={worldData} promoteId="code">
            <Layer {...fillLayer} />
            <Layer {...lineLayer} />
            <Layer {...selectedLayer} />
          </Source>
        )}
      </MapGL>

      {hover && (
        <Paper
          elevation={4}
          sx={{
            position: "absolute",
            left: hover.x + 12,
            top: hover.y + 12,
            px: 1.5,
            py: 1,
            pointerEvents: "none",
            minWidth: 160,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <FlagImg code={hover.code} />
            <Typography variant="subtitle1">{qualifiedName(hover.code)}</Typography>
          </Box>
          {hovered && hovered.answered > 0 ? (
            <>
              <Typography variant="h4">
                {hovered.ranked ? `${Math.round(hovered.score * 100)}%` : "—"}
              </Typography>
              <Typography variant="caption">
                {hovered.answered}/{hovered.total} answered
                {hovered.ranked ? "" : " · below threshold"}
              </Typography>
            </>
          ) : (
            <Typography variant="caption">No data yet — click to start</Typography>
          )}
        </Paper>
      )}

      <JurisdictionSearch
        scores={scores}
        selected={selectedCountry}
        onSelect={onCountryClick}
      />

      <MapLegend />
    </Box>
  );
}
