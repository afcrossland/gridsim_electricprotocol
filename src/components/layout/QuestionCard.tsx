import { useState } from "react";
import {
  Box,
  Button,
  Chip,
  Collapse,
  IconButton,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import { useTranslation } from "react-i18next";

import type { Question, Response } from "../../lib/types";
import { impactColor, impactLabel, impactTextColor } from "../../lib/scoring";
import { qualifiedName } from "../../lib/jurisdictions";
import { capitalizeFirst } from "../../lib/text";
import { useProtocolStore } from "../../stores/protocolStore";
import FlagImg from "../ui/FlagImg";

export interface CompareEntry {
  code: string;
  /** Assigned via compareColorFor in lib/compareColors.ts - stable per jurisdiction for the whole session. */
  color: string;
  name?: string;
  response?: Response;
}

interface Props {
  question: Question;
  response: Response | undefined;
  code: string;
  /** Empty outside compare mode - see CountryPanel's `inlineCompare`. */
  compareEntries?: CompareEntry[];
  /** Gates every write action (rubric tiles, evidence fields, clear response) behind CountryPanel's Edit toggle - off by default, a read-only view of whatever's already answered. */
  editMode?: boolean;
}

/**
 * GSC Citrus, used for the chosen rubric tier.
 *
 * Aqua was too close to the card's own border and to the unselected outline to
 * read at a glance. Citrus is reserved for this one meaning - "this is the
 * answer" - so the unanswered marker below uses a neutral dashed edge rather
 * than competing for the same colour.
 */
const SELECTED = "#FBB114";
const SELECTED_TINT = "rgba(251, 177, 20, 0.12)";

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
export default function QuestionCard({ question, response, code, compareEntries = [], editMode = false }: Props) {
  const { t, i18n } = useTranslation();
  const setResponse = useProtocolStore((s) => s.setResponse);
  const deleteResponse = useProtocolStore((s) => s.deleteResponse);
  const addEvidence = useProtocolStore((s) => s.addEvidence);
  const updateEvidence = useProtocolStore((s) => s.updateEvidence);
  const removeEvidence = useProtocolStore((s) => s.removeEvidence);

  const [showEvidence, setShowEvidence] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  return (
    <Paper
      id={`question-${question.id}`}
      variant="outlined"
      sx={{
        p: isMobile ? 1.5 : 2,
        borderColor: "divider",
        borderLeftWidth: 3,
        borderLeftStyle: response ? "solid" : "dashed",
        borderLeftColor: response ? "primary.main" : "text.disabled",
        scrollMarginTop: 16,
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          gap: isMobile ? 0.75 : 1,
          alignItems: "flex-start",
          mb: 1.5,
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0, width: isMobile ? "100%" : undefined }}>
          {question.subsection && (
            <Typography variant="overline" sx={{ display: "block" }}>
              {question.subsection}
            </Typography>
          )}
          <Typography variant="body1" sx={{ fontWeight: 700 }}>{question.text}</Typography>
        </Box>

        <Chip
          size="small"
          label={t("impactList.impactfullness", { label: impactLabel(question.weight, i18n.language) })}
          sx={{
            bgcolor: impactColor(question.weight),
            color: impactTextColor(question.weight),
            fontWeight: 600,
          }}
        />
      </Box>

      <Box
        data-tour="question-rubric"
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
          // Every comparator who picked this exact tier, clustered along the
          // tile's bottom edge rather than one badge each - up to
          // MAX_COMPARE_COUNTRIES flags is still readable in a row, where
          // stacking them over the label text (the old single-comparator
          // treatment) would not be.
          const tierComparators = compareEntries.filter((entry) => entry.response?.score === tier.score);
          return (
            <Box
              key={tier.score}
              onClick={
                editMode
                  ? () => {
                      setResponse(code, question.id, { score: tier.score });
                    }
                  : undefined
              }
              sx={{
                position: "relative",
                p: 1.25,
                pb: tierComparators.length > 0 ? 3 : 1.25,
                borderRadius: 1.5,
                cursor: editMode ? "pointer" : "default",
                border: "2px solid",
                borderColor: selected ? SELECTED : "divider",
                bgcolor: selected ? SELECTED_TINT : "transparent",
                ...(editMode && { "&:hover": { borderColor: selected ? SELECTED : "primary.light" } }),
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
                {capitalizeFirst(tier.label)}
              </Typography>

              {tierComparators.length > 0 && (
                <Box sx={{ position: "absolute", left: 8, bottom: 6, display: "flex", gap: "3px" }}>
                  {tierComparators.map((entry) => {
                    const evidenceTitles = entry.response?.evidence
                      ?.map((e) => e.title)
                      .filter(Boolean)
                      .join(", ");
                    const tooltip = `${entry.name ?? qualifiedName(entry.code, i18n.language)}${evidenceTitles ? ` - ${evidenceTitles}` : ""}`;
                    return (
                      <Tooltip key={entry.code} title={tooltip}>
                        <Box
                          sx={{
                            display: "flex",
                            bgcolor: "background.paper",
                            borderRadius: "50%",
                            border: "1.5px solid",
                            borderColor: entry.color,
                            p: "1px",
                          }}
                        >
                          <FlagImg code={entry.code} size={14} />
                        </Box>
                      </Tooltip>
                    );
                  })}
                </Box>
              )}
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
              {t("questionCard.evidence")}
            </Button>

            <Box sx={{ flex: 1 }} />
            {editMode && (
              <Tooltip title={t("questionCard.clearResponse")}>
                <IconButton size="small" onClick={() => deleteResponse(code, question.id)}>
                  <RestartAltIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>

          <Collapse in={showEvidence}>
            <Stack spacing={1.5} sx={{ mt: 1 }}>
              {(response.evidence?.length ?? 0) === 0 && (
                <Typography variant="body2" color="text.secondary">
                  {t("questionCard.noEvidence")}
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
                  {/* TODO: title/note are free text, may be written in a
                      researcher's own local language - no translate-to-
                      English mechanism exists yet. See EvidenceItem's own
                      doc comment in lib/types.ts. */}
                  <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
                    <TextField
                      fullWidth
                      size="small"
                      label={t("questionCard.title")}
                      placeholder={t("questionCard.titlePlaceholder")}
                      value={item.title}
                      slotProps={{ input: { readOnly: !editMode } }}
                      onChange={(e) =>
                        updateEvidence(code, question.id, i, { title: e.target.value })
                      }
                    />
                    <TextField
                      fullWidth
                      size="small"
                      label={t("questionCard.source")}
                      placeholder={t("questionCard.sourcePlaceholder")}
                      value={item.source}
                      slotProps={{ input: { readOnly: !editMode } }}
                      onChange={(e) =>
                        updateEvidence(code, question.id, i, { source: e.target.value })
                      }
                    />
                    <TextField
                      fullWidth
                      multiline
                      minRows={2}
                      size="small"
                      label={t("questionCard.notes")}
                      value={item.note}
                      slotProps={{ input: { readOnly: !editMode } }}
                      onChange={(e) =>
                        updateEvidence(code, question.id, i, { note: e.target.value })
                      }
                    />
                  </Stack>
                  {editMode && (
                    <Tooltip title={t("questionCard.removeEvidence")}>
                      <IconButton size="small" onClick={() => removeEvidence(code, question.id, i)}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              ))}

              {editMode && (
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  sx={{ alignSelf: "flex-start" }}
                  onClick={() => addEvidence(code, question.id)}
                >
                  {t("questionCard.addEvidence")}
                </Button>
              )}
            </Stack>
          </Collapse>
        </>
      )}
    </Paper>
  );
}
