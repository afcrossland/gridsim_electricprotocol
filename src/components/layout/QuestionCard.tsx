import { useState } from "react";
import { Box, Button, Chip, Collapse, IconButton, Paper, Stack, TextField, Tooltip, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import RestartAltIcon from "@mui/icons-material/RestartAlt";

import type { Question, Response } from "../../lib/types";
import { impactColor, impactLabel, impactTextColor } from "../../lib/scoring";
import { qualifiedName } from "../../lib/jurisdictions";
import { capitalizeFirst } from "../../lib/text";
import { useProtocolStore } from "../../stores/protocolStore";
import FlagImg from "../ui/FlagImg";

interface Props {
  question: Question;
  response: Response | undefined;
  code: string;
  /** Set only when a jurisdiction is being compared against - see CountryPanel's `inlineCompare`. */
  compareCode?: string;
  compareResponse?: Response;
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
 * that fits on screen and one that takes four scrolls. Evidence stays
 * collapsed until wanted, with its state shown on the toggle so nothing
 * important hides behind it - a score can rest on more than one citation
 * (title, source and notes each), added and removed independently.
 *
 * Editing the question itself - its text, weight or rubric - happens in the
 * Admin Console, not here; this card only records an answer against whatever
 * the question currently says.
 */
export default function QuestionCard({ question, response, code, compareCode, compareResponse }: Props) {
  const setResponse = useProtocolStore((s) => s.setResponse);
  const deleteResponse = useProtocolStore((s) => s.deleteResponse);
  const addEvidence = useProtocolStore((s) => s.addEvidence);
  const updateEvidence = useProtocolStore((s) => s.updateEvidence);
  const removeEvidence = useProtocolStore((s) => s.removeEvidence);

  const [showEvidence, setShowEvidence] = useState(false);

  return (
    <Paper
      id={`question-${question.id}`}
      variant="outlined"
      sx={{
        p: 2,
        borderColor: "divider",
        borderLeftWidth: 3,
        borderLeftStyle: response ? "solid" : "dashed",
        borderLeftColor: response ? "primary.main" : "grey.400",
        scrollMarginTop: 16,
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

        <Chip
          size="small"
          label={`Impactfullness: ${impactLabel(question.weight)}`}
          sx={{
            bgcolor: impactColor(question.weight),
            color: impactTextColor(question.weight),
            fontWeight: 600,
          }}
        />
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
          const isCompareAnswer = compareCode && compareResponse?.score === tier.score;
          const compareEvidenceTitles = compareResponse?.evidence
            .map((e) => e.title)
            .filter(Boolean)
            .join(", ");
          const compareTooltip = compareCode
            ? `${qualifiedName(compareCode)}${compareEvidenceTitles ? ` - ${compareEvidenceTitles}` : ""}`
            : "";
          return (
            <Box
              key={tier.score}
              onClick={() => {
                setResponse(code, question.id, { score: tier.score });
              }}
              sx={{
                position: "relative",
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
              {isCompareAnswer && (
                <Tooltip title={compareTooltip}>
                  <Box
                    sx={{
                      position: "absolute",
                      top: 6,
                      right: 6,
                      display: "flex",
                      bgcolor: "background.paper",
                      borderRadius: "50%",
                      p: "2px",
                      boxShadow: 1,
                    }}
                  >
                    <FlagImg code={compareCode} size={16} />
                  </Box>
                </Tooltip>
              )}
              <Typography
                variant="body2"
                sx={{
                  color: selected ? "text.primary" : undefined,
                  fontWeight: selected ? 600 : 400,
                  pr: isCompareAnswer ? 3 : 0,
                }}
              >
                {capitalizeFirst(tier.label)}
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

            <Box sx={{ flex: 1 }} />
            <Tooltip title="Clear this response">
              <IconButton size="small" onClick={() => deleteResponse(code, question.id)}>
                <RestartAltIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>

          <Collapse in={showEvidence}>
            <Stack spacing={1.5} sx={{ mt: 1 }}>
              {(response.evidence?.length ?? 0) === 0 && (
                <Typography variant="body2" color="text.secondary">
                  No evidence added yet.
                </Typography>
              )}

              {(response.evidence ?? []).map((item, i) => (
                <Box
                  key={i}
                  sx={{
                    p: 1.5,
                    borderRadius: 1.5,
                    border: "1px solid",
                    borderColor: "divider",
                    display: "flex",
                    gap: 1,
                    alignItems: "flex-start",
                  }}
                >
                  <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Title"
                      placeholder="Name of the law, decision or document"
                      value={item.title}
                      onChange={(e) =>
                        updateEvidence(code, question.id, i, { title: e.target.value })
                      }
                    />
                    <TextField
                      fullWidth
                      size="small"
                      label="Source"
                      placeholder="Link, statute or document reference"
                      value={item.source}
                      onChange={(e) =>
                        updateEvidence(code, question.id, i, { source: e.target.value })
                      }
                    />
                    <TextField
                      fullWidth
                      multiline
                      minRows={2}
                      size="small"
                      label="Notes"
                      value={item.note}
                      onChange={(e) =>
                        updateEvidence(code, question.id, i, { note: e.target.value })
                      }
                    />
                  </Stack>
                  <Tooltip title="Remove this evidence">
                    <IconButton size="small" onClick={() => removeEvidence(code, question.id, i)}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              ))}

              <Button
                size="small"
                startIcon={<AddIcon />}
                sx={{ alignSelf: "flex-start" }}
                onClick={() => addEvidence(code, question.id)}
              >
                Add evidence
              </Button>
            </Stack>
          </Collapse>
        </>
      )}
    </Paper>
  );
}
