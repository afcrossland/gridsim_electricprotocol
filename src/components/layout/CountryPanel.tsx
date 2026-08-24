import { useMemo, useState, type ReactNode, type Ref, type UIEvent } from "react";
import {
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  Popover,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import FactCheckIcon from "@mui/icons-material/FactCheckOutlined";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";

import { rankImpact, scoreBand, scoreLabel, scoreSections } from "../../lib/scoring";
import { IMPACT, SECTIONS, WINDROSE, type CountryPanelTab, type CountryScore } from "../../lib/types";
import { protocol, useProtocolStore } from "../../stores/protocolStore";
import ImpactList from "./ImpactList";
import QuestionCard from "./QuestionCard";
import SectionWindrose from "./SectionWindrose";
import SectionRail, { type RailSection } from "./SectionRail";
import FlagImg from "../ui/FlagImg";
import JurisdictionSearch from "../map/JurisdictionSearch";
import StatTile from "../ui/StatTile";

export { IMPACT, SECTIONS, WINDROSE, type CountryPanelTab };

interface Props {
  code: string;
  score: CountryScore;
  /** Omit to hide the back arrow - used for the compare slot, which has its own way out (removing it). */
  onBack?: () => void;
  /** Rendered top-right of the header, next to the title - a Compare button, an exit-compare control, and so on. Keeps this component agnostic of what's calling it. */
  headerAction?: ReactNode;
  /** For syncing scroll position with another panel (the compare view) - both optional, unused outside that case. */
  contentRef?: Ref<HTMLDivElement>;
  onContentScroll?: (e: UIEvent<HTMLDivElement>) => void;
  /**
   * Controls the active tab from outside - the compare view shares one tab
   * between both panels rather than letting each track its own, so the pair
   * always shows the same thing side by side. Uncontrolled (manages its own
   * state) when omitted, the normal single-panel case.
   */
  tab?: CountryPanelTab;
  onTabChange?: (tab: CountryPanelTab) => void;
  /** Hides the tab bar itself - the compare view's second panel shares the first panel's tab bar as the one control for both, so its own would just be a redundant, disconnected-looking duplicate. */
  hideTabs?: boolean;
  /**
   * Controls which section the rail shows, the same controlled/uncontrolled
   * pattern as `tab` and for the same reason - the compare view shares one
   * section selection between both panels (they cover the same question set
   * either way, so "section 4" means the same thing on both sides) so
   * picking a section on either side switches both.
   */
  sectionId?: string;
  onSectionChange?: (id: string) => void;
  /**
   * Turns on the inline compare control (a button that opens a jurisdiction
   * picker, or a chip for the current pick) plus the per-question compare
   * tiles and the dual-series windrose. Off by default so CompareView's own
   * two-panel usage of this component is unaffected - the old full-screen
   * compare view is disconnected from the UI, not deleted, so it stays easy
   * to bring back; this flag is what keeps the two from fighting over the
   * same `compareCountry` state if it ever is.
   */
  inlineCompare?: boolean;
  /** Every jurisdiction's score, needed only to power the inline compare picker (JurisdictionSearch) - unused when inlineCompare is off. */
  allScores?: CountryScore[];
}

export default function CountryPanel({
  code,
  score,
  onBack,
  headerAction,
  contentRef,
  onContentScroll,
  tab: controlledTab,
  onTabChange,
  hideTabs,
  sectionId: controlledSectionId,
  onSectionChange,
  inlineCompare,
  allScores,
}: Props) {
  const sections = useProtocolStore((s) => s.sections);
  const questions = useProtocolStore((s) => s.questions);
  const responses = useProtocolStore((s) => s.responses);
  const compareCountry = useProtocolStore((s) => s.compareCountry);
  const setCompareCountry = useProtocolStore((s) => s.setCompareCountry);
  const theme = useTheme();
  // The section rail is a left-hand column on desktop, but that leaves too
  // little width for the answer area on a phone in portrait - below `sm` it
  // becomes a horizontal scrolling strip above the questions instead.
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  // Which section the rail is showing, independent of which top-level tab is
  // active, so switching to Highest impact and back does not lose the place.
  const [uncontrolledSectionId, setUncontrolledSectionId] = useState<string>(sections[0]?.id ?? "");
  const activeSectionId = controlledSectionId ?? uncontrolledSectionId;
  const setActiveSectionId = onSectionChange ?? setUncontrolledSectionId;
  const [uncontrolledTab, setUncontrolledTab] = useState<CountryPanelTab>(WINDROSE);
  const tab = controlledTab ?? uncontrolledTab;
  const setTab = onTabChange ?? setUncontrolledTab;
  const [comparePickerAnchor, setComparePickerAnchor] = useState<HTMLElement | null>(null);

  const compareCode = inlineCompare ? compareCountry : null;
  const compareScore = compareCode ? allScores?.find((s) => s.code === compareCode) : undefined;

  const byQuestion = useMemo(
    () => new Map(responses.filter((r) => r.countryCode === code).map((r) => [r.questionId, r])),
    [responses, code],
  );

  const compareByQuestion = useMemo(
    () =>
      compareCode
        ? new Map(responses.filter((r) => r.countryCode === compareCode).map((r) => [r.questionId, r]))
        : null,
    [responses, compareCode],
  );

  const impact = useMemo(
    () => rankImpact(protocol, questions, sections, responses, code),
    [questions, sections, responses, code],
  );

  const sectionScores = useMemo(
    () => scoreSections(protocol, sections, questions, responses, code),
    [sections, questions, responses, code],
  );

  const compareSectionScores = useMemo(
    () => (compareCode ? scoreSections(protocol, sections, questions, responses, compareCode) : undefined),
    [sections, questions, responses, compareCode],
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
      <Box sx={{ px: 3, py: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}>
          {onBack && (
            <Tooltip title="Back to scoreboard">
              <IconButton size="small" onClick={onBack}>
                <ArrowBackIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <FlagImg code={code} size={28} />
          <Typography variant="h2" sx={{ flex: 1, minWidth: 0 }} noWrap>
            {score.name}
          </Typography>
          {headerAction}

          {inlineCompare &&
            (compareCode && compareScore ? (
              <Chip
                icon={<FlagImg code={compareCode} size={16} />}
                label={`vs ${compareScore.name}`}
                onDelete={() => setCompareCountry(null)}
                sx={{ maxWidth: 220 }}
              />
            ) : (
              <>
                <Button
                  size="small"
                  data-tour="compare-button"
                  startIcon={<CompareArrowsIcon fontSize="small" />}
                  onClick={(e) => setComparePickerAnchor(e.currentTarget)}
                >
                  Compare
                </Button>
                <Popover
                  open={Boolean(comparePickerAnchor)}
                  anchorEl={comparePickerAnchor}
                  onClose={() => setComparePickerAnchor(null)}
                  anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                  transformOrigin={{ vertical: "top", horizontal: "right" }}
                >
                  <Box sx={{ p: 2, width: 320 }}>
                    <Typography variant="body2" sx={{ mb: 1.5 }}>
                      Compare {score.name} against:
                    </Typography>
                    <JurisdictionSearch
                      scores={allScores ?? []}
                      selected={null}
                      onSelect={(picked) => {
                        setCompareCountry(picked);
                        setComparePickerAnchor(null);
                      }}
                      // Portal to <body> rather than the default disabled-
                      // portal behaviour - a disabled-portal dropdown is
                      // clipped by this Popover's own Paper, which is what
                      // made it unreadable rather than just misplaced.
                      disablePortal={false}
                    />
                  </Box>
                </Popover>
              </>
            ))}
        </Box>

        <Box sx={{ display: "flex", gap: 1.5 }}>
          <StatTile
            icon={<TrendingUpIcon fontSize="small" />}
            color={score.ranked ? scoreBand(score.score).color : theme.palette.text.disabled}
            label="Score"
            value={score.ranked ? scoreLabel(score.score) : "Not enough data to score yet"}
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
          item competing with 9 section names for attention.
          `hideTabs` hides this visually (visibility, not display/omission) -
          the compare view's second panel needs the same height reserved
          here as the first panel's real tab bar, or its header ends up
          shorter and everything below stops lining up between the two,
          including what the scroll-position mirror is actually syncing to. */}
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        data-tour="country-tabs"
        sx={{ px: 2, visibility: hideTabs ? "hidden" : "visible" }}
      >
        <Tab value={WINDROSE} label="Summary" />
        <Tab value={SECTIONS} label="Policy Score and Evidence" />
        <Tab value={IMPACT} label="Biggest Policy Wins" />
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

        <Box ref={contentRef} onScroll={onContentScroll} sx={{ flex: 1, overflowY: "auto", p: 3, minWidth: 0 }}>
          {tab === IMPACT ? (
            <>
              <Typography variant="h2" gutterBottom>
                Biggest policy wins
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                Biggest policy wins based on policy score and evidence provided.
              </Typography>
              <ImpactList items={impact} limit={20} />
            </>
          ) : tab === WINDROSE ? (
            <>
              <Typography variant="body2" sx={{ mb: 2 }}>
                How {score.name} scores in each area, and how much of it is
                backed by evidence. A dashed marker just means there isn't
                enough data yet - not a score of zero.
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
                <Box
                  sx={{
                    flex: "1 1 320px",
                    textAlign: "center",
                    bgcolor: "#F9FAFB",
                    border: "0.5px solid #E5E7EB",
                    borderRadius: "8px",
                    p: 2,
                  }}
                >
                  <Typography variant="overline" sx={{ display: "block", color: "primary.dark" }}>
                    Score
                  </Typography>
                  <SectionWindrose
                    sections={sectionScores}
                    metric="score"
                    compareSections={compareSectionScores}
                    primaryLabel={score.name}
                    compareLabel={compareScore?.name}
                  />
                </Box>
                <Box
                  sx={{
                    flex: "1 1 320px",
                    textAlign: "center",
                    bgcolor: "#F9FAFB",
                    border: "0.5px solid #E5E7EB",
                    borderRadius: "8px",
                    p: 2,
                  }}
                >
                  <Typography variant="overline" sx={{ display: "block", color: "primary.dark" }}>
                    Data completeness
                  </Typography>
                  <SectionWindrose
                    sections={sectionScores}
                    metric="completeness"
                    compareSections={compareSectionScores}
                    primaryLabel={score.name}
                    compareLabel={compareScore?.name}
                  />
                </Box>
              </Box>
            </>
          ) : activeSection ? (
            <>
              <Stack spacing={2}>
                {sectionQuestions.map((q) => (
                  <QuestionCard
                    key={q.id}
                    question={q}
                    response={byQuestion.get(q.id)}
                    code={code}
                    compareCode={compareCode ?? undefined}
                    compareResponse={compareByQuestion?.get(q.id)}
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
