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
import { type Metric } from "./lib/metrics";
import FooterComposition from "../../shared/components/FooterComposition";
import SidebarShell from "../../shared/components/SidebarShell";
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
  // Same "page" concept as ep_policymap's own App.tsx, just local state
  // here rather than a store field - this app has nothing else that needs
  // to read or restore it.
  const [page, setPage] = useState<"map" | "help">("map");

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
    setSelectedCountry(null);
    setMetric("capacityPerCapita");
  };

  const map = (
    <DeploymentMap
      metric={metric}
      selectedCountry={selectedCountry}
      onCountryClick={setSelectedCountry}
      hideLegend={heroScene}
    />
  );
  const list = (
    <Sidebar metric={metric} selectedCountry={selectedCountry} onSelect={setSelectedCountry} isMobile={isMobile} />
  );

  return (
    <Box sx={{ height: "100dvh", width: "100%", overflowX: "hidden", display: "flex", flexDirection: "column" }}>
      {!heroScene && (
        <TopNavbar mode={mode} setMode={setMode} page={page} setPage={setPage} onStartTour={openTour} />
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
                  <CountrySearch selected={selectedCountry} onSelect={setSelectedCountry} />
                  <ToggleButtonGroup
                    size="small"
                    exclusive
                    value={mobileView}
                    onChange={(_, next) => next && setMobileView(next)}
                  >
                    <ToggleButton value="list" sx={{ py: 0.25, px: 1.5, fontSize: "0.75rem" }}>
                      {t("toggle.list")}
                    </ToggleButton>
                    <ToggleButton value="map" sx={{ py: 0.25, px: 1.5, fontSize: "0.75rem" }}>
                      {t("toggle.map")}
                    </ToggleButton>
                  </ToggleButtonGroup>
                </Box>
                <Divider />
                {mobileView === "map" ? (
                  <Box sx={{ flex: 1, minHeight: 0, position: "relative" }}>{map}</Box>
                ) : (
                  <Box sx={{ flex: 1, minHeight: 0, bgcolor: "background.paper", overflow: "hidden" }}>{list}</Box>
                )}
              </Box>
            )
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
                search={!isMobile && <CountrySearch selected={selectedCountry} onSelect={setSelectedCountry} />}
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
              scenes={getScenes(i18n.language, setSelectedCountry)}
              onDismiss={dismissTourToStart}
              onSceneChange={setTourSceneId}
              labels={{
                scrollToBegin: t("scrollStory.scrollToBegin"),
                previous: t("scrollStory.previous"),
                next: t("scrollStory.next"),
                skipIntro: t("scrollStory.skipIntro"),
                startExploring: t("scrollStory.startExploring"),
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
    </Box>
  );
}
