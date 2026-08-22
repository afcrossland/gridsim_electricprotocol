import { useState } from "react";
import { Box, Button, Chip, Collapse, IconButton, Paper, Stack, TextField, Tooltip, Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import RestartAltIcon from "@mui/icons-material/RestartAlt";

import type { Question, Response } from "../../lib/types";
import { useProtocolStore } from "../../stores/protocolStore";

interface Props {
  question: Question;
  response: Response | undefined;
  code: string;
}

/**
 * GSC Burnt Orange, used for the chosen rubric tier.
 *
 * Aqua was too close to the card's own border and to the unselected outline to
 * read at a glance. Orange is reserved for this one meaning - "this is the
 * answer" - so the unanswered marker below uses a neutral dashed edge rather
 * than competing for the same colour.
 */
const SELECTED = "#EF864C";
const SELECTED_TINT = "rgba(239, 134, 76, 0.12)";

/**
 * One question as a compact card.
 *
 * The rubric tiers run horizontally rather than stacked - three short columns
 * instead of three full-width rows is most of the difference between a section
 * that fits on screen and one that takes four scrolls. Source and notes stay
 * collapsed until wanted, with their state shown on the toggle so nothing
 * important hides behind it.
 *
 * Editing the question itself - its text, weight or rubric - happens in the
 * Admin Console, not here; this card only records an answer against whatever
 * the question currently says.
 */
export default function QuestionCard({ question, response, code }: Props) {
  const setResponse = useProtocolStore((s) => s.setResponse);
  const deleteResponse = useProtocolStore((s) => s.deleteResponse);

  const [showEvidence, setShowEvidence] = useState(false);

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderColor: "divider",
        borderLeftWidth: 3,
        borderLeftStyle: response ? "solid" : "dashed",
        borderLeftColor: response ? "primary.main" : "grey.400",
      }}
    >
      <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start", mb: 1.5 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {question.subsection && (
            <Typography variant="overline" sx={{ display: "block" }}>
              {question.subsection}
            </Typography>
          )}
          <Typography variant="body1">{question.text}</Typography>
        </Box>

        <Chip size="small" variant="outlined" label={`Weight ${question.weight}`} />
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            md: `repeat(${question.rubric.length}, 1fr)`,
          },
          gap: 1,
        }}
      >
        {question.rubric.map((tier) => {
          const selected = response?.score === tier.score;
          return (
            <Box
              key={tier.score}
              onClick={() => setResponse(code, question.id, { score: tier.score })}
              sx={{
                p: 1.25,
                borderRadius: 1.5,
                cursor: "pointer",
                border: "2px solid",
                borderColor: selected ? SELECTED : "divider",
                bgcolor: selected ? SELECTED_TINT : "transparent",
                "&:hover": { borderColor: selected ? SELECTED : "primary.light" },
                display: "flex",
                flexDirection: "column",
                gap: 0.75,
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  color: selected ? "text.primary" : undefined,
                  fontWeight: selected ? 600 : 400,
                }}
              >
                {tier.label}
              </Typography>
            </Box>
          );
        })}
      </Box>

      {response && (
        <>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1.5, flexWrap: "wrap" }}>
            <Button
              size="small"
              onClick={() => setShowEvidence((v) => !v)}
              endIcon={
                <ExpandMoreIcon
                  fontSize="small"
                  sx={{
                    transform: showEvidence ? "rotate(180deg)" : "none",
                    transition: "transform 150ms",
                  }}
                />
              }
            >
              Evidence
            </Button>

            {response.basis === "directive-baseline" && (
              <Chip size="small" color="warning" variant="outlined" label="EU directive baseline" />
            )}
            {response.basis === "national" && (
              <Chip size="small" color="success" variant="outlined" label="National evidence" />
            )}
            {response.basis === "proxy-indicator" && (
              <Chip size="small" color="warning" variant="outlined" label="Statistical proxy" />
            )}
            {response.seeded && !response.basis && (
              <Chip size="small" variant="outlined" label="From spreadsheet" />
            )}
            {!response.source && (
              <Chip size="small" color="warning" variant="outlined" label="No source" />
            )}

            <Box sx={{ flex: 1 }} />
            <Tooltip title="Clear this response">
              <IconButton size="small" onClick={() => deleteResponse(code, question.id)}>
                <RestartAltIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>

          <Collapse in={showEvidence}>
            <Stack spacing={1} sx={{ mt: 1 }}>
              <TextField
                fullWidth
                size="small"
                label="Source"
                placeholder="Link, statute or document supporting this score"
                value={response.source}
                onChange={(e) => setResponse(code, question.id, { source: e.target.value })}
              />
              <TextField
                fullWidth
                multiline
                minRows={2}
                size="small"
                label="Notes"
                value={response.note}
                onChange={(e) => setResponse(code, question.id, { note: e.target.value })}
              />
            </Stack>
          </Collapse>
        </>
      )}
    </Paper>
  );
}
