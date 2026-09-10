import { Box, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

interface Props {
  onBack: () => void;
}

interface Topic {
  heading: string;
  body: string;
}

const TOPICS: Topic[] = [
  {
    heading: "What this tool shows",
    body: "This map shows how much solar power countries actually have, not what their laws say. It has three views: how much solar power is installed, how much solar power there is for each person, and how much of a country's electricity comes from solar.",
  },
  {
    heading: "How to use it",
    body: "Pick a view at the bottom of the screen. Darker colours on the map mean more solar. Click a country, or find it in the search box, to see its own numbers and a chart of how they changed over time. Click the arrow button to go back to the list. The Filter button lets you show only certain continents.",
  },
  {
    heading: "Where the data comes from",
    body: "All the numbers come from Ember, a real energy research group. Solar capacity and solar's share of electricity are two different Ember datasets, which is why some countries only have one of the two charts. Population numbers (used for the per-person view) come from the World Bank. Nothing on this map is made up or guessed.",
  },
  {
    heading: "Why some countries are missing",
    body: "Not every country reports its solar data to Ember yet. If a country has no data for a view, it will not show a colour on the map for that view, and it will not appear in that view's list.",
  },
  {
    heading: "How often the data updates",
    body: "This is a demo. The data is loaded once by hand, not updated automatically. The numbers you see are correct as of when this demo was built, not necessarily today.",
  },
];

/**
 * Simple, plain-language reference page - matches ep_policymap's
 * HelpPage.tsx structure exactly (back arrow + h2 header, a centered
 * max-width column of heading/body topic sections), but written to a much
 * simpler reading level per Andrew's instruction: this is a demo tool for
 * a general audience, not a research wiki, so it doesn't need Policy
 * Explorer's own denser reference material (scoring formulas, evidence
 * bases, jurisdiction inheritance).
 */
export default function HelpPage({ onBack }: Props) {
  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", minWidth: 0 }}>
      <Box
        sx={{
          px: 3,
          py: 2,
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Tooltip title="Back">
          <IconButton size="small" onClick={onBack}>
            <ArrowBackIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Typography variant="h2">How this works</Typography>
      </Box>

      <Box sx={{ flex: 1, overflowY: "auto", p: 3, display: "flex", justifyContent: "center" }}>
        <Stack spacing={3} sx={{ maxWidth: 720, width: "100%" }}>
          {TOPICS.map((topic) => (
            <Box key={topic.heading}>
              <Typography variant="h6" gutterBottom>
                {topic.heading}
              </Typography>
              <Typography variant="body2">{topic.body}</Typography>
            </Box>
          ))}
        </Stack>
      </Box>
    </Box>
  );
}
