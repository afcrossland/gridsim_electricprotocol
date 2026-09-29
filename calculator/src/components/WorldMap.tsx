import { useEffect, useMemo, useRef, useState } from "react";
import { Map as MapGL, Source, Layer } from "react-map-gl/maplibre";
import type { LayerProps, MapLayerMouseEvent, MapRef } from "react-map-gl/maplibre";
import { Box, Button, CircularProgress, Typography, useTheme } from "@mui/material";
import LockIcon from "@mui/icons-material/Lock";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import type { FeatureCollection } from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";

import World from "../assets/jurisdictions.geojson?url";
import FlagImg from "../../../shared/components/FlagImg";
import MapHoverTooltip from "../../../shared/components/MapHoverTooltip";
import MapLegend from "../../../shared/components/MapLegend";
import MapZoomControls from "../../../shared/components/MapZoomControls";
import { GSC_RAMP, COLOR_NO_DATA } from "../../../shared/lib/mapColor";
import { loadMapStyle } from "../../../shared/lib/mapStyle";
import { computeGlobalSelfSufficiency } from "../lib/globalSimulation";
import { countryCodeOf, jurisdictionName } from "../lib/jurisdictions";
import { METRIC_LEGEND_TITLES, formatMetricValue, loadMetricValues, normalizeForMetric } from "../lib/mapMetrics";
import type { Metric } from "../lib/mapMetrics";
import SliderField from "./SliderField";

const INITIAL_VIEW = { longitude: 10, latitude: 20, zoom: 1.4 };
const WORLD_BOUNDS: [[number, number], [number, number]] = [
  [-170, -58],
  [180, 78],
];

// Same amber-to-aqua ramp, "case + interpolate on feature-state" pattern as
// Deployment Explorer's own DeploymentMap.tsx FILL_COLOR - per Andrew's own
// instruction 2026-09-16 ("take the legend/colour style from deployment
// explorer"). The fill expression itself never changes when the metric
// selector changes (same pattern as deployment's own map) - only the
// feature-state `norm` value each country is given does, see the effect
// below and lib/mapMetrics.ts.
const FILL_COLOR = [
  "case",
  ["!=", ["feature-state", "norm"], null],
  ["interpolate", ["linear"], ["feature-state", "norm"], ...GSC_RAMP.flatMap((s) => [s.stop, s.color])],
  COLOR_NO_DATA,
];

const fillLayer: LayerProps = {
  id: "world-fill",
  type: "fill",
  paint: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    "fill-color": FILL_COLOR as any,
    "fill-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 0.9, 0.75],
  },
};

const lineLayer: LayerProps = {
  id: "world-line",
  type: "line",
  paint: { "line-color": "#fff", "line-width": 1 },
};

/** Bounding box of one feature (by its own `code` property) - trimmed from deployment/policy's own boundsOf, single-code only (this app has no subdivided-country union to expand, since a click always resolves to a real leaf feature - see App.tsx's onSelect). */
function boundsOf(data: FeatureCollection, code: string): [[number, number], [number, number]] | null {
  const feature = data.features.find((f) => f.properties?.code === code);
  if (!feature?.geometry || !("coordinates" in feature.geometry)) return null;

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
  visit(feature.geometry.coordinates);

  if (lngs.length === 0) return null;
  return [
    [Math.min(...lngs), minLat],
    [Math.max(...lngs), maxLat],
  ];
}

export default function WorldMap({
  selectedCode,
  selectedPoint,
  onSelect,
  metric,
  globalSimulator = false,
  member = false,
}: {
  selectedCode: string | null;
  /** A lat/lon to fly to when there's no map feature to fit bounds to - a search-picked (rather than map-clicked) location has no jurisdictions.json code, so this is the only signal available for it. */
  selectedPoint: { lat: number; lon: number } | null;
  onSelect: (params: { code: string; name: string; lat: number; lon: number }) => void;
  metric: Metric;
  /** True while the map metric toggle is set to "Global simulator" - added 2026-09-28. Combined with `member` below to decide whether this shows the real, working panel or just a locked teaser. */
  globalSimulator?: boolean;
  /**
   * The shared cross-app login flag (`shared/lib/membership.ts`) - a
   * non-member sees `globalSimulator` as a locked teaser (blurred map,
   * disabled sliders, a lock + "Members only" message - the only state
   * that existed before 2026-09-29). A member gets the real thing: a
   * working panel of live panels/battery/demand sliders and a "Simulate"
   * button that recomputes self-sufficiency for every country at once
   * (`computeGlobalSelfSufficiency`) and recolours the map with it.
   */
  member?: boolean;
}) {
  const mapRef = useRef<MapRef>(null);
  const [worldData, setWorldData] = useState<FeatureCollection | null>(null);
  const [sourceReady, setSourceReady] = useState(false);
  const [hover, setHover] = useState<{ code: string; x: number; y: number } | null>(null);
  const [metricValues, setMetricValues] = useState<Record<string, number> | null>(null);
  const theme = useTheme();

  // The Global simulator's own config/results - kept local to this
  // component (not lifted to App.tsx) since nothing outside the map needs
  // them. Dragging a slider only updates `simConfig` (the panel's own
  // displayed numbers) - it deliberately does NOT touch `simValues`, so the
  // map/legend stay showing the last simulated result, constant, until
  // "Simulate" is clicked again. Found 2026-09-29: an earlier version
  // cleared `simValues` on every slider change, which snapped the map back
  // to the plain default view mid-drag, before a new simulation had even
  // run - the opposite of "constant." "Click to simulate" (not a live
  // recompute on every drag tick) is still the real control, per Andrew's
  // own instruction - it just means "only update on click," not "clear on
  // every change in between."
  const [simConfig, setSimConfig] = useState({ panels: 14, batteryKWh: 13.5, annualKWh: 4200 });
  const [simValues, setSimValues] = useState<Record<string, number> | null>(null);
  const [simulating, setSimulating] = useState(false);

  const updateSimConfig = (patch: Partial<typeof simConfig>) => {
    setSimConfig((c) => ({ ...c, ...patch }));
  };

  const runSimulation = async () => {
    setSimulating(true);
    try {
      const values = await computeGlobalSelfSufficiency({
        panels: simConfig.panels,
        panelWatts: 500,
        batteryKWh: simConfig.batteryKWh,
        annualKWh: simConfig.annualKWh,
      });
      setSimValues(values);
    } finally {
      setSimulating(false);
    }
  };

  // A non-member sees the old locked teaser; a member sees the real map,
  // simulated results and all, once they've actually run one.
  const isTeaser = globalSimulator && !member;
  const isSimMode = globalSimulator && member;
  const effectiveValues = isSimMode && simValues ? simValues : metricValues;

  const selectedLayer: LayerProps = {
    id: "world-selected",
    type: "line",
    filter: ["==", ["get", "code"], selectedCode ?? "__none__"],
    paint: { "line-color": "#008194", "line-width": 2.5 },
  };

  const mapStyle = useMemo(() => loadMapStyle(theme.palette.mode), [theme.palette.mode]);

  useEffect(() => {
    setSourceReady(false);
  }, [mapStyle]);

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

  // Reloads whenever the metric selector changes - generation's own values
  // come from the same dataset genericSource.ts's calculation reads from
  // (lib/countryIrradiance.ts), self-sufficiency from a precomputed
  // per-country lookup (lib/mapMetrics.ts's own doc comment has the
  // caveats). Either way the choropleth colours each country by the exact
  // figure a calculation would use, not a separate approximation of it.
  useEffect(() => {
    let mounted = true;
    loadMetricValues(metric).then((data) => {
      if (mounted) setMetricValues(data);
    });
    return () => {
      mounted = false;
    };
  }, [metric]);

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !sourceReady || !worldData || !effectiveValues) return;

    const values = Object.values(effectiveValues);
    const min = Math.min(...values);
    const max = Math.max(...values);

    for (const f of worldData.features) {
      const code = f.properties?.code;
      if (typeof code !== "string") continue;
      const value = effectiveValues[code];
      const norm = value === undefined ? null : normalizeForMetric(metric, value, min, max);
      map.setFeatureState({ source: "countries", id: code }, { norm });
    }
  }, [sourceReady, worldData, effectiveValues, metric]);

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !sourceReady) return;
    if (hover) map.setFeatureState({ source: "countries", id: hover.code }, { hover: true });
    return () => {
      if (hover) map.setFeatureState({ source: "countries", id: hover.code }, { hover: false });
    };
  }, [hover, sourceReady]);

  // Frame the selected country, or zoom back out to the whole world once a
  // selection is cleared (the sidebar's own close button sets
  // selectedCode back to null) - same behaviour as the sibling apps' own
  // maps. Per Andrew's instruction 2026-09-15.
  //
  // Unlike deployment's own map, this app's sidebar doesn't just swap
  // content at a fixed width when a location is picked - it grows from
  // SIDEBAR_DEFAULT_WIDTH to SIDEBAR_EXPANDED_WIDTH (App.tsx, a 220ms CSS
  // transition), so the map's own container is still its old (wider) size
  // at the exact moment this effect fires. Calling fitBounds immediately
  // computes the frame against that stale width, and MapLibre's own
  // ResizeObserver-driven resize() (which react-map-gl wires up
  // automatically) preserves center/zoom rather than re-fitting, so the
  // country ends up mis-framed once the sidebar finishes expanding.
  // Waiting out the transition, then explicitly resizing before fitting,
  // fixes it - found 2026-09-15 testing a UK selection.
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !worldData) return;
    const timer = setTimeout(() => {
      map.resize();
      if (selectedCode) {
        const bounds = boundsOf(worldData, selectedCode);
        if (bounds) map.fitBounds(bounds, { padding: 60, duration: 400, maxZoom: 6 });
        return;
      }
      if (selectedPoint) {
        map.flyTo({ center: [selectedPoint.lon, selectedPoint.lat], zoom: 6, duration: 400 });
        return;
      }
      map.fitBounds(WORLD_BOUNDS, { padding: 24, duration: 400 });
    }, 240);
    return () => clearTimeout(timer);
  }, [selectedCode, selectedPoint, worldData]);

  const handleMouseMove = (event: MapLayerMouseEvent) => {
    const code = event.features?.[0]?.properties?.code as string | undefined;
    if (code) setHover({ code, x: event.point.x, y: event.point.y });
    else setHover(null);
  };

  const handleClick = (event: MapLayerMouseEvent) => {
    const code = event.features?.[0]?.properties?.code as string | undefined;
    if (!code) return;
    onSelect({ code, name: jurisdictionName(code), lat: event.lngLat.lat, lon: event.lngLat.lng });
  };

  const hoveredValue = hover && effectiveValues ? (effectiveValues[hover.code] ?? null) : null;

  return (
    <Box sx={{ position: "relative", width: "100%", height: "100%" }}>
      <Box
        aria-hidden={isTeaser}
        sx={{
          width: "100%",
          height: "100%",
          ...(isTeaser && { filter: "blur(6px)", pointerEvents: "none", userSelect: "none" }),
        }}
      >
        <MapGL
          ref={mapRef}
          mapStyle={mapStyle}
          initialViewState={INITIAL_VIEW}
          style={{ width: "100%", height: "100%" }}
          interactiveLayerIds={!isTeaser && worldData ? ["world-fill"] : []}
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

        {/* uppercaseTitle=false since this metric's own title can carry a
            mixed-case unit ("kWh/kWp") that CSS uppercase would mangle into
            "KWH/KWP" - see the shared MapLegend's own doc comment. */}
        <MapLegend title={METRIC_LEGEND_TITLES[metric]} rampStops={GSC_RAMP} uppercaseTitle={false} />

        {/* Same top offset, zIndex, sizing and shadow as Deployment
            Explorer's own zoom controls (DeploymentMap.tsx) - per Andrew's
            own instruction 2026-09-16 ("the legend should be placed in the
            same place as deployment explorer"). */}
        <MapZoomControls
          onZoomIn={() => mapRef.current?.getMap().zoomIn()}
          onZoomOut={() => mapRef.current?.getMap().zoomOut()}
          onReset={() => mapRef.current?.getMap().fitBounds(WORLD_BOUNDS, { padding: 24, duration: 600 })}
        />

        {isSimMode && (
          <GlobalSimulatorPanel
            config={simConfig}
            onConfigChange={updateSimConfig}
            onSimulate={runSimulation}
            simulating={simulating}
            hasResults={simValues !== null}
          />
        )}
      </Box>

      {/* Design lifted from the sibling gridsim-frontend project's own map
          hover tooltip 2026-09-29, applied as the shared
          `MapHoverTooltip` across all three apps - see that component's
          own doc comment. */}
      {!isTeaser && hover && (
        <MapHoverTooltip
          x={hover.x}
          y={hover.y}
          flag={<FlagImg code={countryCodeOf(hover.code)} size={16} />}
          name={jurisdictionName(hover.code)}
          value={hoveredValue === null ? "No data" : formatMetricValue(metric, hoveredValue)}
        />
      )}

      {isTeaser && <GlobalSimulatorTeaser />}
    </Box>
  );
}

/**
 * The real, working "Global simulator" panel - shown once `member` is true
 * (added 2026-09-29, "let's get the global simulator working... when I
 * click members and login, enable this mode"). Three live sliders (panel
 * wattage stays fixed at 500Wp, matching the "medium" tier every other
 * self-sufficiency figure in this app is calibrated against - not exposed
 * here, same as the teaser's own mock never exposed it) plus an explicit
 * "Simulate" button, per Andrew's own instruction ("the sliders adjust...
 * but to keep stable let's have click to simulate") - dragging a slider
 * only updates this panel's own numbers, never triggers the ~230-country
 * recompute by itself. Floats over the map in the same spot the locked
 * teaser used, but nothing here is blurred or disabled.
 */
function GlobalSimulatorPanel({
  config,
  onConfigChange,
  onSimulate,
  simulating,
  hasResults,
}: {
  config: { panels: number; batteryKWh: number; annualKWh: number };
  onConfigChange: (patch: Partial<{ panels: number; batteryKWh: number; annualKWh: number }>) => void;
  onSimulate: () => void;
  simulating: boolean;
  hasResults: boolean;
}) {
  return (
    <Box
      sx={{
        position: "absolute",
        // Clears the map legend, which floats at the same top:16/left:16
        // spot (shared/components/MapLegend.tsx) - found 2026-09-29 after
        // the two overlapped, cutting off this panel's own top slider.
        top: 108,
        left: 16,
        width: 220,
        display: "flex",
        flexDirection: "column",
        gap: 1,
      }}
    >
      <SliderField
        heading="Number of panels"
        value={config.panels}
        unit=""
        min={0}
        max={50}
        step={1}
        onChange={(panels) => onConfigChange({ panels })}
      />
      <SliderField
        heading="Battery"
        value={config.batteryKWh}
        unit="kWh"
        min={0}
        max={40}
        step={2.5}
        precision={1}
        onChange={(batteryKWh) => onConfigChange({ batteryKWh })}
      />
      <SliderField
        heading="Annual electricity demand"
        value={config.annualKWh}
        unit="kWh"
        min={500}
        max={20000}
        step={250}
        onChange={(annualKWh) => onConfigChange({ annualKWh })}
      />
      <Button
        variant="contained"
        onClick={onSimulate}
        disabled={simulating}
        startIcon={simulating ? <CircularProgress size={14} color="inherit" /> : <PlayArrowIcon fontSize="small" />}
        sx={{ borderRadius: "22px", boxShadow: "0 6px 20px rgba(0,0,0,0.28)" }}
      >
        {simulating ? "Simulating…" : hasResults ? "Re-simulate" : "Simulate"}
      </Button>
    </Box>
  );
}

/**
 * The "Global simulator" locked teaser shown to a non-member - a small
 * card of disabled, plausible-looking panel/battery/demand sliders (the
 * same fields `GlobalSimulatorPanel` above uses for real once a member logs
 * in), floating over the blurred map, plus a lock + "Members only" message
 * centered over everything.
 */
function GlobalSimulatorTeaser() {
  return (
    <>
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          top: 16,
          left: 16,
          width: 220,
          filter: "blur(6px)",
          pointerEvents: "none",
          userSelect: "none",
          display: "flex",
          flexDirection: "column",
          gap: 1,
        }}
      >
        <SliderField heading="Number of panels" value={14} unit="" min={0} max={50} step={1} onChange={() => {}} />
        <SliderField heading="Battery size" value={13.5} unit="kWh" min={0} max={40} step={0.5} precision={1} onChange={() => {}} />
        <SliderField heading="Annual electricity demand" value={4200} unit="kWh" min={1000} max={10000} step={100} onChange={() => {}} />
      </Box>

      <Box
        sx={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 1,
          textAlign: "center",
          px: 3,
          bgcolor: (theme) => (theme.palette.mode === "dark" ? "rgba(32,39,42,0.45)" : "rgba(255,255,255,0.55)"),
        }}
      >
        <LockIcon sx={{ fontSize: 28, color: "text.secondary" }} />
        <Typography sx={{ fontWeight: 700, color: "text.secondary" }}>Members only</Typography>
        <Typography sx={{ fontSize: "0.8125rem", color: "text.secondary", maxWidth: 320 }}>
          Set one solar, battery and demand configuration and see self-sufficiency recalculated for every country at
          once.
        </Typography>
      </Box>
    </>
  );
}
