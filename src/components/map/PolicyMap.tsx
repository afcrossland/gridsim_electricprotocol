import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Map as MapGL, Source, Layer } from "react-map-gl/maplibre";
import type {
  LayerProps,
  MapLayerMouseEvent,
  MapRef,
  StyleSpecification,
} from "react-map-gl/maplibre";
import { Box, IconButton, Paper, Typography, useMediaQuery, useTheme } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import type { FeatureCollection } from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";

import World from "../../assets/jurisdictions.geojson?url";
import mapStyleJsonLight from "../../assets/map_gsc.json";
import mapStyleJsonDark from "../../assets/map_gsc_dark.json";
import { COLOR_INSUFFICIENT, COLOR_NO_DATA, SCORE_RAMP, scoreLabel } from "../../lib/scoring";
import { qualifiedName } from "../../lib/jurisdictions";
import FlagImg from "../ui/FlagImg";
import type { CountryScore } from "../../lib/types";
import MapLegend from "./MapLegend";

/**
 * Whole-globe camera for the very first paint, before the world geometry has
 * loaded and the fitBounds-based reframe below can run. A fixed zoom here is
 * only ever seen briefly - see WORLD_BOUNDS for the one actually used once
 * the map has real content and a real container size to fit against.
 */
const INITIAL_VIEW = { longitude: 0, latitude: 0, zoom: 1.4 };

/**
 * Bounds used to frame the whole world once a selection is cleared. A fixed
 * zoom (what this used to be) assumes a particular container size - fine on a
 * wide desktop panel, but on a short, narrow mobile container the same zoom
 * shows only a narrow longitude slice around 0, which reads as "zoomed in on
 * Africa" rather than a world view. fitBounds recalculates the zoom from
 * whatever the container's actual pixel size is, so it always shows the
 * whole world regardless of the panel's shape.
 */
const WORLD_BOUNDS: [[number, number], [number, number]] = [
  [-170, -58],
  [180, 78],
];

interface Props {
  scores: CountryScore[];
  /** Which measure to paint. Completeness ignores the ranking threshold. */
  metric: "score" | "completeness";
  selectedCountry: string | null;
  onCountryClick: (code: string) => void;
  /** Suppresses the legend even with nothing selected - the tour's opening scene wants an unobstructed view of the choropleth colours themselves, matching the sibling gridsim-frontend project's own clean opening globe. */
  hideLegend?: boolean;
  /** Swaps the choropleth for the "solar bloom" intro animation - see INTRO_* below. */
  introBloom?: boolean;
}

/**
 * Whole-world "solar bloom" for the tour's opening scene, ported from the
 * sibling gridsim-frontend project's `StoryMap`: every country starts
 * transparent and fades up to GSC Citrus yellow over its own randomised
 * delay/duration, so the world lights up unevenly rather than snapping on
 * at once. gridsim biases each country's starting opacity by real carbon-
 * intensity data (cleaner grids start more "lit"); this app has no such
 * per-country dataset to draw on, so the starting opacity is plain random
 * instead - still reads as "random shades of yellow" settling into a solid
 * colour, which is the effect asked for.
 */
const GSC_YELLOW = "#FBB114";
const INTRO_MAX_OPACITY = 0.9;
const INTRO_MIN_DELAY_MS = 0;
const INTRO_MAX_DELAY_MS = 3500;
const INTRO_MIN_DURATION_MS = 8000;
const INTRO_MAX_DURATION_MS = 21000;
const INTRO_MAX_MS = 26000;
/** Push a feature-state update only when opacity moves by this much - fine enough to read as a smooth fade, coarse enough to avoid hundreds of updates every frame. */
const INTRO_UPDATE_STEP = 0.02;
const INTRO_FILL_OPACITY_EXPR = ["coalesce", ["feature-state", "introOp"], 0];

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
 * The fix is to measure the span twice - once on [-180, 180] and once with
 * negative longitudes shifted into [0, 360) - and keep whichever is tighter.
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

export default function PolicyMap({ scores, metric, selectedCountry, onCountryClick, hideLegend, introBloom }: Props) {
  const mapRef = useRef<MapRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [worldData, setWorldData] = useState<FeatureCollection | null>(null);
  const [sourceReady, setSourceReady] = useState(false);
  const [hover, setHover] = useState<{ code: string; x: number; y: number } | null>(null);

  // MapLegend switches to a full-width banner pinned across the top of the
  // map on the same breakpoint. The zoom buttons' own fixed top:16 sits
  // inside that banner's own height, and the buttons' higher z-index (10 vs
  // the banner's 1) lets them paint over its top-right corner, hiding
  // whatever legend content is there. Dropping the buttons below the
  // banner's height avoids the two ever sharing the same strip of the map.
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const showingLegendBanner = isMobile && !selectedCountry && !hideLegend;

  // The base style's own country- and continent-name labels compete with the
  // choropleth and our own hover tooltip for the same information, so they
  // are hidden rather than removed outright - kept in the style array (not
  // deleted) in case anything ever needs to reference them by id via
  // beforeId. Town, city and place labels are left alone; those still earn
  // their place once zoomed into a selected country.
  const HIDDEN_LABEL_LAYERS = new Set([
    "Country labels",
    "Country labels disputed",
    "Continent labels",
  ]);

  const mapStyle = useMemo(() => {
    const base = theme.palette.mode === "dark" ? mapStyleJsonDark : mapStyleJsonLight;
    const style = structuredClone(base) as unknown as StyleSpecification;
    const key = import.meta.env.VITE_MAPTILER_KEY;
    const source = (style.sources as Record<string, { url?: string }>)?.maptiler_planet_v4;
    if (source?.url) source.url = source.url.replace("placeholder", key);
    if (style.glyphs) style.glyphs = style.glyphs.replace("placeholder", key);

    for (const layer of style.layers) {
      if (HIDDEN_LABEL_LAYERS.has(layer.id)) {
        layer.layout = { ...layer.layout, visibility: "none" };
      }
    }

    return style;
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

  const scoreByCode = useMemo(() => new Map(scores.map((s) => [s.code, s])), [scores]);

  // Push scores into feature state. Every feature carries a unique `code`,
  // either an ISO 3166-1 country or an ISO 3166-2 subnational jurisdiction, and
  // a country that has been subdivided has no whole-country shape of its own.
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !sourceReady) return;

    for (const s of scores) {
      // Completeness is its own answer to "how much do we know", so it is shown
      // for anything with data rather than gated behind the ranking threshold -
      // gating it would hide exactly the jurisdictions it exists to reveal.
      const value =
        metric === "completeness"
          ? s.answered > 0
            ? s.completeness
            : null
          : s.ranked
            ? s.score
            : null;

      map.setFeatureState(
        { source: "countries", id: s.code },
        { score: value, insufficient: value === null && s.answered > 0 },
      );
    }
  }, [scores, sourceReady, metric]);

  // The "solar bloom" intro animation - see the doc comment on the INTRO_*
  // constants above. Runs once per mount of the intro scene (worldData and
  // sourceReady don't change mid-run in practice) and cleans up its own
  // rAF loop if introBloom turns off before it finishes.
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !sourceReady || !introBloom || !worldData) return;

    const codes = new Set<string>();
    for (const f of worldData.features) {
      const code = f.properties?.code;
      if (typeof code === "string") codes.add(code);
    }

    const rnd = (min: number, max: number) => min + Math.random() * (max - min);
    const blooms = [...codes].map((code) => {
      const delay = rnd(INTRO_MIN_DELAY_MS, INTRO_MAX_DELAY_MS);
      const duration = Math.min(rnd(INTRO_MIN_DURATION_MS, INTRO_MAX_DURATION_MS), INTRO_MAX_MS - delay);
      const startOp = rnd(0, INTRO_MAX_OPACITY);
      return { code, delay, duration, startOp };
    });

    const lastBucket: Record<string, number> = {};
    const bucketOf = (v: number) => Math.round(v / INTRO_UPDATE_STEP);
    const setOp = (code: string, value: number) => {
      map.setFeatureState({ source: "countries", id: code }, { introOp: value });
    };

    let raf = 0;
    let cancelled = false;
    let startTs = 0;

    const frame = (ts: number) => {
      if (cancelled) return;
      if (!startTs) startTs = ts;
      const elapsed = ts - startTs;
      let allDone = true;
      for (const { code, delay, duration, startOp } of blooms) {
        const p = Math.min(1, Math.max(0, (elapsed - delay) / duration));
        if (p < 1) allDone = false;
        // Ease-out so countries brighten quickly then settle into full yellow.
        const eased = 1 - Math.pow(1 - p, 1.6);
        const value = startOp + (INTRO_MAX_OPACITY - startOp) * eased;
        const bucket = bucketOf(value);
        if (lastBucket[code] !== bucket) {
          lastBucket[code] = bucket;
          setOp(code, value);
        }
      }
      if (!allDone) raf = requestAnimationFrame(frame);
    };

    for (const { code, startOp } of blooms) {
      lastBucket[code] = bucketOf(startOp);
      setOp(code, startOp);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
    };
  }, [introBloom, sourceReady, worldData]);

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
        map.fitBounds(WORLD_BOUNDS, {
          padding: 24,
          duration: 900,
        });
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
    paint: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      "fill-color": (introBloom ? GSC_YELLOW : FILL_COLOR) as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      "fill-opacity": (introBloom ? INTRO_FILL_OPACITY_EXPR : 0.85) as any,
      // Soft translucent edge baked into the fill itself, matching the
      // sibling gridsim-frontend project's map - stacked with the crisper
      // country-line layer below rather than replacing it.
      "fill-outline-color": "rgba(255,255,255,0.35)",
    },
  };

  const lineLayer: LayerProps = {
    id: "country-line",
    type: "line",
    // Matches gridsim's own border layer - white at 1.25px, not the
    // thinner 0.5px this used before.
    paint: { "line-color": "#fff", "line-width": 1.25 },
  };

  const selectedLayer: LayerProps = {
    id: "country-selected",
    type: "line",
    filter: ["==", ["get", "code"], selectedCountry ?? " "],
    // White, matching gridsim's own selected-country outline.
    paint: { "line-color": "#ffffff", "line-width": 2 },
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

      {/* Top-right zoom controls, matching the sibling gridsim-frontend
          project's own - hover only recolours the icon, not the button
          chrome, per the user's correction away from that source's actual
          hover (which also swaps background/outline). */}
      <Box
        sx={{
          position: "absolute",
          top: showingLegendBanner ? 64 : 16,
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
      </Box>

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
              <Typography variant="caption" sx={{ display: "block" }}>
                Policy score
              </Typography>
              <Typography variant="h5">
                {hovered.ranked ? scoreLabel(hovered.score) : "Not enough data to score yet"}
              </Typography>
              <Typography variant="caption">
                {hovered.answered}/{hovered.total} answered
                {hovered.ranked ? "" : " · not enough data"}
              </Typography>
            </>
          ) : (
            <Typography variant="caption">No data yet - click to start</Typography>
          )}
        </Paper>
      )}

      {!selectedCountry && !hideLegend && <MapLegend />}
    </Box>
  );
}
