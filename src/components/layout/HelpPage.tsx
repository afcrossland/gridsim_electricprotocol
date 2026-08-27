import { Box, Divider, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

import { CHARTER } from "../../data/charter";

interface Props {
  onBack: () => void;
}

interface Topic {
  heading: string;
  body: string;
}

const TOPICS: Topic[] = [
  {
    heading: "What this is",
    body: "Solar Policy Explorer scores countries, states and provinces against the Electric Protocol - a set of policy questions asking how easy it is for ordinary homes and businesses to generate, store and sell their own power.",
  },
  {
    heading: "The questions",
    body: "Questions are grouped into topic groups. Each question has an impact score (how much it counts toward the total) and a small set of possible answers describing what is actually in place, from \"not in place\" to \"fully in place\".",
  },
  {
    heading: "Score",
    body: "A jurisdiction's score is the weighted share of what is in place, among the questions that have actually been answered - then scaled down by how much of the questionnaire has been answered overall. This means a jurisdiction cannot rank highly by only answering a handful of its best questions; broad, honest coverage beats a few cherry-picked answers. Scores are shown as one of five bands, Very ineffective to Very effective, with the percentage alongside for those who want the detail.",
  },
  {
    heading: "Data completeness",
    body: "A separate measure from score: the share of questions answered at all, regardless of how they scored. A jurisdiction with too little data shows as \"not enough data\" rather than a score, so a lack of research is never mistaken for bad policy.",
  },
  {
    heading: "Evidence",
    body: "Every answer needs a real citation - a law, a regulator decision, or a market operator's own data. Answers also record how directly the evidence applies (a national source beats an EU-wide baseline, which beats a general statistical proxy) and how authoritative the source itself is.",
  },
  {
    heading: "Jurisdictions",
    body: "Most rows are countries. A few (the US, Australia, Canada) are shown as their states or provinces instead, since policy there varies too much to average into one national score. The European Union is shown as one consolidated row on the scoreboard, though every member still has its own full jurisdiction page.",
  },
];

/**
 * Single-page reference for the app's own concepts - scoring, evidence,
 * jurisdictions - plus the Citizens Electrification Charter itself (the
 * argument for why any of this matters) up top. The Charter used to also
 * have its own nav link opening a modal, but that was redundant with the
 * onboarding tour's own "Read the Citizens Electrification Charter" pill -
 * this is now the one place to read it outside the tour.
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
          <Box>
            <Typography variant="h5" gutterBottom sx={{ color: "primary.dark", fontWeight: 700 }}>
              {CHARTER.title}
            </Typography>
            {CHARTER.intro.map((para) => (
              <Typography key={para.slice(0, 32)} variant="body2" sx={{ mb: 1.5 }}>
                {para}
              </Typography>
            ))}
            <Stack spacing={2} sx={{ mt: 2 }}>
              {CHARTER.rights.map((right) => (
                <Box key={right.heading}>
                  <Typography variant="subtitle2" gutterBottom>
                    {right.heading}
                  </Typography>
                  <Typography variant="body2">{right.body}</Typography>
                </Box>
              ))}
            </Stack>
          </Box>

          <Divider />

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
