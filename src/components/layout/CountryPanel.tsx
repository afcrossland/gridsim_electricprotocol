import { useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from "@mui/material";
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
const SECTIONS = "sections";

export default function CountryPanel({ code, score, onBack }: Props) {
  const role = useProtocolStore((s) => s.role);
  const sections = useProtocolStore((s) => s.sections);
  const questions = useProtocolStore((s) => s.questions);
  const responses = useProtocolStore((s) => s.responses);
  const addQuestion = useProtocolStore((s) => s.addQuestion);
  const threshold = useProtocolStore((s) => s.threshold);

  // Which section the rail is showing, independent of which top-level tab is
  // active, so switching to Highest impact and back does not lose the place.
  const [activeSectionId, setActiveSectionId] = useState<string>(sections[0]?.id ?? "");
  const [tab, setTab] = useState<typeof IMPACT | typeof SECTIONS>(IMPACT);

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

  const activeSection = railSections.find((s) => s.id === activeSectionId) ?? null;
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
      {/* Name on the left, score pinned to the right and labelled, so the
          number reads as "Score: 62%" at a glance rather than a bare figure. */}
      <Box sx={{ px: 3, py: 2, display: "flex", alignItems: "center", gap: 1.5 }}>
        <Tooltip title="Back to scoreboard">
          <IconButton size="small" onClick={onBack}>
            <ArrowBackIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <FlagImg code={code} size={28} />
        <Typography variant="h2" sx={{ flex: 1, minWidth: 0 }} noWrap>
          {score.name}
        </Typography>

        <Box sx={{ textAlign: "right", flexShrink: 0 }}>
          <Typography variant="overline" sx={{ display: "block", lineHeight: 1.2 }}>
            Score
          </Typography>
          <Typography
            variant="h2"
            sx={{ color: score.ranked ? scoreColor(score.score) : "text.disabled", lineHeight: 1 }}
          >
            {score.ranked ? `${Math.round(score.score * 100)}%` : " - "}
          </Typography>
        </Box>
      </Box>

      {!score.ranked && (
        <Typography variant="caption" sx={{ px: 3, pb: 1, display: "block" }}>
          Below the {Math.round(threshold * 100)}% completeness threshold, so not ranked
          or coloured on the map.
        </Typography>
      )}

      {/* The single most useful thing to do with a country's page is see what
          would raise its score, so that gets a real tab rather than a rail
          item competing with 9 section names for attention. */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2 }}>
        <Tab value={SECTIONS} label="Answer the questions" />
        <Tab
          value={IMPACT}
          label={
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              Find the biggest wins
              <Chip size="small" label={impact.length} sx={{ height: 18, fontSize: "0.7rem" }} />
            </Box>
          }
        />
      </Tabs>
      <Divider />

      <Box sx={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {tab === SECTIONS && (
          <SectionRail
            sections={railSections}
            selected={activeSectionId}
            score={score}
            onSelect={setActiveSectionId}
          />
        )}

        <Box sx={{ flex: 1, overflowY: "auto", p: 3, minWidth: 0 }}>
          {tab === IMPACT ? (
            <>
              <Typography variant="h2" gutterBottom>
                Highest impact changes
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                Ranked by the weighted points each change would add. Unanswered questions
                are included - an unknown is as much of an opportunity as a known zero.
              </Typography>
              <ImpactList
                items={impact}
                limit={20}
                onJump={(questionId) => {
                  const q = questions.find((x) => x.id === questionId);
                  if (q) {
                    setActiveSectionId(q.sectionId);
                    setTab(SECTIONS);
                  }
                }}
              />
            </>
          ) : activeSection ? (
            <>
              <Box sx={{ display: "flex", alignItems: "baseline", gap: 1.5, mb: 1 }}>
                <Typography variant="h2">{activeSection.title}</Typography>
                <Typography variant="body2">
                  {activeSection.answered}/{activeSection.total} answered
                </Typography>
              </Box>

              <Typography variant="body2" sx={{ mb: 2 }}>
                For each question, choose the statement that is true of {score.name}{" "}
                today, then open <strong>Evidence</strong> to record the law, regulator
                decision or document it rests on. Questions with an amber edge have no
                answer yet.
              </Typography>

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
