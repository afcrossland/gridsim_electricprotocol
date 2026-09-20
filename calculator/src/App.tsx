import { useEffect, useState } from "react";
import {
  Box,
  CircularProgress,
  Divider,
  Tab,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import type { PaletteMode } from "@mui/material/styles";

import CountryLeagueTable from "./components/CountryLeagueTable";
import DispatchPanel from "./components/DispatchPanel";
import FlagImg from "../../shared/components/FlagImg";
import GenerationDemandPanel from "./components/GenerationDemandPanel";
import HelpPage from "./components/HelpPage";
import LanguageSwitcher from "./components/LanguageSwitcher";
import LocationSearchBar from "./components/LocationSearchBar";
import RefineForm from "./components/RefineForm";
import ResultsPanel, { Stat } from "./components/ResultsPanel";
import TopNavbar from "./components/TopNavbar";
import WorldMap from "./components/WorldMap";
import { calculateSavings } from "./lib/calculate";
import { countryCodeOf } from "./lib/jurisdictions";
import { METRIC_LABELS } from "./lib/mapMetrics";
import type { Metric } from "./lib/mapMetrics";
import type { DemandInput, Location, PanelArray, SavingsResults, Tariffs } from "./lib/types";
import { buildScenes } from "./tour/scenes";
import DetailHeader from "../../shared/components/DetailHeader";
import FooterComposition from "../../shared/components/FooterComposition";
import SidebarShell from "../../shared/components/SidebarShell";
import TourOverlay from "../../shared/tour/TourOverlay";
import { useTourState } from "../../shared/tour/useTourState";

const TOUR_SEEN_KEY = "calculator-tour-seen";
/** Real, real-generation-data location the tour's own Design/Dispatch scenes select - see `tour/scenes.ts`'s own doc comment. */
const DEMO_LOCATION: Location = { lat: 51.5019, lon: -0.1187, displayName: "United Kingdom", countryCode: "gb", mapCode: "GB" };

const METRICS: Metric[] = ["selfSufficiency", "generation"];

interface Props {
  mode: PaletteMode;
  setMode: (mode: PaletteMode) => void;
}

export type TabKey = "results" | "refine" | "generation" | "dispatch";

// EV charging stays fixed/hidden per Andrew's own instruction 2026-09-16
// ("hide the EV and tariff boxes"). Tariffs came back 2026-09-17 ("on
// economics tab, add three sliders... show all in $/kWh for now") - as
// real state again, just relocated to the Economics tab instead of
// Design, and now split into day/night import rates (see payback.ts's own
// NIGHT_HOURS). Defaults (import 0.20, night/export 0.07) per Andrew's own
// instruction the same day - the same figures regardless of location, only
// the displayed currency symbol changes (see lib/currency.ts).
const DEFAULT_TARIFFS: Tariffs = { importRateDay: 0.2, importRateNight: 0.07, exportRate: 0.07, inflationRate: 1.03 };
const FIXED_EV_CHARGING = false;
// "A normal house" default, per Andrew's own instruction 2026-09-16 - 12
// panels at 500Wp, 10kWh battery, 4,000 kWh/yr demand - is what a visitor
// sees immediately on picking a location, before touching anything in
// Design. Tilt/azimuth aren't exposed in the Design tab any more but still
// exist on the underlying array - they just stay at this default.
const DEFAULT_ARRAYS: PanelArray[] = [{ panels: 10, panelWatts: 500, tilt: 35, azimuth: 0 }];
const DEFAULT_BATTERY_KWH = 10;
const DEFAULT_DEMAND: DemandInput = { band: "medium", annualKWh: 4000 };

// Same 460px as Deployment Explorer's own SIDEBAR_WIDTH (deployment/src/App.tsx)
// - both apps call fitBounds(WORLD_BOUNDS) against whatever map area is left
// over once the sidebar is reserved, so matching that width is what makes
// this app's own startup zoom match deployment's, not just the shared
// INITIAL_VIEW constant in WorldMap.tsx (same lon/lat/zoom in both, but that
// alone still isn't what's actually rendered - see WorldMap.tsx's own
// fitBounds-on-load effect).
const SIDEBAR_DEFAULT_WIDTH = 460;
const SIDEBAR_EXPANDED_WIDTH = "66.6667%"; // 2/3, per Andrew's own instruction 2026-09-15

/**
 * Map + sidebar layout matching Deployment Explorer's own look and feel
 * (TopNavbar, the map as a flex sibling of the sidebar rather than an
 * overlay, a footer search bar with the map's own metric selector). The
 * sidebar journey: picking a location (map click, search, or a
 * league-table row) immediately calculates and shows results for a
 * default 10-panel/500Wp/10kWh "normal house" system under the
 * **Economics** tab (originally "Typical home"), and **Design**
 * (originally "Refined system") lets you adjust panel count, panel size,
 * battery size and annual demand - the only four inputs still exposed
 * since Andrew's own instruction 2026-09-16 ("reduce our choices to...
 * hide the EV and tariff boxes") - each auto-recalculating (debounced) as
 * it changes. Reads `?lat=&lon=&country=` off the URL on load, same
 * deep-link convention the sibling apps use.
 *
 * Mobile layout (below `md`) ported from Deployment Explorer's own
 * App.tsx 2026-09-18 - see the `isMobile` block below for the Map/List
 * toggle this becomes there.
 */
export default function App({ mode, setMode }: Props) {
  const [location, setLocation] = useState<Location | null>(() => readLocationFromUrl());
  const [tab, setTab] = useState<TabKey>("refine");
  // Self-sufficiency is the default view, per Andrew's own instruction
  // 2026-09-16 - generation (the map's own original, and only, view before
  // this selector existed) is the alternative.
  const [metric, setMetric] = useState<Metric>("selfSufficiency");
  // Same "page" concept as the sibling apps' own App.tsx - switches the
  // whole main area over to the new Help page (see HelpPage.tsx) and back.
  const [page, setPage] = useState<"map" | "help">("map");

  // The tour/Help/Login header buttons, and the tour itself, are all new
  // 2026-09-19 (this app had none before) - built on the same shared
  // `shared/tour/` engine deployment's own tour was ported onto the same
  // day. See `tour/scenes.ts` for the scene content.
  const { tourOpen, openTour, dismissTour, setTourSceneId, heroScene } = useTourState(TOUR_SEEN_KEY);

  // Mobile layout, ported from Deployment Explorer's own App.tsx
  // (deployment/src/App.tsx) 2026-09-18 - below `md`, the map and sidebar
  // can't sit side by side (the sidebar's own fixed desktop width alone is
  // wider than most phones), so they become a Map/List toggle instead,
  // switching between the same two full-screen views rather than
  // squeezing both onto the screen together. A selected location's own
  // detail view takes the entire screen on mobile, same as there - no room
  // for a Map/List toggle on top of it too, and its own back arrow already
  // gets you out.
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [mobileView, setMobileView] = useState<"map" | "list">("list");

  const [arrays, setArrays] = useState<PanelArray[]>(DEFAULT_ARRAYS);
  const [batteryKWh, setBatteryKWh] = useState(DEFAULT_BATTERY_KWH);
  const [demand, setDemand] = useState<DemandInput>(DEFAULT_DEMAND);
  const [tariffs, setTariffs] = useState<Tariffs>(DEFAULT_TARIFFS);

  const [results, setResults] = useState<SavingsResults | null>(null);
  const [loading, setLoading] = useState(false);

  async function runCalculation(loc: Location) {
    setLoading(true);
    const r = await calculateSavings({
      location: loc,
      arrays,
      batteryKWh,
      demand,
      evCharging: FIXED_EV_CHARGING,
      tariffs,
    });
    setResults(r);
    setLoading(false);
  }

  function selectLocation(loc: Location) {
    setLocation(loc);
    // Design, not Economics, per Andrew's own instruction 2026-09-18
    // ("when click on country, default to design tab") - a first-time
    // visitor lands on the system-spec sliders before the numbers they drive.
    setTab("refine");
    // Reset to the default "normal house" system for the new location -
    // otherwise a previous location's Design/Economics tweaks would
    // silently carry over and no longer mean "a normal house" for this one.
    setArrays(DEFAULT_ARRAYS);
    setBatteryKWh(DEFAULT_BATTERY_KWH);
    setDemand(DEFAULT_DEMAND);
    setTariffs(DEFAULT_TARIFFS);
  }

  function closeSidebar() {
    setLocation(null);
    setResults(null);
  }

  // Finishing (or skipping) the tour returns to a defined start position -
  // the whole map, nothing selected, the default metric - rather than
  // leaving the tour's own demo location (`DEMO_LOCATION` above) selected
  // behind it. Per Andrew's own instruction 2026-09-19 ("after the tour,
  // as part of the defined process, we need to go to a start position
  // showing whole map, no country selected and a particular ranking on
  // the sidebar").
  function dismissTourToStart() {
    dismissTour();
    closeSidebar();
    setTab("refine");
    setMetric("selfSufficiency");
  }

  // Help and Tour now share one entry point (both the header's own single
  // "Help" button, and this) - the hero scene's own "Read documentation"
  // button, per Andrew's own instruction 2026-09-20. Nothing in the hero
  // scene has run any `onEnter` side effect yet (only later scenes do), so
  // this only needs to mark the tour seen and switch pages - no map/sidebar
  // state to reset the way `dismissTourToStart` above does.
  function openDocsFromTour() {
    dismissTour();
    setPage("help");
  }

  // Shared by the map's own click handler and the league table's row click
  // (CountryLeagueTable) - a row click selects that country exactly like
  // clicking it on the map does, per Andrew's own instruction 2026-09-16
  // ("a league table... like on deployment explorer").
  function handleSelect(sel: { code: string; name: string; lat: number; lon: number }) {
    selectLocation({
      lat: sel.lat,
      lon: sel.lon,
      displayName: sel.name,
      countryCode: countryCodeOf(sel.code).toLowerCase(),
      mapCode: sel.code,
    });
  }

  // Calculate whenever the location or any Design/Economics-tab input
  // changes, per Andrew's own instruction 2026-09-16 ("auto update the
  // calculation of savings") - no submit button any more. Debounced 300ms
  // so dragging a slider doesn't trigger a fresh 8760-hour dispatch
  // simulation on every intermediate tick, just once the value settles.
  useEffect(() => {
    if (!location) return;
    const handle = setTimeout(() => runCalculation(location), 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, arrays, batteryKWh, demand, tariffs]);

  const map = (
    <WorldMap
      selectedCode={location?.mapCode ?? null}
      selectedPoint={location && !location.mapCode ? { lat: location.lat, lon: location.lon } : null}
      onSelect={handleSelect}
      metric={metric}
    />
  );

  const tourScenes = buildScenes(() => selectLocation(DEMO_LOCATION), setTab);

  // Extracted so the exact same JSX renders in three places - the desktop
  // sidebar, mobile's full-screen detail view (once a location is picked),
  // and mobile's List view (before one is) - rather than triplicating it,
  // same reasoning as Deployment Explorer's own `list` variable
  // (deployment/src/App.tsx).
  const sidebarContent = (
    <>
      {!location && (
        <>
          {/* Same heading+description text style as Deployment
              Explorer's own default sidebar (Sidebar.tsx: 1.375rem/700
              heading, a bold lead phrase running into a normal-weight
              body2 sentence) - copy rewritten for this app rather than
              reused, per Andrew's instruction 2026-09-15. The ranked
              list below it is new (per Andrew's own instruction
              2026-09-16: "a league table of countries like on
              deployment explorer"). */}
          <Box sx={{ p: 2, pb: 1.5 }}>
            <Typography sx={{ fontSize: "1.375rem", fontWeight: 700, color: "text.primary", lineHeight: 1.2, mb: 0.5 }}>
              Solar Homes Calculator
            </Typography>
            <Typography variant="body2">
              <strong>Pick a country on the map or search below</strong>{" "}
              to configure a solar and battery system and see how much of your own electricity it could cover,
              what you'd export, and how quickly it could pay for itself.
            </Typography>
          </Box>
          <CountryLeagueTable metric={metric} onSelect={handleSelect} />
        </>
      )}

      {location && (
        <>
          {/* Same header shape as Deployment Explorer's own detail
              view (Sidebar.tsx: an always-present back arrow, a flag,
              an h2 name at 1.125rem) - per Andrew's instruction
              2026-09-15. The arrow always goes back out to the full
              map - there's no multi-step wizard to step back through
              any more now that Economics/Design are just tabs. Ported
              onto the shared `DetailHeader` 2026-09-19. */}
          <DetailHeader
            onBack={closeSidebar}
            flag={<FlagImg code={location.countryCode} size={22} />}
            name={location.displayName}
            sx={{ borderBottom: results ? "none" : "1px solid", borderColor: "divider" }}
          />

          {/* Three headline tiles, per Andrew's own instruction
              2026-09-16 - the same numbers the Economics tab breaks
              down further, surfaced here so they're visible without
              opening a tab. Payback is a range (see PaybackTable) so
              there's no single number to headline yet - "Coming soon"
              is a deliberate placeholder, not a bug. */}
          {!loading && results && (
            <Box sx={{ px: 2, pb: 2, display: "flex", gap: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
              <Stat label="Total generation" value={`${results.annualGenerationKWh.toLocaleString()} kWh/yr`} />
              <Stat label="Self sufficiency" value={`${results.pctDemandMet}%`} />
              <Stat label="Payback range" value="Coming soon" muted />
            </Box>
          )}

          {/* `scrollable` + always-visible scroll buttons, not policy's own
              `fullWidth` on mobile - fullWidth works there with three short
              labels, but "Generation & demand" here wouldn't fit four equal
              slots on a narrow phone without wrapping. The chevron arrows
              are also what makes it obvious there's a tab off-screen at all -
              found 2026-09-20 after Andrew reported this row wasn't
              scrollable on mobile and gave no hint more tabs existed. */}
          <Tabs
            value={tab}
            onChange={(_, v: TabKey) => setTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            sx={{ borderBottom: "1px solid", borderColor: "divider", px: 2, minWidth: 0 }}
          >
            <Tab value="refine" label="Design" />
            <Tab value="generation" label="Generation &amp; demand" />
            <Tab value="dispatch" label="Dispatch" />
            <Tab value="results" label="Economics" />
          </Tabs>

          {/* No `justifyContent: "center"` - Refine/Results both fill
              the full sidebar width themselves (per Andrew's
              instruction 2026-09-16), rather than sitting in a
              centred, capped-width column now that the sidebar is 2/3
              of the screen. */}
          <Box sx={{ p: 3, overflowY: "auto", flex: 1 }}>
            {loading && (
              <Box sx={{ display: "flex", justifyContent: "center", mt: 6 }}>
                <CircularProgress />
              </Box>
            )}

            {!loading && tab === "results" && results && (
              <ResultsPanel
                results={results}
                arrays={arrays}
                batteryKWh={batteryKWh}
                tariffs={tariffs}
                onTariffsChange={setTariffs}
                countryCode={location?.countryCode}
              />
            )}

            {!loading && tab === "refine" && (
              <RefineForm
                panels={arrays[0].panels}
                onPanelsChange={(panels) => setArrays([{ ...arrays[0], panels }])}
                panelWatts={arrays[0].panelWatts}
                onPanelWattsChange={(panelWatts) => setArrays([{ ...arrays[0], panelWatts }])}
                batteryKWh={batteryKWh}
                onBatteryChange={setBatteryKWh}
                annualKWh={demand.annualKWh ?? 4000}
                onAnnualKWhChange={(annualKWh) => setDemand({ ...demand, annualKWh })}
              />
            )}

            {!loading && tab === "generation" && results && (
              <GenerationDemandPanel generationProfile={results.generationProfile} demandProfile={results.demandProfile} />
            )}

            {!loading && tab === "dispatch" && results && <DispatchPanel dispatch={results.dispatchHourly} />}
          </Box>
        </>
      )}
    </>
  );

  return (
    <Box sx={{ height: "100dvh", width: "100%", display: "flex", flexDirection: "column", overflowX: "hidden" }}>
      {/* Hidden through the tour's opening hero scene, same as the sibling
          apps' own App.tsx hide their equivalent nav/footer there, for an
          unobstructed view of the map. */}
      {!heroScene && (
        <TopNavbar mode={mode} setMode={setMode} onOpenHelp={openTour} />
      )}

      {page === "help" ? (
        <HelpPage onBack={() => setPage("map")} />
      ) : (
        <>
          {heroScene ? (
            <Box sx={{ flex: 1, position: "relative" }}>{map}</Box>
          ) : isMobile ? (
            location ? (
              // A location's own detail view takes the full screen on mobile -
              // no room for a Map/List toggle on top of it too, and its own
              // back arrow (in sidebarContent's own header) already gets you
              // out - same as Deployment Explorer's own equivalent state.
              <Box sx={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", bgcolor: "background.paper" }}>
                {sidebarContent}
              </Box>
            ) : (
              <Box sx={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                {/* Search sits left-aligned next to the Map/List toggle, both in
                    one row - same relocation Deployment Explorer's own mobile
                    layout made (off its own separate row, which doesn't exist
                    here any more once search moves off the footer). */}
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 1,
                    px: 2,
                    pt: 1.5,
                    pb: 1,
                    bgcolor: "background.paper",
                  }}
                >
                  {/* No location selected in this branch (see the `location ? ... : ...`
                      just above) - `selectedCountryCode` is always undefined here,
                      not `location?.countryCode` (a TS control-flow-analysis
                      limitation narrows `location` to `never` inside a ternary
                      nested this deep, not `null`, so the optional-chain access
                      itself fails to typecheck even though it's logically fine). */}
                  {/* minWidth: 0 lets this shrink below its own content's
                      natural size - without it, this plain wrapper Box (added
                      only so the tour's Spotlight has a `data-tour` selector
                      to target) blocked the flex-shrink chain LocationSearchBar's
                      own `width: 320, maxWidth: "60%"` relies on, so on a
                      narrow phone this box stayed a full 320px wide and pushed
                      the List/Map toggle off the right edge of the screen -
                      found 2026-09-20 after Andrew spotted the toggle clipped
                      on mobile. */}
                  <Box data-tour="location-search" sx={{ minWidth: 0, flexShrink: 1 }}>
                    <LocationSearchBar selectedCountryCode={undefined} onSelect={selectLocation} />
                  </Box>
                  <ToggleButtonGroup size="small" exclusive value={mobileView} onChange={(_, next) => next && setMobileView(next)}>
                    <ToggleButton value="list" sx={{ py: 0.25, px: 1.5, fontSize: "0.75rem" }}>
                      List
                    </ToggleButton>
                    <ToggleButton value="map" sx={{ py: 0.25, px: 1.5, fontSize: "0.75rem" }}>
                      Map
                    </ToggleButton>
                  </ToggleButtonGroup>
                </Box>
                <Divider />
                {mobileView === "map" ? (
                  <Box sx={{ flex: 1, minHeight: 0, position: "relative" }}>{map}</Box>
                ) : (
                  <Box
                    sx={{ flex: 1, minHeight: 0, bgcolor: "background.paper", overflow: "hidden", display: "flex", flexDirection: "column" }}
                  >
                    {sidebarContent}
                  </Box>
                )}
              </Box>
            )
          ) : (
            // Same map + sidebar layout as Deployment Explorer's own desktop
            // App.tsx - the map is a flex sibling of the sidebar, not an overlay.
            <Box sx={{ flex: 1, display: "flex", overflow: "hidden" }}>
              <Box sx={{ flex: 1, position: "relative", minWidth: 0 }}>{map}</Box>
              <SidebarShell width={location ? SIDEBAR_EXPANDED_WIDTH : SIDEBAR_DEFAULT_WIDTH}>{sidebarContent}</SidebarShell>
            </Box>
          )}

          {!heroScene && (
            <FooterComposition
              search={
                // Desktop only - on mobile the search box moved up next to the
                // Map/List toggle (see above), so this footer's only content is
                // the metric selector, same reasoning as Deployment Explorer's
                // own footer (deployment/src/App.tsx: "search itself stays
                // desktop-only here").
                !isMobile && (
                  <Box data-tour="location-search" sx={{ minWidth: 0, flexShrink: 1 }}>
                    <LocationSearchBar selectedCountryCode={location?.countryCode} onSelect={selectLocation} />
                  </Box>
                )
              }
              toggle={
                // Same ToggleButtonGroup-in-the-footer pattern, and the same
                // position immediately after the search box, as Policy Explorer's
                // own map-metric toggle (src/App.tsx) and Deployment Explorer's
                // own (deployment/src/App.tsx) - per Andrew's own instruction
                // 2026-09-16 ("move the toggle on the map mode to the left like
                // on deployment calculator"). Hidden once a location is selected,
                // per Andrew's own instruction 2026-09-18 ("when we click on a
                // country the toggle... on the footer should disappear") - it
                // colours the map, which isn't visible any more on mobile once
                // the sidebar takes the full screen, and on desktop it no longer
                // reflects anything the sidebar's own content is about.
                !location && (
                  <ToggleButtonGroup size="small" exclusive value={metric} onChange={(_, v: Metric | null) => v && setMetric(v)}>
                    {METRICS.map((m) => (
                      <ToggleButton key={m} value={m} sx={{ py: 0.25, px: 1.5, fontSize: "0.7rem" }}>
                        {METRIC_LABELS[m]}
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                )
              }
              languageSwitcher={<LanguageSwitcher />}
            />
          )}

          {tourOpen && (
            <TourOverlay
              scenes={tourScenes}
              onDismiss={dismissTourToStart}
              onSceneChange={setTourSceneId}
              onReadDocs={openDocsFromTour}
              heroFooter={
                <>
                  by The Global Solar Council&ensp;·&ensp;
                  <Box component="span" sx={{ color: "#FBB114", fontStyle: "italic", fontWeight: 600 }}>
                    Solar. Storage. Future Secured.
                  </Box>
                </>
              }
            />
          )}
        </>
      )}
    </Box>
  );
}

function readLocationFromUrl(): Location | null {
  const params = new URLSearchParams(window.location.search);
  const lat = params.get("lat");
  const lon = params.get("lon");
  const country = params.get("country");
  if (!lat || !lon || !country) return null;
  const location: Location = {
    lat: parseFloat(lat),
    lon: parseFloat(lon),
    displayName: params.get("place") ?? `${lat}, ${lon}`,
    countryCode: country.toLowerCase(),
  };
  const url = new URL(window.location.href);
  ["lat", "lon", "place", "country"].forEach((k) => url.searchParams.delete(k));
  window.history.replaceState({}, "", url);
  return location;
}
