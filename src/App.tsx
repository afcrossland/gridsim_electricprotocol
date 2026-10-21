import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Collapse, Divider, ToggleButton, ToggleButtonGroup, useMediaQuery, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";

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
import FooterComposition from "../shared/components/FooterComposition";
import SidebarShell from "../shared/components/SidebarShell";
import { sourcedCountries } from "./data/sourcedAnswers";
import { qualifiedName, resolveTargets } from "./lib/jurisdictions";
import { scoreCountry } from "./lib/scoring";
import { protocol, useProtocolStore } from "./stores/protocolStore";

const PANEL_WIDTH = 460;

/**
 * Applies the three launch URL params once, at module load - before the
 * first render, so the tour never mounts at all on a link that skips it.
 * These used to be mount effects, which raced the tour: on a first visit the
 * tour mounted alongside them, and its opening scene's own
 * `selectCountry(null)` could land after `?country` had selected one. Under
 * StrictMode's double effect run in dev it always did, since the re-run of
 * App's effect found the param already stripped.
 *
 * - `?skipIntro` - a link from somewhere that already framed the app (e.g.
 *   the Electric Futures Playbook) marks the tour as seen.
 * - `?showTour` - the inverse, e.g. the playbook's "Show me how": opens the
 *   tour even for a returning visitor.
 * - `?country=CODE` (plus optional `&section=<section id>`) - opens
 *   straight into that country's page, and that policy area if given (e.g.
 *   the Deployment Explorer's cross-link tiles), implicitly skipping the
 *   tour too: a reader who arrives already knowing which country they want
 *   doesn't need the first-run framing.
 *
 * skipIntro/showTour are stripped right after, so a reload or reshare
 * doesn't carry them along. country/section stay: they're the app's own
 * shareable location, kept in step by useLocationSync below. Returns
 * whether the intro was skipped, which also turns off the tour's "solar
 * bloom" opening.
 */
function applyLaunchParams(): { skipsIntro: boolean } {
  const url = new URL(window.location.href);
  const params = url.searchParams;
  const store = useProtocolStore.getState();
  const country = params.get("country");
  const skipsIntro = params.has("skipIntro") || Boolean(country);
  if (skipsIntro) store.setTourSeen(true);
  else if (params.has("showTour")) store.setTourSeen(false);
  if (country) {
    store.setPage("map");
    applyLocation(params);
  }
  if (params.has("skipIntro") || params.has("showTour")) {
    params.delete("skipIntro");
    params.delete("showTour");
    window.history.replaceState({}, "", url);
  }
  return { skipsIntro };
}

/** Selects the country (and section, if it's a real one) a URL's params name. */
function applyLocation(params: URLSearchParams) {
  const store = useProtocolStore.getState();
  const country = params.get("country");
  store.selectCountry(country ? country.toUpperCase() : null);
  const section = params.get("section");
  if (country && section && store.sections.some((s) => s.id === section)) store.setActiveSectionId(section);
}

/** The URL for a selection - the current one with only country/section changed. */
function locationUrl(country: string | null, section: string): string {
  const url = new URL(window.location.href);
  url.searchParams.delete("country");
  url.searchParams.delete("section");
  if (country) url.searchParams.set("country", country);
  if (country && section) url.searchParams.set("section", section);
  return url.toString();
}

const launch = applyLaunchParams();

/**
 * Keeps `?country=&section=` in step with what's open, so a country or
 * policy area can be linked to and the browser's back button steps back
 * through them. Each change pushes a history entry; Back/Forward re-apply
 * the URL they land on. Off during the tour, which drives the selection
 * itself and always ends back at the plain world view.
 */
function useLocationSync(enabled: boolean) {
  const selectedCountry = useProtocolStore((s) => s.selectedCountry);
  const activeSectionId = useProtocolStore((s) => s.activeSectionId);

  // The first sync only normalises the URL the page opened with (e.g. a
  // lowercase ?country=de) rather than adding a history entry for it.
  const synced = useRef(false);
  useEffect(() => {
    if (!enabled) return;
    const next = locationUrl(selectedCountry, activeSectionId);
    if (next !== window.location.href) window.history[synced.current ? "pushState" : "replaceState"]({}, "", next);
    synced.current = true;
  }, [enabled, selectedCountry, activeSectionId]);

  useEffect(() => {
    if (!enabled) return;
    const onPop = () => applyLocation(new URLSearchParams(window.location.search));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [enabled]);
}

export default function App() {
  const { t, i18n } = useTranslation();
  const questions = useProtocolStore((s) => s.questions);
  const responses = useProtocolStore((s) => s.responses);
  const threshold = useProtocolStore((s) => s.threshold);
  const mapMetric = useProtocolStore((s) => s.mapMetric);
  const setMapMetric = useProtocolStore((s) => s.setMapMetric);
  const welcomeSeen = useProtocolStore((s) => s.welcomeSeen);
  const setWelcomeSeen = useProtocolStore((s) => s.setWelcomeSeen);
  const tourSeen = useProtocolStore((s) => s.tourSeen);
  useLocationSync(tourSeen);
  const tourSectionId = useProtocolStore((s) => s.tourSectionId);
  const setTourSectionId = useProtocolStore((s) => s.setTourSectionId);
  const setTourSeen = useProtocolStore((s) => s.setTourSeen);
  // The tour's opening scene is a clean, full-bleed globe - the sidebar list
  // would otherwise show straight through the overlay's mostly-transparent
  // middle. Only tracked while the tour is up; irrelevant once dismissed.
  const [tourSceneId, setTourSceneId] = useState(0);
  const heroScene = !tourSeen && tourSceneId === 0;
  // True through the tour's opening scene AND through the Charter modal
  // immediately after it, so the two read as one continuous opening rather
  // than the chrome (top bar, bottom toolbar, legend, sidebar) popping back
  // in and out between them - the "solar bloom" map animation, and every
  // other bit of hero-scene chrome-hiding below, are gated on this same
  // flag. Only ever true for that one first-run stretch: once the Charter
  // has actually been dismissed for the first time, `bloomActive` turns off
  // for good, so "About" reopening the Charter later behaves normally
  // (chrome stays visible, no bloom).
  const [bloomActive, setBloomActive] = useState(!launch.skipsIntro);
  // Edge-detected, not "is welcomeSeen true" as a static condition - that
  // would immediately re-latch bloomActive back off on every render once
  // welcomeSeen has ever been true, which defeats re-arming it below.
  // Instead: turn off exactly when the Charter is actually dismissed (false
  // -> true), and turn back on exactly when the tour is (re)launched (true
  // -> false) - "Take the tour" in the nav can do that at any point, long
  // after the very first run, and that replay should look the same as the
  // original one rather than showing the map's normal colours and chrome
  // through it.
  const wasTourSeen = useRef(tourSeen);
  const wasWelcomeSeen = useRef(welcomeSeen);
  useEffect(() => {
    if (wasTourSeen.current && !tourSeen) {
      setBloomActive(true);
    } else if (!wasWelcomeSeen.current && welcomeSeen && tourSeen) {
      // Only once the tour has actually ended - dismissing the Charter
      // while it was opened on top of the still-running hero scene (the
      // pill, not About) just returns to the tour, so bloom stays armed.
      setBloomActive(false);
    }
    wasTourSeen.current = tourSeen;
    wasWelcomeSeen.current = welcomeSeen;
  }, [tourSeen, welcomeSeen]);
  const onboardingHero = bloomActive && (heroScene || (!welcomeSeen && tourSeen));

  // Desktop-only, view preference like `comparing` - not persisted, and
  // irrelevant on the mobile stacked layout, which has no side-by-side
  // sidebar to collapse in the first place.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // Mobile-only: map and list used to be stacked (a short map permanently
  // eating the top of the screen), which left too little room for either -
  // a toggle between the two full-height existing views instead, list first
  // since browsing the ranked list is the more common way in.
  const [mobileView, setMobileView] = useState<"map" | "list">("list");
  const [listScrolled, setListScrolled] = useState(false);
  const page = useProtocolStore((s) => s.page);
  const setPage = useProtocolStore((s) => s.setPage);
  const selectedCountry = useProtocolStore((s) => s.selectedCountry);
  const selectCountry = useProtocolStore((s) => s.selectCountry);
  const comparing = useProtocolStore((s) => s.comparing);
  const setComparing = useProtocolStore((s) => s.setComparing);
  const compareCountries = useProtocolStore((s) => s.compareCountries);
  const addCompareCountry = useProtocolStore((s) => s.addCompareCountry);
  const clearCompareCountries = useProtocolStore((s) => s.clearCompareCountries);

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
    for (const code of compareCountries) codes.add(code);

    return [...codes].map((code) =>
      scoreCountry(protocol, questions, responses, code, qualifiedName(code, i18n.language), threshold),
    );
  }, [questions, responses, selectedCountry, compareCountries, threshold, i18n.language]);

  const selectedScore = scores.find((s) => s.code === selectedCountry) ?? null;

  // With a policy area open on a country's page, the map recolours every
  // jurisdiction by that one area's score - "who does Grid Connection
  // well" at a glance, beside the country being read. Not during the tour,
  // which drives its own sections through tourSectionId instead.
  const sections = useProtocolStore((s) => s.sections);
  const activeSectionId = useProtocolStore((s) => s.activeSectionId);
  const mapSection = selectedCountry && tourSeen ? (sections.find((s) => s.id === activeSectionId) ?? null) : null;
  const mapScores = useMemo(() => {
    if (!mapSection) return scores;
    const sectionQuestions = questions.filter((q) => q.sectionId === mapSection.id);
    return scores.map((s) => scoreCountry(protocol, sectionQuestions, responses, s.code, s.name, threshold));
  }, [mapSection, scores, questions, responses, threshold]);

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
  // True whenever the mobile Map/List toggle itself is showing (as opposed
  // to a country's own full-screen page). The bottom bar's search box moved
  // to the same spot above the content in both of those views, so it's
  // hidden down here the whole time the toggle is active; the
  // Score/Completeness choice only affects the map, so it stays hidden only
  // for the List side of the toggle specifically.
  const mobileToggleActive = isMobile && !(selectedCountry && selectedScore);
  const mobileListActive = mobileToggleActive && mobileView === "list";

  const map = (
    <PolicyMap
      scores={mapScores}
      // The Score/Completeness toggle is hidden on a country's page, so a
      // section view always paints the section's score.
      metric={mapSection ? "score" : mapMetric}
      sectionTitle={mapSection?.title}
      selectedCountry={selectedCountry}
      onCountryClick={handleSelectCountry}
      hideLegend={onboardingHero}
      introBloom={onboardingHero}
    />
  );

  const list =
    selectedCountry && selectedScore ? (
      <CountryPanel
        code={selectedCountry}
        score={selectedScore}
        onBack={() => handleSelectCountry(null)}
        inlineCompare
        allScores={scores}
        onSelectCountry={handleSelectCountry}
        // Only controlled while the tour is actually running - see
        // protocolStore.ts's own doc comment on `tourSectionId` for why a
        // scene needs to force a section open, and setTourSectionId's
        // reset-to-null on every selectCountry call for why this reverts
        // to CountryPanel's own uncontrolled tile-click state cleanly once
        // the tour ends or a different country is picked.
        {...(!tourSeen ? { sectionId: tourSectionId ?? "", onSectionChange: setTourSectionId } : {})}
      />
    ) : (
      <Scoreboard
        scores={scores}
        selectedCountry={selectedCountry}
        onSelect={handleSelectCountry}
        hideHeading={isMobile}
        onScrollTopChange={setListScrolled}
      />
    );

  return (
    <Box sx={{ height: "100dvh", width: "100%", overflowX: "hidden", display: "flex", flexDirection: "column" }}>
      {/* Hidden through the tour's opening scene and the Charter that
          follows it - an unobstructed view of the coloured globe, matching
          the sibling gridsim-frontend project's own clean opening scene. */}
      {!onboardingHero && <TopNavbar />}

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
            selectCountry(null);
            setWelcomeSeen(false);
          }}
          // Tour and Help now share one entry point (the nav's own single
          // "Help" button, and this) - per Andrew's own instruction
          // 2026-09-20. Ends the tour exactly like `onDismiss` (back to the
          // plain world view, nothing selected) and opens the Help page
          // instead of leaving the map showing.
          onReadDocs={() => {
            setTourSeen(true);
            selectCountry(null);
            setPage("help");
          }}
          // Suspends the tour's own wheel/keyboard scene-navigation while
          // the Charter is open on top of it, so scrolling the Charter's
          // own long text does not also drive the tour underneath.
          paused={!welcomeSeen}
        />
      )}

      {/* Opening the Charter from the hero's own "Read the Citizens..."
          pill does not end the tour - it opens on top of it, and dismissing
          it (Return) lands back on the tour exactly where it was, not on
          the plain map. Reaching the Charter any other way (About, or the
          tour's own natural end) has already set tourSeen, so this is the
          one open condition either way. */}
      <WelcomeModal open={!welcomeSeen} onClose={() => setWelcomeSeen(true)} />

      {onboardingHero ? (
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
            // This legacy full-screen view only ever shows one comparator -
            // see CompareView.tsx's own doc comment. Not reachable from the
            // UI (nothing calls setComparing(true) any more), kept
            // compiling against the new multi-compare array rather than
            // deleted, same as before.
            compareCode={compareCountries[0] ?? null}
            onHideCompare={() => setComparing(false)}
            onBackToScoreboard={() => handleSelectCountry(null)}
            onPickCompare={(code) => {
              clearCompareCountries();
              addCompareCountry(code);
            }}
            onRemoveCompare={() => clearCompareCountries()}
          />
        </Box>
      ) : !isMobile && selectedCountry && selectedScore ? (
        // A selected country took the whole content area for a while
        // (2026-10-09, "the sidebar needs to full screen here") so Policy
        // Landscape's exemplar callout and the section tiles had real
        // room, rather than being squeezed into the 2/3-width split the
        // scoreboard used - then walked back the same day once the tile/
        // exemplar redesign gave the content enough internal structure
        // that the full-width bleed read as sparse rather than spacious.
        // First attempt capped the panel to 75% width alone (map still
        // hidden); the actual ask was the map back too, at the same 75/25
        // split the scoreboard uses but mirrored - map on the left, panel
        // on the right at 75%, not the other way round ("75% from the
        // right") - so the detail view reads as a continuation of the
        // scoreboard's own map+list layout rather than a separate mode.
        // Narrowed from 75% to 50% on 2026-10-16 ("75% is too much") - the map
        // and the panel now split the content area evenly.
        <Box sx={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <Box sx={{ flex: 1, position: "relative", minWidth: 0 }}>{map}</Box>
          <SidebarShell width="50%">{list}</SidebarShell>
        </Box>
      ) : isMobile ? (
        selectedCountry && selectedScore ? (
          <Box sx={{ flex: 1, overflow: "hidden", bgcolor: "background.paper" }}>{list}</Box>
        ) : (
          <Box sx={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Scoreboard's own "Policy Explorer" heading stays suppressed
                (hideHeading) here too - the top bar now shows the app's own
                name on mobile as well, so a second "Policy Explorer" title
                directly beneath it was redundant. Just the Map/List toggle
                remains, switching between the same two full views (`map`
                and `list`) used on desktop, rather than the two being
                squeezed onto the screen together the way a short
                fixed-height map used to be. */}
            {/* Collapses away once the list beneath is scrolled, trading the
                Map/List toggle for more visible list - it's still reachable
                by scrolling back to the top. Map view never shrinks this,
                since listScrolled only tracks the list's own scroll. */}
            <Collapse in={!(mobileListActive && listScrolled)}>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: 1,
                  px: 2,
                  pt: 1.5,
                  pb: 1,
                  bgcolor: "background.paper",
                }}
              >
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
            </Collapse>
            {/* Search sits in the same place above the content regardless of
                which of the two views is showing - moved up here from the
                bottom bar, which is a map-only control now that Map/List is
                a toggle rather than the map always being on screen. Its own
                padding shrinks along with the toggle row above. */}
            <Box
              sx={{
                px: 2,
                py: mobileListActive && listScrolled ? 0.75 : 1.5,
                flexShrink: 0,
                bgcolor: "background.paper",
                transition: "padding 150ms ease",
              }}
            >
              <JurisdictionSearch scores={scores} selected={selectedCountry} onSelect={handleSelectCountry} />
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
        // No country selected - browsing the map and scoreboard side by
        // side, same as before. A selected country no longer renders here
        // at all (see the full-screen branch above), so this is purely the
        // "picking a jurisdiction" layout now.
        <Box sx={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <Box
            sx={{
              flex: sidebarCollapsed ? 1 : 2,
              position: "relative",
              minWidth: 0,
            }}
          >
            {map}
          </Box>

          {/* overflow:visible so the collapse tab (absolutely positioned,
              poking out to the left) stays visible even once this panel's
              own width animates down to 0 - same two-layer trick as the
              sibling gridsim-frontend project's results panel: an inner
              wrapper clips the panel's own content, the outer box does not
              clip the tab. */}
          <Box
            sx={{
              flex: sidebarCollapsed ? "0 0 0px" : "0 0 auto",
              width: sidebarCollapsed ? 0 : PANEL_WIDTH,
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
                bgcolor: "background.paper",
                border: "1px solid",
                borderColor: "divider",
                borderRight: "none",
                borderRadius: "6px 0 0 6px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                boxShadow: "-2px 0 6px rgba(0,0,0,0.06)",
                "&:hover": { bgcolor: "action.hover" },
                transition: "background-color 150ms ease",
              }}
            >
              <Box component="span" sx={{ fontSize: "0.65rem", color: "text.secondary", lineHeight: 1, userSelect: "none" }}>
                {sidebarCollapsed ? "‹" : "›"}
              </Box>
            </Box>

            <Box sx={{ width: "100%", height: "100%", display: sidebarCollapsed ? "none" : "flex" }}>
              <SidebarShell width="100%">{list}</SidebarShell>
            </Box>
          </Box>
        </Box>
      )}

      {/* Full-width bar, mirrors the country-select + language bar from the
          sibling gridsim-frontend project - a page-level sibling of the
          map/sidebar content, not scoped to the map panel, so it spans the
          whole viewport regardless of whether a sidebar is open next to it.
          Hidden through the tour's opening scene and the Charter that
          follows it, along with the top bar and legend. */}
      {/* Ported onto the shared `FooterComposition` 2026-09-19, per
          Andrew's own instruction ("footer composition... should be the
          same and common") - the shell was already this same 48px bar,
          just built inline here before this port. */}
      {!onboardingHero && (
        <FooterComposition
          search={
            // Hidden whenever the mobile Map/List toggle is active - search
            // already sits above the content in both of those views (see
            // above) instead of down here.
            !mobileToggleActive && (
              <Box sx={{ width: 280, maxWidth: "60%" }}>
                <JurisdictionSearch scores={scores} selected={selectedCountry} onSelect={handleSelectCountry} />
              </Box>
            )
          }
          toggle={
            // What the map paints - moved here from the legend card so the
            // legend only ever displays the current choice, rather than also
            // being where it's made. Hidden once a country's full-screen
            // detail view is open - per Andrew's own instruction 2026-10-09
            // ("score/completeness footer not needed... when sidebar
            // expanded") - the map isn't on screen to paint, so the choice
            // has nothing to act on.
            !mobileListActive && !(selectedCountry && selectedScore) && (
              <ToggleButtonGroup size="small" exclusive value={mapMetric} onChange={(_, next) => next && setMapMetric(next)}>
                <ToggleButton value="score" sx={{ py: 0.25, px: 2, fontSize: "0.7rem" }}>
                  {t("footer.score")}
                </ToggleButton>
                <ToggleButton value="completeness" sx={{ py: 0.25, px: 2, fontSize: "0.7rem" }}>
                  {t("footer.completeness")}
                </ToggleButton>
              </ToggleButtonGroup>
            )
          }
          languageSwitcher={<LanguageSwitcher />}
        />
      )}
    </Box>
  );
}
