import { useMemo, useState } from "react";
import { Box, Button, Divider, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

import { rankImpact, scoreColor } from "../../lib/scoring";
import type { CountryScore } from "../../lib/types";
import { protocol, useProtocolStore } from "../../stores/protocolStore";
import ImpactList from "./ImpactList";
import QuestionCard from "./QuestionCard";
import SectionRail, { type RailSection } from "./SectionRail";
import FlagImg from "../ui/FlagImg";

interface Props {
  code: string;
  score: CountryScore;
  onBack: () => void;
}

const IMPACT = "impact";

export default function CountryPanel({ code, score, onBack }: Props) {
  const role = useProtocolStore((s) => s.role);
  const sections = useProtocolStore((s) => s.sections);
  const questions = useProtocolStore((s) => s.questions);
  const responses = useProtocolStore((s) => s.responses);
  const addQuestion = useProtocolStore((s) => s.addQuestion);

  const [view, setView] = useState<string>(sections[0]?.id ?? IMPACT);

  const byQuestion = useMemo(
    () => new Map(responses.filter((r) => r.countryCode === code).map((r) => [r.questionId, r])),
    [responses, code],
  );

  const impact = useMemo(
    () => rankImpact(protocol, questions, sections, responses, code),
    [questions, sections, responses, code],
  );

  const railSections: RailSection[] = useMemo(
    () =>
      sections.map((section) => {
        const inSection = questions.filter((q) => q.sectionId === section.id);
        return {
          ...section,
          total: inSection.length,
          answered: inSection.filter((q) => byQuestion.has(q.id)).length,
        };
      }),
    [sections, questions, byQuestion],
  );

  const activeSection = railSections.find((s) => s.id === view) ?? null;
  const sectionQuestions = useMemo(
    () =>
      activeSection
        ? questions
            .filter((q) => q.sectionId === activeSection.id)
            .sort((a, b) => a.order - b.order)
        : [],
    [questions, activeSection],
  );

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", minWidth: 0 }}>
      {/* Score header, laid out horizontally so it costs one band of height
          rather than a stacked block. */}
      <Box
        sx={{
          px: 3,
          py: 2,
          display: "flex",
          alignItems: "baseline",
          gap: 2,
          flexWrap: "wrap",
        }}
      >
        <Tooltip title="Back to scoreboard">
          <IconButton size="small" onClick={onBack} sx={{ alignSelf: "center" }}>
            <ArrowBackIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <FlagImg code={code} size={28} />
        <Typography variant="h2">{score.name}</Typography>
        <Typography
          variant="h1"
          sx={{ color: score.ranked ? scoreColor(score.score) : "text.disabled" }}
        >
          {score.ranked ? `${Math.round(score.score * 100)}%` : "—"}
        </Typography>
        {!score.ranked && (
          <Typography variant="caption">
            Below the {Math.round(protocol.completenessThreshold * 100)}% completeness
            threshold, so not ranked or coloured on the map
          </Typography>
        )}
      </Box>
      <Divider />

      <Box sx={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <SectionRail
          sections={railSections}
          selected={view}
          impactCount={impact.length}
          score={score}
          onSelect={setView}
        />

        <Box sx={{ flex: 1, overflowY: "auto", p: 3, minWidth: 0 }}>
          {view === IMPACT ? (
            <>
              <Typography variant="h2" gutterBottom>
                Highest impact changes
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                Ranked by the weighted points each change would add. Unanswered questions
                are included — an unknown is as much of an opportunity as a known zero.
              </Typography>
              <ImpactList
                items={impact}
                limit={20}
                onJump={(questionId) => {
                  const q = questions.find((x) => x.id === questionId);
                  if (q) setView(q.sectionId);
                }}
              />
            </>
          ) : activeSection ? (
            <>
              <Box sx={{ display: "flex", alignItems: "baseline", gap: 1.5, mb: 2 }}>
                <Typography variant="h2">{activeSection.title}</Typography>
                <Typography variant="body2">
                  {activeSection.answered}/{activeSection.total} answered
                </Typography>
              </Box>

              <Stack spacing={2}>
                {sectionQuestions.map((q) => (
                  <QuestionCard
                    key={q.id}
                    question={q}
                    response={byQuestion.get(q.id)}
                    code={code}
                    role={role}
                  />
                ))}
              </Stack>

              {role === "admin" && (
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  sx={{ mt: 2 }}
                  onClick={() => addQuestion(activeSection.id)}
                >
                  Add question
                </Button>
              )}
            </>
          ) : null}
        </Box>
      </Box>
    </Box>
  );
}
