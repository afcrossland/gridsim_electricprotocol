import { useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import RestartAltIcon from "@mui/icons-material/RestartAlt";

import type { Question, RubricTier } from "../../lib/types";
import { useProtocolStore } from "../../stores/protocolStore";

/** How many questions currently live in a section a delete would wipe out - shown in the confirm prompt. */
function confirmDeleteSection(title: string, questionCount: number): boolean {
  return confirm(
    `Delete "${title}" and its ${questionCount} question${questionCount === 1 ? "" : "s"}? This also removes any answers already recorded against them.`,
  );
}

interface Props {
  onBack: () => void;
}

const RAIL_WIDTH = 232;

/** Ceiling a tier's points can be set to - see MAX_TIER_POINTS in scoring.ts. */
const POINTS_OPTIONS = [0, 1, 2, 3, 4];

/**
 * Full-screen editor for the question set: text, weight, and each question's
 * rubric tiers (label and points). Answering questions for a jurisdiction
 * happens in the country view; this is only for editing what the questions
 * themselves say.
 */
export default function AdminConsole({ onBack }: Props) {
  const sections = useProtocolStore((s) => s.sections);
  const questions = useProtocolStore((s) => s.questions);
  const questionOverrides = useProtocolStore((s) => s.questionOverrides);
  const updateSection = useProtocolStore((s) => s.updateSection);
  const addSection = useProtocolStore((s) => s.addSection);
  const deleteSection = useProtocolStore((s) => s.deleteSection);
  const updateQuestion = useProtocolStore((s) => s.updateQuestion);
  const resetQuestion = useProtocolStore((s) => s.resetQuestion);
  const addQuestion = useProtocolStore((s) => s.addQuestion);
  const deleteQuestion = useProtocolStore((s) => s.deleteQuestion);
  const resetToSeed = useProtocolStore((s) => s.resetToSeed);

  const [activeSectionId, setActiveSectionId] = useState<string>(sections[0]?.id ?? "");

  const questionsBySection = useMemo(() => {
    const map = new Map<string, Question[]>();
    for (const s of sections) map.set(s.id, []);
    for (const q of [...questions].sort((a, b) => a.order - b.order)) {
      map.get(q.sectionId)?.push(q);
    }
    return map;
  }, [sections, questions]);

  const activeSection = sections.find((s) => s.id === activeSectionId) ?? null;
  const activeQuestions = questionsBySection.get(activeSectionId) ?? [];

  const handleAddSection = () => {
    const id = addSection("New group");
    setActiveSectionId(id);
  };

  const handleDeleteSection = (id: string) => {
    const section = sections.find((s) => s.id === id);
    if (!section) return;
    if (!confirmDeleteSection(section.title, questionsBySection.get(id)?.length ?? 0)) return;

    if (activeSectionId === id) {
      const next = sections.find((s) => s.id !== id);
      setActiveSectionId(next?.id ?? "");
    }
    deleteSection(id);
  };

  const setTierField = (question: Question, index: number, patch: Partial<RubricTier>) => {
    const rubric = question.rubric.slice();
    rubric[index] = { ...rubric[index], ...patch };
    updateQuestion(question.id, { rubric });
  };

  const addTier = (question: Question) => {
    const nextScore = Math.max(-1, ...question.rubric.map((t) => t.score)) + 1;
    updateQuestion(question.id, {
      rubric: [...question.rubric, { score: nextScore, label: "New answer", points: 0 }],
    });
  };

  const removeTier = (question: Question, index: number) => {
    updateQuestion(question.id, { rubric: question.rubric.filter((_, i) => i !== index) });
  };

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
        <Typography variant="h2" sx={{ flex: 1 }}>
          Admin console
        </Typography>
        <Button
          size="small"
          color="warning"
          onClick={() => {
            if (confirm("Discard all local edits - questions, weights, rubrics and answers - and reload the shipped data?")) {
              resetToSeed();
            }
          }}
        >
          Reset everything to seed
        </Button>
      </Box>

      <Box sx={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <Box
          sx={{
            width: RAIL_WIDTH,
            flexShrink: 0,
            borderRight: "1px solid",
            borderColor: "divider",
            overflowY: "auto",
            bgcolor: "background.paper",
          }}
        >
          {sections.map((section) => (
            <Box
              key={section.id}
              onClick={() => setActiveSectionId(section.id)}
              sx={{
                px: 2,
                py: 1.25,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 0.5,
                bgcolor: activeSectionId === section.id ? "action.selected" : "transparent",
                "&:hover": { bgcolor: "action.hover" },
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  variant="body2"
                  noWrap
                  sx={{ fontWeight: activeSectionId === section.id ? 600 : 400 }}
                >
                  {section.title}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {questionsBySection.get(section.id)?.length ?? 0} questions
                </Typography>
              </Box>
              <Tooltip title="Delete this group">
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteSection(section.id);
                  }}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          ))}

          <Box sx={{ p: 1 }}>
            <Button size="small" startIcon={<AddIcon />} onClick={handleAddSection} fullWidth>
              Add group
            </Button>
          </Box>
        </Box>

        <Box sx={{ flex: 1, overflowY: "auto", p: 3, minWidth: 0 }}>
          <Stack spacing={2} sx={{ maxWidth: 900 }}>
            {activeSection && (
              <TextField
                size="small"
                variant="standard"
                label="Group name"
                value={activeSection.title}
                onChange={(e) => updateSection(activeSection.id, { title: e.target.value })}
                sx={{ maxWidth: 400 }}
              />
            )}

            {activeQuestions.map((question) => (
              <Paper key={question.id} variant="outlined" sx={{ p: 2 }}>
                <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start", mb: 1.5 }}>
                  <TextField
                    fullWidth
                    multiline
                    size="small"
                    variant="standard"
                    label="Question"
                    value={question.text}
                    onChange={(e) => updateQuestion(question.id, { text: e.target.value })}
                    sx={{ flex: 1 }}
                  />
                  <TextField
                    size="small"
                    type="number"
                    label="Weight"
                    variant="standard"
                    value={question.weight}
                    onChange={(e) => {
                      const weight = Number(e.target.value);
                      if (Number.isFinite(weight) && weight >= 0) {
                        updateQuestion(question.id, { weight });
                      }
                    }}
                    sx={{ width: 90, flexShrink: 0 }}
                  />
                  {questionOverrides[question.id] && (
                    <Tooltip title="Revert this question to the shipped version">
                      <IconButton size="small" onClick={() => resetQuestion(question.id)}>
                        <RestartAltIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                  <Tooltip title="Delete this question">
                    <IconButton
                      size="small"
                      onClick={() => {
                        if (confirm("Delete this question? This also removes any answers already recorded against it.")) {
                          deleteQuestion(question.id);
                        }
                      }}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>

                <Divider sx={{ mb: 1.5 }} />

                <Stack spacing={1}>
                  {question.rubric.map((tier, i) => (
                    <Box key={tier.score} sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                      <TextField
                        fullWidth
                        size="small"
                        variant="standard"
                        value={tier.label}
                        onChange={(e) => setTierField(question, i, { label: e.target.value })}
                      />
                      <Select
                        size="small"
                        variant="standard"
                        value={tier.points}
                        onChange={(e) => setTierField(question, i, { points: Number(e.target.value) })}
                        sx={{ width: 64, flexShrink: 0 }}
                      >
                        {POINTS_OPTIONS.map((p) => (
                          <MenuItem key={p} value={p}>
                            {p}
                          </MenuItem>
                        ))}
                      </Select>
                      <Tooltip title="Remove this answer">
                        <IconButton
                          size="small"
                          disabled={question.rubric.length <= 1}
                          onClick={() => removeTier(question, i)}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  ))}
                </Stack>

                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  sx={{ mt: 1 }}
                  onClick={() => addTier(question)}
                >
                  Add answer
                </Button>

                {questionOverrides[question.id] && (
                  <Chip size="small" sx={{ mt: 1 }} label="Edited from the shipped version" />
                )}
              </Paper>
            ))}

            {activeSection && (
              <Button
                size="small"
                startIcon={<AddIcon />}
                sx={{ alignSelf: "flex-start" }}
                onClick={() => addQuestion(activeSection.id)}
              >
                Add question
              </Button>
            )}
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}
