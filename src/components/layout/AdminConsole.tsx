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
  Slider,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import SettingsIcon from "@mui/icons-material/SettingsOutlined";

import type { Question, RubricTier } from "../../lib/types";
import { impactColor, MAX_IMPACT } from "../../lib/scoring";
import { protocol, useProtocolStore } from "../../stores/protocolStore";

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
/** Pinned rail entry above the question groups - not a section id. */
const SETTINGS_VIEW = "settings";

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
  const thresholdValue = useProtocolStore((s) => s.threshold);
  const setThreshold = useProtocolStore((s) => s.setThreshold);

  const [activeSectionId, setActiveSectionId] = useState<string>(sections[0]?.id ?? "");

  const questionsBySection = useMemo(() => {
    const map = new Map<string, Question[]>();
    for (const s of sections) map.set(s.id, []);
    for (const q of [...questions].sort((a, b) => a.order - b.order)) {
      map.get(q.sectionId)?.push(q);
    }
    return map;
  }, [sections, questions]);

  const showingSettings = activeSectionId === SETTINGS_VIEW;
  const activeSection = sections.find((s) => s.id === activeSectionId) ?? null;
  const activeQuestions = questionsBySection.get(activeSectionId) ?? [];
  const threshold = Math.round(thresholdValue * 100);

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
          <Box
            onClick={() => setActiveSectionId(SETTINGS_VIEW)}
            sx={{
              px: 2,
              py: 1.25,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 1,
              bgcolor: showingSettings ? "action.selected" : "transparent",
              "&:hover": { bgcolor: "action.hover" },
            }}
          >
            <SettingsIcon fontSize="small" />
            <Typography variant="body2" sx={{ fontWeight: showingSettings ? 600 : 400 }}>
              Settings
            </Typography>
          </Box>
          <Divider />

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
          {showingSettings ? (
            <Paper variant="outlined" sx={{ p: 2.5, maxWidth: 500 }}>
              <Typography variant="h6" gutterBottom>
                Data completeness threshold
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                How much of a jurisdiction's question weight needs an answer
                before it is coloured on the map and ranked on the scoreboard.
                Below this, a jurisdiction is shown grey and left out of the
                ranking.
              </Typography>

              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  mb: 0.5,
                }}
              >
                <Typography variant="overline">Threshold</Typography>
                <Typography variant="h5">{threshold}%</Typography>
              </Box>

              <Slider
                min={0}
                max={100}
                step={5}
                value={threshold}
                onChange={(_, v) => setThreshold((v as number) / 100)}
                marks={[
                  {
                    value: Math.round(protocol.completenessThreshold * 100),
                    label: "Default",
                  },
                ]}
                valueLabelDisplay="auto"
                valueLabelFormat={(v) => `${v}%`}
              />
            </Paper>
          ) : (
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
                  <Box
                    title={`Impact ${question.weight}`}
                    sx={{
                      width: 14,
                      height: 14,
                      borderRadius: "50%",
                      flexShrink: 0,
                      mt: 1.5,
                      bgcolor: impactColor(question.weight),
                    }}
                  />
                  <TextField
                    size="small"
                    type="number"
                    label="Impact"
                    variant="standard"
                    value={question.weight}
                    slotProps={{ htmlInput: { min: 0, max: MAX_IMPACT, step: 0.1 } }}
                    onChange={(e) => {
                      const raw = Number(e.target.value);
                      if (!Number.isFinite(raw)) return;
                      const weight = Math.round(Math.min(MAX_IMPACT, Math.max(0, raw)) * 10) / 10;
                      updateQuestion(question.id, { weight });
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
          )}
        </Box>
      </Box>
    </Box>
  );
}
