import { useEffect, useMemo, useRef, useState } from "react";
import { Map as MapGL, Source, Layer } from "react-map-gl/maplibre";
import type { LayerProps, MapLayerMouseEvent, MapRef, StyleSpecification } from "react-map-gl/maplibre";
import { Box, IconButton, Typography, useMediaQuery, useTheme } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import ZoomOutMapIcon from "@mui/icons-material/ZoomOutMap";
import type { FeatureCollection } from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";

import World from "../assets/jurisdictions.geojson?url";
import mapStyleJsonLight from "../assets/map_gsc.json";
import mapStyleJsonDark from "../assets/map_gsc_dark.json";
import MapLegend from "./MapLegend";
import TotalCapacityTile from "./TotalCapacityTile";
import { canonicalCode, jurisdictionName, resolveTargets } from "../lib/jurisdictions";
import {
  COLOR_NO_DATA,
  METRIC_LABELS,
  RAMP_STOPS,
  codesForMetric,
  domainForMetric,
  valueForMap,
  type Metric,
} from "../lib/metrics";

const INITIAL_VIEW = { longitude: 10, latitude: 20, zoom: 1.4 };
const WORLD_BOUNDS: [[number, number], [number, number]] = [
  [-170, -58],
  [180, 78],
];

/**
 * Bounding box of a country's feature(s) - trimmed from
 * ep_policymap/src/components/map/PolicyMap.tsx's boundsOf. That version
 * also handles antimeridian-straddling territories (NZ's Chathams, Alaska,
 * Fiji, Russia); this app is a demo over ~40 placeholder countries, none of
 * which hit that case, so the simpler plain min/max is enough for now - see
 * the original if this ever needs the same antimeridian handling.
 *
 * Takes the already-`resolveTargets`-expanded code list, not a single code -
 * a subdivided country (Australia, the US, Canada) has no feature of its
 * own, only its states/provinces, so framing "AU" means framing the union of
 * every AU-* feature instead.
 */
function boundsOf(data: FeatureCollection, codes: string[]): [[number, number], [number, number]] | null {
  const codeSet = new Set(codes);
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
    if (!codeSet.has(feature.properties?.code)) continue;
    if (feature.geometry && "coordinates" in feature.geometry) visit(feature.geometry.coordinates);
  }

  if (lngs.length === 0) return null;
  return [
    [Math.min(...lngs), minLat],
    [Math.max(...lngs), maxLat],
  ];
}

// MapLibre expression, not a plain value - react-map-gl's LayerProps types
// don't model expressions precisely, same reasoning as the policy tool's
// own PolicyMap.tsx casting its equivalent FILL_COLOR.
const FILL_COLOR = [
  "case",
  ["!=", ["feature-state", "norm"], null],
  ["interpolate", ["linear"], ["feature-state", "norm"], ...RAMP_STOPS.flatMap((s) => [s.stop, s.color])],
  COLOR_NO_DATA,
];

const fillLayer: LayerProps = {
  id: "deployment-fill",
  type: "fill",
  paint: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    "fill-color": FILL_COLOR as any,
    "fill-opacity": 0.88,
    "fill-outline-color": "rgba(255,255,255,0.35)",
  },
};

const lineLayer: LayerProps = {
  id: "deployment-line",
  type: "line",
  paint: { "line-color": "#fff", "line-width": 1.25 },
};

interface Props {
  metric: Metric;
  selectedCountry: string | null;
  onCountryClick: (code: string | null) => void;
}

export default function DeploymentMap({ metric, selectedCountry, onCountryClick }: Props) {
  const mapRef = useRef<MapRef>(null);
  const [worldData, setWorldData] = useState<FeatureCollection | null>(null);
  const [sourceReady, setSourceReady] = useState(false);
  const [hover, setHover] = useState<{ code: string; x: number; y: number } | null>(null);

  const selectedLayer: LayerProps = {
    id: "deployment-selected",
    type: "line",
    // "in" a resolved list, not "==" one code - a subdivided selection
    // (Australia, the US, Canada) highlights every one of its state
    // features, not a single "AU"/"US"/"CA" feature that doesn't exist.
    filter: ["in", ["get", "code"], ["literal", selectedCountry ? resolveTargets(selectedCountry) : []]],
    paint: { "line-color": "#ffffff", "line-width": 2 },
  };

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const mapStyle = useMemo(() => {
    const base = theme.palette.mode === "dark" ? mapStyleJsonDark : mapStyleJsonLight;
    const style = structuredClone(base) as { sources: Record<string, { url?: string }>; glyphs?: string };
    const key = import.meta.env.VITE_MAPTILER_KEY;
    const source = style.sources?.maptiler_planet_v4;
    if (source?.url) source.url = source.url.replace("placeholder", key);
    if (style.glyphs) style.glyphs = style.glyphs.replace("placeholder", key);
    return style as unknown as StyleSpecification;
  }, [theme.palette.mode]);

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

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !sourceReady || !worldData) return;

    const [min, max] = domainForMetric(metric);
    // Log scale for every metric - installed capacity, per-capita capacity
    // and solar's own share of generation all span several orders of
    // magnitude (a handful of countries near 0%, a few past 20%), and a
    // linear 0-1 normalisation would paint almost everything at the bottom
    // of the ramp either way.
    const norm = (v: number) => {
      const logMin = Math.log10(min || 1);
      const logMax = Math.log10(max || 1);
      const logSpan = logMax - logMin || 1;
      return Math.min(1, Math.max(0, (Math.log10(Math.max(v, min || 1)) - logMin) / logSpan));
    };

    // Clear every feature first - otherwise a subdivided country's states
    // would keep a stale value from a previous metric once nothing in the
    // current one resolves to them.
    for (const f of worldData.features) {
      const code = f.properties?.code;
      if (typeof code === "string") map.setFeatureState({ source: "countries", id: code }, { norm: null });
    }

    // Driven by the active metric's own code list, not the geojson's
    // feature codes - a subdivided country (Australia, the US, Canada) has
    // no feature of its own, so its value has to be pushed onto every one
    // of its states/provinces via resolveTargets instead of set on a
    // nonexistent "AU"/"US"/"CA" feature.
    for (const code of codesForMetric(metric)) {
      const value = valueForMap(code, metric);
      const normValue = value === null ? null : norm(value);
      for (const target of resolveTargets(code)) {
        map.setFeatureState({ source: "countries", id: target }, { norm: normValue });
      }
    }
  }, [metric, sourceReady, worldData]);

  // Frame the selected country, or zoom back out to the whole world once a
  // selection is cleared - same behaviour as the policy tool's own map.
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !worldData) return;
    if (!selectedCountry) {
      map.fitBounds(WORLD_BOUNDS, { padding: 24, duration: 600 });
      return;
    }
    const bounds = boundsOf(worldData, resolveTargets(selectedCountry));
    if (bounds) map.fitBounds(bounds, { padding: 80, duration: 600, maxZoom: 5 });
  }, [selectedCountry, worldData]);

  const handleMouseMove = (event: MapLayerMouseEvent) => {
    const feature = event.features?.[0];
    const code = feature?.properties?.code;
    if (code) setHover({ code: canonicalCode(code as string), x: event.point.x, y: event.point.y });
    else setHover(null);
  };

  const handleClick = (event: MapLayerMouseEvent) => {
    const code = event.features?.[0]?.properties?.code;
    if (code) onCountryClick(canonicalCode(code as string));
  };

  const hoveredValue = hover ? valueForMap(hover.code, metric) : null;
  const hoveredName = hover ? jurisdictionName(hover.code) : undefined;
  const legendTitle = METRIC_LABELS[metric];

  return (
    <Box sx={{ position: "relative", width: "100%", height: "100%" }}>
      <MapGL
        ref={mapRef}
        mapStyle={mapStyle}
        initialViewState={INITIAL_VIEW}
        style={{ width: "100%", height: "100%" }}
        interactiveLayerIds={worldData ? ["deployment-fill"] : []}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseOut={() => setHover(null)}
        onSourceData={(e) => {
          if (e.sourceId === "countries" && e.isSourceLoaded) setSourceReady(true);
        }}
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

      <MapLegend title={legendTitle} />
      <TotalCapacityTile />

      {/* Top-right zoom controls, ported verbatim from ep_policymap's own
          PolicyMap.tsx (hand-built IconButtons, not MapLibre's
          NavigationControl) - same top offset trick for the mobile legend
          banner, which spans the full width up here too. */}
      <Box
        sx={{
          position: "absolute",
          top: isMobile ? 64 : 16,
          right: 16,
          zIndex: 10,
          display: "flex",
          flexDirection: "column",
          gap: 0.5,
        }}
      >
        <IconButton
          onClick={() => mapRef.current?.getMap().zoomIn({ duration: 300 })}
          aria-label="Zoom in"
          sx={{
            bgcolor: "background.paper",
            borderRadius: 1,
            boxShadow: 3,
            width: 36,
            height: 36,
            color: "text.secondary",
            "&:hover": { bgcolor: "background.paper", color: "primary.main" },
          }}
        >
          <AddIcon fontSize="small" />
        </IconButton>
        <IconButton
          onClick={() => mapRef.current?.getMap().zoomOut({ duration: 300 })}
          aria-label="Zoom out"
          sx={{
            bgcolor: "background.paper",
            borderRadius: 1,
            boxShadow: 3,
            width: 36,
            height: 36,
            color: "text.secondary",
            "&:hover": { bgcolor: "background.paper", color: "primary.main" },
          }}
        >
          <RemoveIcon fontSize="small" />
        </IconButton>
        <IconButton
          onClick={() => onCountryClick(null)}
          aria-label="Back to full map view"
          sx={{
            bgcolor: "background.paper",
            borderRadius: 1,
            boxShadow: 3,
            width: 36,
            height: 36,
            color: "text.secondary",
            "&:hover": { bgcolor: "background.paper", color: "primary.main" },
          }}
        >
          <ZoomOutMapIcon fontSize="small" />
        </IconButton>
      </Box>

      {hover && hoveredName && (
        <Box
          sx={{
            position: "absolute",
            left: hover.x + 12,
            top: hover.y + 12,
            pointerEvents: "none",
            bgcolor: "background.paper",
            borderRadius: "8px",
            boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
            px: 1.5,
            py: 1,
            minWidth: 140,
          }}
        >
          <Typography sx={{ fontWeight: 700, fontSize: "0.8125rem", color: "text.primary" }}>{hoveredName}</Typography>
          <Typography sx={{ fontSize: "0.75rem", color: "text.secondary" }}>
            {hoveredValue === null
              ? "No data"
              : metric === "share"
                ? `${hoveredValue.toFixed(1)}% of generation`
                : metric === "capacityPerCapita"
                  ? `${hoveredValue.toFixed(0)} W per capita`
                  : `${hoveredValue.toLocaleString()} MW`}
          </Typography>
        </Box>
      )}
    </Box>
  );
}
