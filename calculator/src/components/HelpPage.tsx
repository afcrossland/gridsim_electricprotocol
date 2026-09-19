import { Box, Typography } from "@mui/material";

import HelpPageShell from "../../../shared/components/HelpPageShell";

interface Props {
  onBack: () => void;
}

interface Topic {
  heading: string;
  body: string;
}

// Plain English, no i18n - this app has no i18n system today (unlike its
// sibling apps) and adding one just for this page isn't part of what
// Andrew asked for 2026-09-19 ("give calculator the same buttons too").
const TOPICS: Topic[] = [
  {
    heading: "Picking a location",
    body: "Search for a country or city, click anywhere on the map, or pick a row from the ranked list to select a location. Each one runs the same calculation using that location's own real solar generation data.",
  },
  {
    heading: "Design",
    body: "Four sliders set the system this calculator sizes up: how many panels, how big each one is, how much battery storage, and the home's own annual electricity use. Every other tab updates automatically as you adjust them - there's no submit button.",
  },
  {
    heading: "Generation & demand",
    body: "The system's own hour-by-hour solar output, plotted alongside the home's own demand shape (both monthly totals and a day-by-day view you can zoom into). This is the real profile the rest of the calculation runs against, not an illustration.",
  },
  {
    heading: "Dispatch",
    body: "How solar, the battery and the grid connection cover demand hour by hour, plus a Sankey diagram showing the year's own energy flow: solar and grid power in on the left, through the battery in the middle, out to the home or back to the grid on the right.",
  },
  {
    heading: "Economics",
    body: "Import and export tariff sliders (shown in the local currency wherever that's known), a payback estimate across a low/typical/high install-cost range with its own IRR, and a year-by-year breakdown of import savings versus export revenue.",
  },
];

/**
 * Built on the shared `HelpPageShell` (`shared/components/`) 2026-09-19,
 * per Andrew's own instruction ("give calculator the same buttons too") -
 * this app had no Help page at all before. New content throughout,
 * covering this app's own concepts rather than reusing deployment's or
 * policy's own topics (which are about capacity/generation data or
 * protocol scoring - neither applies here).
 */
export default function HelpPage({ onBack }: Props) {
  return (
    <HelpPageShell title="Help" onBack={onBack}>
      {TOPICS.map((topic) => (
        <Box key={topic.heading}>
          <Typography variant="h6" gutterBottom>
            {topic.heading}
          </Typography>
          <Typography variant="body2">{topic.body}</Typography>
        </Box>
      ))}
    </HelpPageShell>
  );
}
