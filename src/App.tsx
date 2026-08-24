import { useMemo, useState } from "react";
import { Box, Divider, ToggleButton, ToggleButtonGroup, useMediaQuery, useTheme } from "@mui/material";

import AdminConsole from "./components/layout/AdminConsole";
import CompareView from "./components/layout/CompareView";
import CountryPanel from "./components/layout/CountryPanel";
import HelpPage from "./components/layout/HelpPage";
import Scoreboard from "./components/layout/Scoreboard";
import TopNavbar from "./components/layout/TopNavbar";
import WelcomeModal from "./components/ui/WelcomeModal";
import LanguageSwitcher from "./components/ui/LanguageSwitcher";
import PolicyMap from "./components/map/PolicyMap";
import JurisdictionSearch from "./components/map/JurisdictionSearch";
import ScrollStory from "./scrollstory/ScrollStory";
import { sourcedCountries } from "./data/sourcedAnswers";
import { qualifiedName, resolveTargets } from "./lib/jurisdictions";
import { scoreCountry } from "./lib/scoring";
import { protocol, useProtocolStore } from "./stores/protocolStore";

const PANEL_WIDTH = 460;

export default function App() {
  const questions = useProtocolStore((s) => s.questions);
  const responses = useProtocolStore((s) => s.responses);
  const threshold = useProtocolStore((s) => s.threshold);
  const mapMetric = useProtocolStore((s) => s.mapMetric);
  const setMapMetric = useProtocolStore((s) => s.setMapMetric);
  const welcomeSeen = useProtocolStore((s) => s.welcomeSeen);
  const setWelcomeSeen = useProtocolStore((s) => s.setWelcomeSeen);
  const tourSeen = useProtocolStore((s) => s.tourSeen);
  const setTourSeen = useProtocolStore((s) => s.setTourSeen);
  const countryPanelTab = useProtocolStore((s) => s.countryPanelTab);
  const setCountryPanelTab = useProtocolStore((s) => s.setCountryPanelTab);
  // The tour's opening scene is a clean, full-bleed globe - the sidebar list
  // would otherwise show straight through the overlay's mostly-transparent
  // middle. Only tracked while the tour is up; irrelevant once dismissed.
  const [tourSceneId, setTourSceneId] = useState(0);
  const hideSidebarForTour = !tourSeen && tourSceneId === 0;
  // The map's "solar bloom" intro animation (see PolicyMap's introBloom prop)
  // runs through the tour's opening scene and stays up behind the Charter if
  // that follows straight on from it, so the two feel like one continuous
  // opening - but only ever for that one first-run stretch. Once the Charter
  // has actually been dismissed for the first time, this turns off for good;
  // "About" reopening the Charter later must not re-trigger it.
  const [bloomActive, setBloomActive] = useState(true);
  if (bloomActive && welcomeSeen) setBloomActive(false);
  const introBloom = bloomActive && (hideSidebarForTour || (!welcomeSeen && tourSeen));
  // Desktop-only, view preference like `comparing` - not persisted, and
  // irrelevant on the mobile stacked layout, which has no side-by-side
  // sidebar to collapse in the first place.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const page = useProtocolStore((s) => s.page);
  const setPage = useProtocolStore((s) => s.setPage);
  const selectedCountry = useProtocolStore((s) => s.selectedCountry);
  const selectCountry = useProtocolStore((s) => s.selectCountry);
  const comparing = useProtocolStore((s) => s.comparing);
  const setComparing = useProtocolStore((s) => s.setComparing);
  const compareCountry = useProtocolStore((s) => s.compareCountry);
  const setCompareCountry = useProtocolStore((s) => s.setCompareCountry);

  // Picking a jurisdiction - from the map, the search box or the scoreboard -
  // always means "show me that jurisdiction", so it backs out of the admin
  // console too.
  const handleSelectCountry = (code: string | null) => {
    setPage("map");
    selectCountry(code);
  };

  // Every jurisdiction with an answer, plus the ones the spreadsheet shipped
  // with, so an empty Sri Lanka is still visible as something to fill in.
  // Countries that have been subdivided resolve to their states, since those
  // are what the map actually draws. The compare pick is added the same way
  // the primary selection is - a jurisdiction with no data at all can still
  // be chosen to compare against, and needs a CountryScore to render.
  const scores = useMemo(() => {
    const codes = new Set<string>(
      protocol.countries.flatMap((c) => resolveTargets(c.code)),
    );
    for (const code of sourcedCountries()) codes.add(code);
    for (const r of responses) codes.add(r.countryCode);
    if (selectedCountry) codes.add(selectedCountry);
    if (compareCountry) codes.add(compareCountry);

    return [...codes].map((code) =>
      scoreCountry(protocol, questions, responses, code, qualifiedName(code), threshold),
    );
  }, [questions, responses, selectedCountry, compareCountry, threshold]);

  const selectedScore = scores.find((s) => s.code === selectedCountry) ?? null;

  const theme = useTheme();
  // Side by side stops fitting a phone screen well before the map itself
  // becomes unusable, so below `md` the layout stacks instead: map on top,
  // list below. A selected country goes full-screen there rather than also
  // being squeezed into the stack - CountryPanel's own question cards and
  // tabs need more room than a phone split three ways could give them.
  // Compare mode needs two of those full panels side by side, so it is
  // desktop-only for the same reason - there is no offer to compare on
  // mobile, rather than an unusable cramped version of it.
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const map = (
    <PolicyMap
      scores={scores}
      metric={mapMetric}
      selectedCountry={selectedCountry}
      onCountryClick={handleSelectCountry}
      hideLegend={hideSidebarForTour}
      introBloom={introBloom}
    />
  );

  const list =
    selectedCountry && selectedScore ? (
      <CountryPanel
        code={selectedCountry}
        score={selectedScore}
        onBack={() => handleSelectCountry(null)}
        tab={countryPanelTab}
        onTabChange={setCountryPanelTab}
        inlineCompare
        allScores={scores}
      />
    ) : (
      <Scoreboard scores={scores} selectedCountry={selectedCountry} onSelect={handleSelectCountry} />
    );

  return (
    <Box sx={{ height: "100vh", width: "100vw", display: "flex", flexDirection: "column" }}>
      {/* Hidden on the tour's opening scene too - an unobstructed view of
          the coloured globe, matching the sibling gridsim-frontend
          project's own clean opening scene. */}
      {!hideSidebarForTour && <TopNavbar />}

      {!tourSeen && (
        <ScrollStory
          onDismiss={() => {
            setTourSeen(true);
            // Skipping mid-tour would otherwise leave whichever country the
            // last scene had selected open behind the overlay - the tour
            // always ends back at the plain world view, same as reaching the
            // closing scene naturally does.
            selectCountry(null);
          }}
          onSceneChange={setTourSceneId}
          onOpenCharter={() => {
            setTourSeen(true);
            selectCountry(null);
            setWelcomeSeen(false);
          }}
        />
      )}

      {/* The Charter only shows once the tour has been dismissed - showing
          both full-screen takeovers stacked on a first visit would bury the
          tour's own dismiss controls under the modal. */}
      <WelcomeModal open={!welcomeSeen && tourSeen} onClose={() => setWelcomeSeen(true)} />

      {hideSidebarForTour ? (
        <Box sx={{ flex: 1, position: "relative" }}>{map}</Box>
      ) : page === "admin" || page === "help" ? (
        // Full takeover - there is nothing useful to keep the map visible
        // for while editing question definitions, settings, or reading help.
        <Box sx={{ flex: 1, overflow: "hidden" }}>
          {page === "admin" ? (
            <AdminConsole onBack={() => setPage("map")} />
          ) : (
            <HelpPage onBack={() => setPage("map")} />
          )}
        </Box>
      ) : comparing && !isMobile && selectedCountry && selectedScore ? (
        // Comparing gives up the map entirely too - two full country pages
        // need the width more than the map needs to stay visible, the same
        // trade the single detail view already makes at a smaller scale.
        <Box sx={{ flex: 1, overflow: "hidden" }}>
          <CompareView
            scores={scores}
            primaryCode={selectedCountry}
            primaryScore={selectedScore}
            compareCode={compareCountry}
            onHideCompare={() => setComparing(false)}
            onBackToScoreboard={() => handleSelectCountry(null)}
            onPickCompare={setCompareCountry}
            onRemoveCompare={() => setCompareCountry(null)}
          />
        </Box>
      ) : isMobile ? (
        selectedCountry && selectedScore ? (
          <Box sx={{ flex: 1, overflow: "hidden" }}>{list}</Box>
        ) : (
          <Box sx={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <Box sx={{ height: "42vh", flexShrink: 0, position: "relative" }}>{map}</Box>
            <Divider />
            <Box sx={{ flex: 1, minHeight: 0, bgcolor: "#ffffff", overflow: "hidden" }}>
              {list}
            </Box>
          </Box>
        )
      ) : (
        <Box sx={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* The map gives up two thirds of the width once a country is open:
              answering questions needs the room, browsing the map does not. */}
          <Box
            sx={{
              flex: sidebarCollapsed ? 1 : selectedCountry ? 1 : 2,
              position: "relative",
              minWidth: 0,
            }}
          >
            {map}
          </Box>

          {!sidebarCollapsed && <Divider orientation="vertical" flexItem />}

          {/* overflow:visible so the collapse tab (absolutely positioned,
              poking out to the left) stays visible even once this panel's
              own width animates down to 0 - same two-layer trick as the
              sibling gridsim-frontend project's results panel: an inner
              wrapper clips the panel's own content, the outer box does not
              clip the tab. */}
          <Box
            sx={{
              flex: sidebarCollapsed ? "0 0 0px" : selectedCountry ? 2 : "0 0 auto",
              width: sidebarCollapsed ? 0 : selectedCountry ? "auto" : PANEL_WIDTH,
              minWidth: 0,
              position: "relative",
              overflow: "visible",
              transition: "width 300ms ease",
            }}
          >
            <Box
              onClick={() => setSidebarCollapsed((v) => !v)}
              title={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
              sx={{
                position: "absolute",
                left: -20,
                top: "50%",
                transform: "translateY(-50%)",
                zIndex: 20,
                width: 20,
                height: 56,
                bgcolor: "#ffffff",
                border: "1px solid",
                borderColor: "divider",
                borderRight: "none",
                borderRadius: "6px 0 0 6px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                boxShadow: "-2px 0 6px rgba(0,0,0,0.06)",
                "&:hover": { bgcolor: "grey.50" },
                transition: "background-color 150ms ease",
              }}
            >
              <Box component="span" sx={{ fontSize: "0.65rem", color: "text.secondary", lineHeight: 1, userSelect: "none" }}>
                {sidebarCollapsed ? "‹" : "›"}
              </Box>
            </Box>

            <Box
              sx={{
                width: "100%",
                height: "100%",
                bgcolor: "#ffffff",
                display: sidebarCollapsed ? "none" : "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              {list}
            </Box>
          </Box>
        </Box>
      )}

      {/* Full-width bar, mirrors the country-select + language bar from the
          sibling gridsim-frontend project - a page-level sibling of the
          map/sidebar content, not scoped to the map panel, so it spans the
          whole viewport regardless of whether a sidebar is open next to it.
          Hidden on the tour's opening scene along with the top bar and
          legend. */}
      {!hideSidebarForTour && (
      <Box
        sx={{
          flexShrink: 0,
          height: 48,
          bgcolor: "grey.100",
          borderTop: "1px solid",
          borderColor: "divider",
          display: "flex",
          alignItems: "center",
          px: 2,
          gap: 1.5,
        }}
      >
        <Box sx={{ width: 280, maxWidth: "60%" }}>
          <JurisdictionSearch scores={scores} selected={selectedCountry} onSelect={handleSelectCountry} />
        </Box>

        {/* What the map paints - moved here from the legend card so the
            legend only ever displays the current choice, rather than also
            being where it's made. */}
        <ToggleButtonGroup
          size="small"
          exclusive
          value={mapMetric}
          onChange={(_, next) => next && setMapMetric(next)}
        >
          <ToggleButton value="score" sx={{ py: 0.25, px: 2, fontSize: "0.7rem" }}>
            Score
          </ToggleButton>
          <ToggleButton value="completeness" sx={{ py: 0.25, px: 2, fontSize: "0.7rem" }}>
            Completeness
          </ToggleButton>
        </ToggleButtonGroup>

        <Box sx={{ flex: 1 }} />
        <LanguageSwitcher />
      </Box>
      )}
    </Box>
  );
}
