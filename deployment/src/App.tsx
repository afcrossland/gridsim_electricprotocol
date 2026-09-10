import { useEffect, useState } from "react";
import { Box, ToggleButton, ToggleButtonGroup } from "@mui/material";
import type { PaletteMode } from "@mui/material/styles";

import CountrySearch from "./components/CountrySearch";
import DeploymentMap from "./components/DeploymentMap";
import HelpPage from "./components/HelpPage";
import LanguageSwitcher from "./components/LanguageSwitcher";
import Sidebar from "./components/Sidebar";
import TopNavbar from "./components/TopNavbar";
import ScrollStory from "./scrollstory/ScrollStory";
import { METRIC_LABELS, type Metric } from "./lib/metrics";

interface Props {
  mode: PaletteMode;
  setMode: (mode: PaletteMode) => void;
}

const METRICS: Metric[] = ["capacity", "capacityPerCapita", "share"];
const TOUR_SEEN_KEY = "deployment-tour-seen";

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

  // A link into the app can force the tour open even for a returning
  // visitor - same ?showTour=1 param and param-stripping pattern as Policy
  // Explorer's own App.tsx, used by the Playbook homepage's "Demo" button.
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("showTour")) return;
    setTourOpen(true);
    const url = new URL(window.location.href);
    url.searchParams.delete("showTour");
    window.history.replaceState({}, "", url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box sx={{ height: "100dvh", width: "100%", display: "flex", flexDirection: "column" }}>
      <TopNavbar mode={mode} setMode={setMode} page={page} setPage={setPage} onStartTour={() => setTourOpen(true)} />

      {page === "help" ? (
        <HelpPage onBack={() => setPage("map")} />
      ) : (
        <>
          {/* Same map + sidebar layout as ep_policymap's App.tsx - the map is
              a flex sibling of the sidebar, not an overlay. */}
          <Box sx={{ flex: 1, display: "flex", overflow: "hidden" }}>
            <Box sx={{ flex: 1, position: "relative", minWidth: 0 }}>
              <DeploymentMap metric={metric} selectedCountry={selectedCountry} onCountryClick={setSelectedCountry} />
            </Box>
            <Sidebar metric={metric} selectedCountry={selectedCountry} onSelect={setSelectedCountry} />
          </Box>

          {/* Footer bar - the metric selector, country search, and language,
              same role as ep_policymap's own bottom bar. */}
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
            <CountrySearch selected={selectedCountry} onSelect={setSelectedCountry} />

            <ToggleButtonGroup
              data-tour="metric-selector"
              size="small"
              exclusive
              value={metric}
              onChange={(_, v) => v && setMetric(v)}
            >
              {METRICS.map((m) => (
                <ToggleButton key={m} value={m} sx={{ py: 0.25, px: 1.5, fontSize: "0.7rem" }}>
                  {METRIC_LABELS[m]}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>

            <Box sx={{ flex: 1 }} />
            <LanguageSwitcher />
          </Box>

          {tourOpen && <ScrollStory onDismiss={dismissTour} onSelectCountry={setSelectedCountry} />}
        </>
      )}
    </Box>
  );
}
