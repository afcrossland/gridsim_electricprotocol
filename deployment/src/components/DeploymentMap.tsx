import { useEffect } from "react";
import { Map as MapGL, Source, Layer } from "react-map-gl/maplibre";
import type { LayerProps, MapLayerMouseEvent } from "react-map-gl/maplibre";
import { Box, useMediaQuery, useTheme } from "@mui/material";
import "maplibre-gl/dist/maplibre-gl.css";
import { useTranslation } from "react-i18next";

import World from "../../../shared/assets/jurisdictions.dissolved.geojson?url";
import FlagImg from "../../../shared/components/FlagImg";
import MapHoverTooltip from "../../../shared/components/MapHoverTooltip";
import MapLegend from "../../../shared/components/MapLegend";
import MapZoomControls from "../../../shared/components/MapZoomControls";
import { GSC_RAMP, COLOR_NO_DATA, logNormalize } from "../../../shared/lib/mapColor";
import { boundsOfCodes, regionFrameWindow } from "../../../shared/lib/mapBounds";
import { WORLD_BOUNDS, useWorldMap } from "../../../shared/lib/useWorldMap";
import { canonicalCode, jurisdictionName, resolveTargets, subregionOf } from "../lib/jurisdictions";
import { codesForMetric, domainForMetric, valueForMap, type Metric } from "../lib/metrics";

const INITIAL_VIEW = { longitude: 10, latitude: 20, zoom: 1.4 };

// MapLibre expression, not a plain value - react-map-gl's LayerProps types
// don't model expressions precisely, same reasoning as the policy tool's
// own PolicyMap.tsx casting its equivalent FILL_COLOR.
const FILL_COLOR = [
  "case",
  ["!=", ["feature-state", "norm"], null],
  ["interpolate", ["linear"], ["feature-state", "norm"], ...GSC_RAMP.flatMap((s) => [s.stop, s.color])],
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
  /** The sidebar's own UN geoscheme sub-region filter (single sub-region at a time - see `ContinentFilter`'s own `multiple` prop) - frames the map on whichever one is picked, same spirit as framing a selected country below. */
  subregions: string[];
  /** Suppresses the legend and the total-capacity tile even with nothing selected - the tour's opening scene wants an unobstructed view of the choropleth colours themselves, same reasoning as Policy Explorer's own PolicyMap.tsx `hideLegend` prop. */
  hideLegend?: boolean;
}

export default function DeploymentMap({ metric, selectedCountry, onCountryClick, subregions, hideLegend }: Props) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const { mapRef, worldData, mapStyle, sourceReady, onSourceData, hover, setHover } = useWorldMap(World, theme.palette.mode);

  const selectedLayer: LayerProps = {
    id: "deployment-selected",
    type: "line",
    // "in" a resolved list, not "==" one code - a subdivided selection
    // (Australia, the US, Canada) highlights every one of its state
    // features, not a single "AU"/"US"/"CA" feature that doesn't exist.
    filter: ["in", ["get", "code"], ["literal", selectedCountry ? resolveTargets(selectedCountry) : []]],
    paint: { "line-color": "#ffffff", "line-width": 2 },
  };



  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !sourceReady || !worldData) return;

    const [min, max] = domainForMetric(metric);
    // Log scale for every metric - installed capacity, per-capita capacity
    // and solar's own share of generation all span several orders of
    // magnitude (a handful of countries near 0%, a few past 20%), and a
    // linear 0-1 normalisation would paint almost everything at the bottom
    // of the ramp either way.
    const norm = (v: number) => logNormalize(v, min, max);

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

  // Frame the selected country; otherwise the sub-region filter, if one's
  // active; otherwise zoom back out to the whole world. A country always
  // wins over the sub-region filter - picking one implies looking right at
  // it, not at the wider region around it - though in practice the two
  // never compete: the sub-region filter only renders in the ranking-list
  // view, which is itself only shown when nothing's selected (see
  // Sidebar.tsx). Region framing added 2026-10-14 per Andrew's own
  // instruction ("when we click filter, it zooms in on the continent"),
  // switched from the six-continent list to the UN geoscheme's own finer
  // sub-regions the same day ("implement a filter not on continent but on
  // United Nations geoscheme").
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !worldData) return;
    if (selectedCountry) {
      const bounds = boundsOfCodes(worldData, resolveTargets(selectedCountry));
      if (bounds) map.fitBounds(bounds, { padding: 80, duration: 600, maxZoom: 5 });
      return;
    }
    if (subregions.length > 0) {
      // Same "capacity" universe Sidebar.tsx's own regional aggregate row
      // draws from, regardless of the active metric - a sub-region's own
      // shape doesn't change depending on which map metric is showing.
      const codes = codesForMetric("capacity").filter((code) => {
        const subregion = subregionOf(code);
        return subregion !== null && subregions.includes(subregion);
      });
      const bounds = boundsOfCodes(worldData, codes.flatMap((code) => resolveTargets(code)), regionFrameWindow(subregions));
      if (bounds) {
        map.fitBounds(bounds, { padding: 40, duration: 600 });
        return;
      }
    }
    map.fitBounds(WORLD_BOUNDS, { padding: 24, duration: 600 });
  }, [selectedCountry, subregions, worldData]);

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
  const hoveredName = hover ? jurisdictionName(hover.code, i18n.language) : undefined;
  const legendTitle = t(`metrics.${metric}`);

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
        onSourceData={onSourceData}
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

      {!hideLegend && <MapLegend title={legendTitle} rampStops={GSC_RAMP} />}

      {/* Top-right zoom controls, ported verbatim from ep_policymap's own
          PolicyMap.tsx (hand-built IconButtons, not MapLibre's
          NavigationControl) - same top offset trick for the mobile legend
          banner, which spans the full width up here too. */}
      <MapZoomControls
        topOffset={isMobile ? 64 : 16}
        onZoomIn={() => mapRef.current?.getMap().zoomIn({ duration: 300 })}
        onZoomOut={() => mapRef.current?.getMap().zoomOut({ duration: 300 })}
        onReset={() => {
          // Clearing the selection alone was a no-op when nothing was
          // selected (found 2026-09-19 testing the shared MapZoomControls
          // port): `onCountryClick(null)` only re-fits the world via the
          // effect above when `selectedCountry` actually *changes* - if
          // it's already null, React never re-runs that effect, so a
          // manually-zoomed, no-selection map just stayed zoomed. Calling
          // `fitBounds` directly here fixes that regardless of whether a
          // selection was cleared or there was never one to begin with.
          onCountryClick(null);
          mapRef.current?.getMap().fitBounds(WORLD_BOUNDS, { padding: 24, duration: 600 });
        }}
      />

      {/* Design lifted from the sibling gridsim-frontend project's own map
          hover tooltip 2026-09-29, applied as the shared
          `MapHoverTooltip` across all three apps - see that component's
          own doc comment. */}
      {hover && hoveredName && (
        <MapHoverTooltip
          x={hover.x}
          y={hover.y}
          flag={<FlagImg code={hover.code} size={16} />}
          name={hoveredName}
          value={
            hoveredValue === null
              ? t("map.noData")
              : metric === "share"
                ? t("map.share", { value: hoveredValue.toFixed(1) })
                : metric === "capacityPerCapita"
                  ? t("map.perCapita", { value: hoveredValue.toFixed(0) })
                  : t("map.capacity", { value: hoveredValue.toLocaleString() })
          }
          exploreLabel={t("map.clickToExplore")}
        />
      )}
    </Box>
  );
}
