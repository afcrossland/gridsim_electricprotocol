import { useMemo, useState } from "react";
import {
  Box,
  Chip,
  Divider,
  FormControlLabel,
  IconButton,
  Stack,
  Switch,
  Tab,
  Tabs,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import FactCheckIcon from "@mui/icons-material/FactCheckOutlined";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";

import { rankImpact, scoreBand, scoreLabel } from "../../lib/scoring";
import type { CountryScore } from "../../lib/types";
import { protocol, useProtocolStore } from "../../stores/protocolStore";
import ImpactList from "./ImpactList";
import QuestionCard from "./QuestionCard";
import SectionRail, { type RailSection } from "./SectionRail";
import FlagImg from "../ui/FlagImg";
import StatTile from "../ui/StatTile";

interface Props {
  code: string;
  score: CountryScore;
  onBack: () => void;
}

const IMPACT = "impact";
const SECTIONS = "sections";

export default function CountryPanel({ code, score, onBack }: Props) {
  const sections = useProtocolStore((s) => s.sections);
  const questions = useProtocolStore((s) => s.questions);
  const responses = useProtocolStore((s) => s.responses);
  const theme = useTheme();
  // The section rail is a left-hand column on desktop, but that leaves too
  // little width for the answer area on a phone in portrait - below `sm` it
  // becomes a horizontal scrolling strip above the questions instead.
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  // Which section the rail is showing, independent of which top-level tab is
  // active, so switching to Highest impact and back does not lose the place.
  const [activeSectionId, setActiveSectionId] = useState<string>(sections[0]?.id ?? "");
  const [tab, setTab] = useState<typeof IMPACT | typeof SECTIONS>(SECTIONS);
  const [unansweredOnly, setUnansweredOnly] = useState(false);

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
  const visibleQuestions = unansweredOnly
    ? sectionQuestions.filter((q) => !byQuestion.has(q.id))
    : sectionQuestions;

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", minWidth: 0 }}>
      <Box sx={{ px: 3, py: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}>
          <Tooltip title="Back to scoreboard">
            <IconButton size="small" onClick={onBack}>
              <ArrowBackIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <FlagImg code={code} size={28} />
          <Typography variant="h2" sx={{ flex: 1, minWidth: 0 }} noWrap>
            {score.name}
          </Typography>
        </Box>

        <Box sx={{ display: "flex", gap: 1.5 }}>
          <StatTile
            icon={<TrendingUpIcon fontSize="small" />}
            color={score.ranked ? scoreBand(score.score).color : theme.palette.text.disabled}
            label="Score"
            value={score.ranked ? scoreLabel(score.score) : " - "}
            detail={score.ranked ? undefined : "Not enough data"}
            fill={score.ranked ? score.score : undefined}
          />
          <StatTile
            icon={<FactCheckIcon fontSize="small" />}
            color={theme.palette.primary.main}
            label="Data completeness"
            value={`${Math.round(score.completeness * 100)}%`}
            detail={`${score.answered}/${score.total} answered`}
            fill={score.completeness}
          />
        </Box>
      </Box>

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

      <Box sx={{ flex: 1, display: "flex", flexDirection: isMobile ? "column" : "row", overflow: "hidden" }}>
        {tab === SECTIONS && (
          <SectionRail
            sections={railSections}
            selected={activeSectionId}
            score={score}
            onSelect={setActiveSectionId}
            horizontal={isMobile}
          />
        )}

        <Box sx={{ flex: 1, overflowY: "auto", p: 3, minWidth: 0 }}>
          {tab === IMPACT ? (
            <>
              <Typography variant="h2" gutterBottom>
                Highest impact changes
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                Answered questions not yet at full marks, ranked by the weighted points
                each would add. Unanswered questions are not included here - switch to{" "}
                <strong>Answer the questions</strong> and filter to unanswered to find
                those.
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
              <Box
                sx={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 1.5,
                  mb: 1,
                }}
              >
                <Box sx={{ display: "flex", alignItems: "baseline", gap: 1.5 }}>
                  <Typography variant="h2">{activeSection.title}</Typography>
                  <Typography variant="body2">
                    {activeSection.answered}/{activeSection.total} answered
                  </Typography>
                </Box>

                <FormControlLabel
                  sx={{ m: 0 }}
                  control={
                    <Switch
                      size="small"
                      checked={unansweredOnly}
                      onChange={(e) => setUnansweredOnly(e.target.checked)}
                    />
                  }
                  label={<Typography variant="body2">Unanswered only</Typography>}
                />
              </Box>

              <Typography variant="body2" sx={{ mb: 2 }}>
                For each question, choose the statement that is true of {score.name}{" "}
                today, then open <strong>Evidence</strong> to record the law, regulator
                decision or document it rests on. Questions with an amber edge have no
                answer yet.
              </Typography>

              {visibleQuestions.length === 0 && (
                <Typography variant="body2" sx={{ mb: 2 }}>
                  Every question in this section is answered.
                </Typography>
              )}

              <Stack spacing={2}>
                {visibleQuestions.map((q) => (
                  <QuestionCard
                    key={q.id}
                    question={q}
                    response={byQuestion.get(q.id)}
                    code={code}
                  />
                ))}
              </Stack>
            </>
          ) : null}
        </Box>
      </Box>
    </Box>
  );
}
