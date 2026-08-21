import { useMemo } from "react";
import { Box, Divider } from "@mui/material";

import CountryPanel from "./components/layout/CountryPanel";
import Scoreboard from "./components/layout/Scoreboard";
import TopNavbar from "./components/layout/TopNavbar";
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
  const selectedCountry = useProtocolStore((s) => s.selectedCountry);
  const selectCountry = useProtocolStore((s) => s.selectCountry);

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

  return (
    <Box sx={{ height: "100vh", width: "100vw", display: "flex", flexDirection: "column" }}>
      <TopNavbar />

      <Box sx={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* The map gives up two thirds of the width once a country is open:
            answering questions needs the room, browsing the map does not. */}
        <Box sx={{ flex: selectedCountry ? 1 : 2, position: "relative", minWidth: 0 }}>
          <PolicyMap
            scores={scores}
            selectedCountry={selectedCountry}
            onCountryClick={selectCountry}
          />
        </Box>

        <Divider orientation="vertical" flexItem />

        <Box
          sx={{
            flex: selectedCountry ? 2 : "0 0 auto",
            width: selectedCountry ? "auto" : PANEL_WIDTH,
            minWidth: 0,
            bgcolor: "background.default",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {selectedCountry && selectedScore ? (
            <CountryPanel
              code={selectedCountry}
              score={selectedScore}
              onBack={() => selectCountry(null)}
            />
          ) : (
            <Scoreboard
              scores={scores}
              selectedCountry={selectedCountry}
              onSelect={selectCountry}
            />
          )}
        </Box>
      </Box>
    </Box>
  );
}
