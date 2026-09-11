import { useEffect, useState } from "react";
import { Box, Divider, ToggleButton, ToggleButtonGroup, useMediaQuery, useTheme } from "@mui/material";
import type { PaletteMode } from "@mui/material/styles";

import CountrySearch from "./components/CountrySearch";
import DeploymentMap from "./components/DeploymentMap";
import EmberBadge from "./components/EmberBadge";
import HelpPage from "./components/HelpPage";
import LanguageSwitcher from "./components/LanguageSwitcher";
import Sidebar from "./components/Sidebar";
import TopNavbar from "./components/TopNavbar";
import ScrollStory from "./scrollstory/ScrollStory";
import { METRIC_LABELS, METRIC_SHORT_LABELS, type Metric } from "./lib/metrics";

interface Props {
  mode: PaletteMode;
  setMode: (mode: PaletteMode) => void;
}

const METRICS: Metric[] = ["capacity", "capacityPerCapita", "share"];
const TOUR_SEEN_KEY = "deployment-tour-seen";
const SIDEBAR_WIDTH = 460;

export default function App({ mode, setMode }: Props) {
  // One three-way selector, not a view+basis pair - see the plan in
  // README.md. Replaced the old separate view/basis toggles 2026-09-09 per
  // Andrew's instruction.
  const [metric, setMetric] = useState<Metric>("capacity");
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

  // Opens automatically on a visitor's first-ever visit, tracked in
  // localStorage rather than a store field (this app has no persisted
  // store) - same "seen once" idea as Policy Explorer's own `tourSeen`,
  // just a plain flag rather than something read/restored elsewhere.
  const [tourOpen, setTourOpen] = useState(false);
  useEffect(() => {
    if (!localStorage.getItem(TOUR_SEEN_KEY)) setTourOpen(true);
  }, []);
  const dismissTour = () => {
    setTourOpen(false);
    localStorage.setItem(TOUR_SEEN_KEY, "1");
  };

  // The tour's opening scene wants an unobstructed globe, same as Policy
  // Explorer's own `onboardingHero` - added 2026-09-11, this app didn't
  // have it before (the sidebar/nav/footer stayed on screen through the
  // hero scene, which Andrew flagged as inconsistent with Policy Explorer
  // once he noticed the difference). `tourSceneId` is reported up from
  // ScrollStory via `onSceneChange`; scene 0 is always the hero layout
  // (see scrollstory/scenes.ts).
  const [tourSceneId, setTourSceneId] = useState(0);
  const heroScene = tourOpen && tourSceneId === 0;

  // A link into the app can force the tour open even for a returning
  // visitor - same ?showTour=1 param and param-stripping pattern as Policy
  // Explorer's own App.tsx, used by the Playbook homepage's "Show me how"
  // button.
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("showTour")) return;
    setTourOpen(true);
    const url = new URL(window.location.href);
    url.searchParams.delete("showTour");
    window.history.replaceState({}, "", url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The inverse - marks the tour as already seen without opening it, so a
  // first-ever visitor arriving via the Playbook's "Click to explore" link
  // doesn't get the tour anyway despite never having seen it. Same
  // ?skipIntro=1 param Policy Explorer's own "Click to explore" link uses.
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("skipIntro")) return;
    setTourOpen(false);
    localStorage.setItem(TOUR_SEEN_KEY, "1");
    const url = new URL(window.location.href);
    url.searchParams.delete("skipIntro");
    window.history.replaceState({}, "", url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const map = (
    <DeploymentMap
      metric={metric}
      selectedCountry={selectedCountry}
      onCountryClick={setSelectedCountry}
      hideLegend={heroScene}
    />
  );
  const list = <Sidebar metric={metric} selectedCountry={selectedCountry} onSelect={setSelectedCountry} />;

  return (
    <Box sx={{ height: "100dvh", width: "100%", overflowX: "hidden", display: "flex", flexDirection: "column" }}>
      {!heroScene && (
        <TopNavbar mode={mode} setMode={setMode} page={page} setPage={setPage} onStartTour={() => setTourOpen(true)} />
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
              <Box sx={{ width: SIDEBAR_WIDTH, flexShrink: 0, borderLeft: "1px solid", borderColor: "divider" }}>
                {list}
              </Box>
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
                  persists here in every mobile state (List, Map, and a
                  country's own detail page alike) per Andrew's instruction
                  2026-09-10 - it's cheap to keep around since, with search
                  moved up next to the Map/List toggle (see above), this is the
                  only other control in the footer on mobile, so there's no
                  overlap risk the way there was when search used to share this
                  bar too. Search itself stays desktop-only here - on mobile
                  it's always up next to the toggle instead. */}
              <Box
                sx={{
                  flexShrink: 0,
                  height: 48,
                  bgcolor: "background.paper",
                  borderTop: "1px solid",
                  borderColor: "divider",
                  display: "flex",
                  alignItems: "center",
                  px: 2,
                  gap: 1.5,
                }}
              >
                {!isMobile && <CountrySearch selected={selectedCountry} onSelect={setSelectedCountry} />}

                <ToggleButtonGroup
                  data-tour="metric-selector"
                  size="small"
                  exclusive
                  value={metric}
                  onChange={(_, v) => v && setMetric(v)}
                >
                  {METRICS.map((m) => (
                    <ToggleButton key={m} value={m} sx={{ py: 0.25, px: 1.5, fontSize: "0.7rem" }}>
                      {isMobile ? METRIC_SHORT_LABELS[m] : METRIC_LABELS[m]}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>

                <Box sx={{ flex: 1 }} />
                <LanguageSwitcher />
              </Box>

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
            <ScrollStory onDismiss={dismissTour} onSelectCountry={setSelectedCountry} onSceneChange={setTourSceneId} />
          )}
        </>
      )}
    </Box>
  );
}
