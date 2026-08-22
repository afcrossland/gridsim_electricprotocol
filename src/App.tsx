import { useMemo } from "react";
import { Box, Divider } from "@mui/material";

import AdminConsole from "./components/layout/AdminConsole";
import CountryPanel from "./components/layout/CountryPanel";
import Scoreboard from "./components/layout/Scoreboard";
import SettingsPage from "./components/layout/SettingsPage";
import TopNavbar from "./components/layout/TopNavbar";
import WelcomeModal from "./components/ui/WelcomeModal";
import PolicyMap from "./components/map/PolicyMap";
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
  const welcomeSeen = useProtocolStore((s) => s.welcomeSeen);
  const setWelcomeSeen = useProtocolStore((s) => s.setWelcomeSeen);
  const page = useProtocolStore((s) => s.page);
  const setPage = useProtocolStore((s) => s.setPage);
  const selectedCountry = useProtocolStore((s) => s.selectedCountry);
  const selectCountry = useProtocolStore((s) => s.selectCountry);

  // Picking a jurisdiction - from the map, the search box or the scoreboard -
  // always means "show me that jurisdiction", so it backs out of Settings too.
  const handleSelectCountry = (code: string | null) => {
    setPage("map");
    selectCountry(code);
  };

  // Every jurisdiction with an answer, plus the ones the spreadsheet shipped
  // with, so an empty Sri Lanka is still visible as something to fill in.
  // Countries that have been subdivided resolve to their states, since those
  // are what the map actually draws.
  const scores = useMemo(() => {
    const codes = new Set<string>(
      protocol.countries.flatMap((c) => resolveTargets(c.code)),
    );
    for (const code of sourcedCountries()) codes.add(code);
    for (const r of responses) codes.add(r.countryCode);
    if (selectedCountry) codes.add(selectedCountry);

    return [...codes].map((code) =>
      scoreCountry(protocol, questions, responses, code, qualifiedName(code), threshold),
    );
  }, [questions, responses, selectedCountry, threshold]);

  const selectedScore = scores.find((s) => s.code === selectedCountry) ?? null;
  const showingSettings = page === "settings";

  return (
    <Box sx={{ height: "100vh", width: "100vw", display: "flex", flexDirection: "column" }}>
      <TopNavbar />

      <WelcomeModal open={!welcomeSeen} onClose={() => setWelcomeSeen(true)} />

      {page === "admin" ? (
        // Full takeover, not a sidebar view like Settings - there is nothing
        // useful to keep the map visible for while editing question
        // definitions themselves.
        <Box sx={{ flex: 1, overflow: "hidden" }}>
          <AdminConsole onBack={() => setPage("map")} />
        </Box>
      ) : (
      <Box sx={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* The map gives up two thirds of the width once a country is open:
            answering questions needs the room, browsing the map does not.
            Settings takes the same width as the scoreboard - it is a sidebar
            view, not a takeover, so the map stays visible and clickable
            underneath it. */}
        <Box
          sx={{
            flex: selectedCountry && !showingSettings ? 1 : 2,
            position: "relative",
            minWidth: 0,
          }}
        >
          <PolicyMap
            scores={scores}
            metric={mapMetric}
            selectedCountry={selectedCountry}
            onCountryClick={handleSelectCountry}
          />
        </Box>

        <Divider orientation="vertical" flexItem />

        <Box
          sx={{
            flex: selectedCountry && !showingSettings ? 2 : "0 0 auto",
            width: selectedCountry && !showingSettings ? "auto" : PANEL_WIDTH,
            minWidth: 0,
            bgcolor: "background.default",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {showingSettings ? (
            <SettingsPage onBack={() => setPage("map")} />
          ) : selectedCountry && selectedScore ? (
            <CountryPanel
              code={selectedCountry}
              score={selectedScore}
              onBack={() => handleSelectCountry(null)}
            />
          ) : (
            <Scoreboard
              scores={scores}
              selectedCountry={selectedCountry}
              onSelect={handleSelectCountry}
            />
          )}
        </Box>
      </Box>
      )}
    </Box>
  );
}
