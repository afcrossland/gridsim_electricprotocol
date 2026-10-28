import { useState } from "react";
import { Box, Divider, ToggleButton, ToggleButtonGroup, useMediaQuery, useTheme } from "@mui/material";
import type { PaletteMode } from "@mui/material/styles";
import { useTranslation } from "react-i18next";

import CountrySearch from "./components/CountrySearch";
import DeploymentMap from "./components/DeploymentMap";
import EmberBadge from "./components/EmberBadge";
import HelpPage from "./components/HelpPage";
import LanguageSwitcher from "./components/LanguageSwitcher";
import Sidebar from "./components/Sidebar";
import TopNavbar from "./components/TopNavbar";
import { getScenes } from "./i18n/scenes";
import { MAX_COMPARE_COUNTRIES } from "./lib/compareColors";
import { type Metric } from "./lib/metrics";
import FooterComposition from "../../shared/components/FooterComposition";
import MobileViewToggle from "../../shared/components/MobileViewToggle";
import LoginModal from "../../shared/components/LoginModal";
import SidebarShell from "../../shared/components/SidebarShell";
import { useMembership } from "../../shared/lib/useMembership";
import TourOverlay from "../../shared/tour/TourOverlay";
import { useTourState } from "../../shared/tour/useTourState";

interface Props {
  mode: PaletteMode;
  setMode: (mode: PaletteMode) => void;
}

const METRICS: Metric[] = ["capacity", "capacityPerCapita", "share"];
const TOUR_SEEN_KEY = "deployment-tour-seen";
const SIDEBAR_WIDTH = 460;

export default function App({ mode, setMode }: Props) {
  const { t, i18n } = useTranslation();
  // One three-way selector, not a view+basis pair - see the plan in
  // README.md. Replaced the old separate view/basis toggles 2026-09-09 per
  // Andrew's instruction. Defaults to "capacityPerCapita" (not "capacity")
  // per his follow-up instruction 2026-09-15 - the raw MW figure favours
  // large countries regardless of how much solar they've actually deployed
  // relative to their population, so per-capita is the more informative
  // first view.
  const [metric, setMetric] = useState<Metric>("capacityPerCapita");
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  // Compare mode's own added countries, alongside `selectedCountry` (the
  // primary/first column) - plain lifted `useState`, same pattern as every
  // other view-only field in this file, not a store (this app has none).
  // Added 2026-10-13 per Andrew's own instruction ("click a country, then
  // press a plus to add countries to the right hand side of the sidebar"),
  // replacing the old member-only aggregate multi-select outright.
  const [compareCountries, setCompareCountries] = useState<string[]>([]);
  // Picking a different primary country invalidates whatever was being
  // compared against the old one - mirrors ep_policymap's own `selectCountry`
  // store action (`src/stores/protocolStore.ts`), which clears
  // `compareCountries` the same way on reselect. Every call site that used
  // to pass `setSelectedCountry` directly (the map, both search boxes, the
  // tour) now goes through this instead.
  const handleSelectCountry = (code: string | null) => {
    setSelectedCountry(code);
    setCompareCountries([]);
  };
  const addCompareCountry = (code: string) => {
    setCompareCountries((codes) =>
      codes.includes(code) || codes.length >= MAX_COMPARE_COUNTRIES ? codes : [...codes, code],
    );
  };
  const removeCompareCountry = (code: string) => {
    setCompareCountries((codes) => codes.filter((c) => c !== code));
  };
  // The UN geoscheme sub-region filter - lifted up from Sidebar.tsx's own
  // local state (2026-10-14) so the map can see it too: picking one now
  // zooms the map to fit it, per Andrew's own instruction ("when we click
  // filter, it zooms in on the continent"). Single-sub-region-at-a-time
  // (`ContinentFilter`'s own `multiple={false}` below) rather than a
  // multi-select - zooming to fit the union of several scattered regions
  // doesn't read as "zoom in here" the way one does, per Andrew's own
  // follow-up ("this means we can only filter to one item at a time").
  // Switched from the six-continent list to the UN geoscheme's own finer
  // sub-regions the same day ("implement a filter not on continent but on
  // United Nations geoscheme") - see Sidebar.tsx's own `subregions` prop
  // doc comment for how that's threaded through.
  const [subregions, setSubregions] = useState<string[]>([]);
  // Same "page" concept as ep_policymap's own App.tsx, just local state
  // here rather than a store field - this app has nothing else that needs
  // to read or restore it.
  const [page, setPage] = useState<"map" | "help">("map");

  // The "Login" header button + its password popup - a client-side gate,
  // not real auth (see shared/lib/membership.ts's own doc comment), added
  // 2026-09-28 per Andrew's own instruction. `member` seeds from the same
  // cross-app localStorage flag dark mode already uses this pattern for -
  // logging in on a sibling app already unlocks this one on the next load.
  // Nothing in this app currently reads `member` to unlock content - its
  // own "Members only" charts (LockedMetricsSection.tsx) advertise metrics
  // with no real data source at all, not real content behind a paywall, so
  // they stay locked regardless (see TopNavbar.tsx's own doc comment).
  const { member, loginOpen, openLogin, closeLogin, onLoginSuccess } = useMembership();

  // Mobile layout, added 2026-09-10 - ported from Policy Explorer's own
  // App.tsx, which already handles this well: below `md`, the map and
  // sidebar can't sit side by side (the sidebar's own fixed desktop width
  // alone is wider than most phones), so they become a Map/List toggle
  // instead, switching between the same two full-screen views rather than
  // squeezing both onto the screen together.
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [mobileView, setMobileView] = useState<"map" | "list">("list");

  // Ported onto the shared `useTourState` (`shared/tour/`) 2026-09-19 -
  // the localStorage "seen once" flag, the hero-scene-hides-chrome
  // derivation, and the `?showTour=1`/`?skipIntro=1` URL-param wiring are
  // all the same behaviour, now shared with calculator's own new tour.
  const { tourOpen, openTour, dismissTour, setTourSceneId, heroScene } = useTourState(TOUR_SEEN_KEY);

  // Finishing (or skipping) the tour returns to a defined start position -
  // the whole map, nothing selected, the default metric - rather than
  // leaving the tour's own demo country (see scrollstory/scenes.ts's own
  // DEMO_COUNTRY) selected behind it. Per Andrew's own instruction
  // 2026-09-19 ("after the tour, as part of the defined process, we need
  // to go to a start position showing whole map, no country selected and
  // a particular ranking on the sidebar").
  const dismissTourToStart = () => {
    dismissTour();
    handleSelectCountry(null);
    setMetric("capacityPerCapita");
  };

  // Help and Tour now share one entry point (the header's own single "Help"
  // button, and this) - the hero scene's own "Read documentation" button,
  // per Andrew's own instruction 2026-09-20. Nothing in the hero scene has
  // run any `onEnter` side effect yet (only later scenes do), so this only
  // needs to mark the tour seen and switch pages.
  const openDocsFromTour = () => {
    dismissTour();
    setPage("help");
  };

  const map = (
    <DeploymentMap
      metric={metric}
      selectedCountry={selectedCountry}
      onCountryClick={handleSelectCountry}
      subregions={subregions}
      hideLegend={heroScene}
    />
  );
  const list = (
    <Sidebar
      metric={metric}
      selectedCountry={selectedCountry}
      onSelect={handleSelectCountry}
      isMobile={isMobile}
      member={member}
      compareCountries={compareCountries}
      onAddCompare={addCompareCountry}
      onRemoveCompare={removeCompareCountry}
      subregions={subregions}
      onSubregionsChange={setSubregions}
    />
  );
  const comparing = !isMobile && compareCountries.length > 0;

  return (
    <Box sx={{ height: "100dvh", width: "100%", overflowX: "hidden", display: "flex", flexDirection: "column" }}>
      {!heroScene && (
        <TopNavbar mode={mode} setMode={setMode} onOpenHelp={openTour} member={member} onOpenLogin={openLogin} />
      )}

      {page === "help" ? (
        <HelpPage onBack={() => setPage("map")} />
      ) : (
        <>
          {heroScene ? (
            <Box sx={{ flex: 1, position: "relative" }}>{map}</Box>
          ) : isMobile ? (
            selectedCountry ? (
              // A country's own detail page takes the full screen on
              // mobile - no room for a Map/List toggle on top of it too.
              <Box sx={{ flex: 1, overflow: "hidden" }}>{list}</Box>
            ) : (
              <Box sx={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                {/* Search sits left-aligned next to the Map/List toggle,
                    both in one row - moved here 2026-09-10 per Andrew's
                    instruction, off its own separate row above the
                    content. Works the same regardless of which of the two
                    views is showing underneath. */}
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
                  <CountrySearch selected={selectedCountry} onSelect={handleSelectCountry} />
                  <MobileViewToggle value={mobileView} onChange={setMobileView} listLabel={t("toggle.list")} mapLabel={t("toggle.map")} />
                </Box>
                <Divider />
                {mobileView === "map" ? (
                  <Box sx={{ flex: 1, minHeight: 0, position: "relative" }}>{map}</Box>
                ) : (
                  <Box sx={{ flex: 1, minHeight: 0, bgcolor: "background.paper", overflow: "hidden" }}>{list}</Box>
                )}
              </Box>
            )
          ) : comparing ? (
            // Compare mode gives the map up entirely, same trade
            // ep_policymap's own full-screen country view makes at a
            // smaller scale - up to 5 side-by-side panels need the width
            // far more than the map needs to stay visible next to them.
            // Added 2026-10-13 alongside the compare feature itself; falls
            // back to the normal split below the moment the comparator
            // list empties back to zero.
            <Box sx={{ flex: 1, overflow: "hidden" }}>{list}</Box>
          ) : (
            // Same map + sidebar layout as ep_policymap's own desktop
            // App.tsx - the map is a flex sibling of the sidebar, not an
            // overlay. Width and border live here, not in Sidebar.tsx
            // itself, since that component is shared with the mobile List
            // view above, which needs neither.
            <Box sx={{ flex: 1, display: "flex", overflow: "hidden" }}>
              <Box sx={{ flex: 1, position: "relative", minWidth: 0 }}>{map}</Box>
              <SidebarShell width={SIDEBAR_WIDTH}>{list}</SidebarShell>
            </Box>
          )}

          {/* Footer bar (and the mobile Ember row below it) - hidden through
              the tour's opening hero scene, same as Policy Explorer's own
              App.tsx hides its equivalent bar and top nav there, for an
              unobstructed view of the globe. */}
          {!heroScene && (
            <>
              {/* Footer bar - the metric selector and language switcher, same
                  role as ep_policymap's own bottom bar. The metric selector
                  used to persist here in every mobile state (List, Map, and
                  a country's own detail page alike) per Andrew's instruction
                  2026-09-10 - reversed 2026-09-18 ("when we click on a
                  country the toggle... should disappear"): it colours the
                  map, so once a country is selected (mobile's own full-screen
                  detail view, or the desktop sidebar open) it no longer
                  reflects anything on screen. Search itself stays
                  desktop-only here - on mobile it's always up next to the
                  Map/List toggle instead. Shell ported onto the shared
                  `FooterBar` 2026-09-19 - the same 48px height this app
                  already used, so zero visual change from this swap alone.
                  Composition (search/toggle/extra/language-switcher, in
                  that order) further ported onto the shared
                  `FooterComposition` the same day, per Andrew's own
                  instruction ("footer composition... should be the same
                  and common") - EmberBadge is this app's own `extra` slot,
                  the one thing policy/calculator have none of. */}
              <FooterComposition
                search={!isMobile && <CountrySearch selected={selectedCountry} onSelect={handleSelectCountry} />}
                toggle={
                  // Hidden once a country is selected, per Andrew's own
                  // instruction 2026-09-18 ("when we click on a country the
                  // toggle... on the footer should disappear") - it colours
                  // the map, which isn't visible any more on mobile once the
                  // sidebar takes the full screen, and on desktop it no
                  // longer reflects anything the sidebar's own content is
                  // about.
                  !selectedCountry && (
                    <ToggleButtonGroup
                      data-tour="metric-selector"
                      size="small"
                      exclusive
                      value={metric}
                      onChange={(_, v) => v && setMetric(v)}
                    >
                      {METRICS.map((m) => (
                        <ToggleButton key={m} value={m} sx={{ py: 0.25, px: 1.5, fontSize: "0.7rem" }}>
                          {isMobile ? t(`metricsShort.${m}`) : t(`metrics.${m}`)}
                        </ToggleButton>
                      ))}
                    </ToggleButtonGroup>
                  )
                }
                // Moved here from TopNavbar's desktop header row 2026-09-15
                // per Andrew's instruction - sits directly left of the
                // language switcher instead. Desktop only; mobile keeps its
                // own separate EmberBadge row below this footer (unchanged,
                // see below).
                extra={!isMobile && <EmberBadge />}
                languageSwitcher={<LanguageSwitcher />}
              />

              {/* Ember credit, mobile only - moved here 2026-09-10 from its own
                  row below the header (added there earlier the same day) per
                  Andrew's follow-up instruction: a second row under the
                  footer instead, left-aligned same as before. Desktop keeps
                  its own copy inline in TopNavbar.tsx's header row - never
                  both at once. */}
              {isMobile && (
                <EmberBadge
                  sx={{
                    px: 2,
                    py: 0.75,
                    bgcolor: "background.paper",
                    borderTop: "1px solid",
                    borderColor: "divider",
                  }}
                />
              )}
            </>
          )}

          {tourOpen && (
            <TourOverlay
              scenes={getScenes(i18n.language, handleSelectCountry)}
              onDismiss={dismissTourToStart}
              onSceneChange={setTourSceneId}
              onReadDocs={openDocsFromTour}
              labels={{
                scrollToBegin: t("scrollStory.scrollToBegin"),
                previous: t("scrollStory.previous"),
                next: t("scrollStory.next"),
                skipIntro: t("scrollStory.skipIntro"),
                startExploring: t("scrollStory.startExploring"),
                readDocs: t("scrollStory.readDocs"),
              }}
              heroFooter={
                <>
                  {t("byGsc")}&ensp;·&ensp;
                  <Box component="span" sx={{ color: "#FBB114", fontStyle: "italic", fontWeight: 600 }}>
                    {t("tagline")}
                  </Box>
                </>
              }
            />
          )}
        </>
      )}

      <LoginModal open={loginOpen} onClose={closeLogin} onSuccess={onLoginSuccess} />
    </Box>
  );
}
