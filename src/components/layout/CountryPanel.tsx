import { useEffect, useMemo, useState, type ReactNode, type Ref, type UIEvent } from "react";
import {
  Box,
  Button,
  Collapse,
  Divider,
  IconButton,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DownloadIcon from "@mui/icons-material/DownloadOutlined";
import FactCheckIcon from "@mui/icons-material/FactCheckOutlined";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";

import { MAX_COMPARE_COUNTRIES, compareColorFor } from "../../lib/compareColors";
import { rankImpact, scoreBand, scoreLabel, scoreSections } from "../../lib/scoring";
import { diffResponses } from "../../lib/suggestions";
import { IMPACT, SECTIONS, WINDROSE, type CountryPanelTab, type CountryScore } from "../../lib/types";
import { protocol, useProtocolStore } from "../../stores/protocolStore";
import { generateCountryReportPdf, fmtReportDate, fmtTimestamp } from "../../utils/exportCountryReportPdf";
import CountryReportDocument from "../report/CountryReportDocument";
import ComparePicker from "./ComparePicker";
import ImpactList from "./ImpactList";
import QuestionCard from "./QuestionCard";
import SectionWindrose from "./SectionWindrose";
import SectionRail, { type RailSection } from "./SectionRail";
import SubmitSuggestionDialog from "./SubmitSuggestionDialog";
import FlagImg from "../ui/FlagImg";
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
   * Turns on the inline compare control (a chip list plus an add button,
   * capped at MAX_COMPARE_COUNTRIES) plus the per-question rubric flag
   * clusters and the multi-series windrose. Off by default so CompareView's
   * own two-panel usage of this component is unaffected - the old
   * full-screen compare view is disconnected from the UI, not deleted, so
   * it stays easy to bring back; this flag is what keeps the two from
   * fighting over the same `compareCountries` state if it ever is.
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
  const compareCountries = useProtocolStore((s) => s.compareCountries);
  const addCompareCountry = useProtocolStore((s) => s.addCompareCountry);
  const removeCompareCountry = useProtocolStore((s) => s.removeCompareCountry);
  const editBaselines = useProtocolStore((s) => s.editBaselines);
  const captureEditBaseline = useProtocolStore((s) => s.captureEditBaseline);
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
  const [submitOpen, setSubmitOpen] = useState(false);
  const [buildingReport, setBuildingReport] = useState(false);

  // Collapses the stat tiles and the Compare/Download row once the content
  // below is scrolled, on Policy Wins and Policy Landscape specifically -
  // those are the two tabs with a real scrolling list, so shrinking the
  // header there buys back the most visible content. Reset on tab/country
  // change so reopening a section starts from the expanded header.
  const [contentScrolled, setContentScrolled] = useState(false);
  useEffect(() => setContentScrolled(false), [tab, code]);
  const headerShrunk = isMobile && contentScrolled && (tab === IMPACT || tab === SECTIONS);
  const handleContentScroll = (e: UIEvent<HTMLDivElement>) => {
    onContentScroll?.(e);
    setContentScrolled(e.currentTarget.scrollTop > 8);
  };

  const compareCodes = inlineCompare ? compareCountries : [];
  // Colour assignment order = pick order, stable regardless of removals
  // elsewhere in the list - see compareColorFor's own doc comment.
  const compareEntries = useMemo(
    () =>
      compareCodes.map((c, i) => ({
        code: c,
        color: compareColorFor(i),
        score: allScores?.find((s) => s.code === c),
      })),
    [compareCodes, allScores],
  );

  // First time this country's page is opened this session, snapshot its
  // responses as the baseline "Submit revised evidence" diffs against -
  // see captureEditBaseline's own doc comment for why this is a no-op on
  // every subsequent render/re-selection of the same country.
  useEffect(() => {
    captureEditBaseline(code);
  }, [code, captureEditBaseline]);

  // Never let a bug in this diff take the whole page down with it - all it
  // drives is the "Submit revised evidence" button's label/enabled state,
  // so falling back to "nothing to report" is always a safe failure mode.
  const pendingChanges = useMemo(() => {
    try {
      return diffResponses(editBaselines[code] ?? [], responses.filter((r) => r.countryCode === code), questions);
    } catch (err) {
      console.error("diffResponses failed", err);
      return [];
    }
  }, [editBaselines, code, responses, questions]);

  const byQuestion = useMemo(
    () => new Map(responses.filter((r) => r.countryCode === code).map((r) => [r.questionId, r])),
    [responses, code],
  );

  // Per comparator, its answer to every question - questionId -> Response.
  const compareByQuestionByCode = useMemo(
    () =>
      new Map(
        compareCodes.map((c) => [
          c,
          new Map(responses.filter((r) => r.countryCode === c).map((r) => [r.questionId, r])),
        ]),
      ),
    [responses, compareCodes],
  );

  const impact = useMemo(
    () => rankImpact(protocol, questions, sections, responses, code),
    [questions, sections, responses, code],
  );

  const sectionScores = useMemo(
    () => scoreSections(protocol, sections, questions, responses, code),
    [sections, questions, responses, code],
  );

  // One SectionWindrose "series" per comparator - computed once here and fed
  // to both the Score and Data completeness tiles, rather than each tile
  // recomputing scoreSections for every comparator itself.
  const compareWindroseSeries = useMemo(
    () =>
      compareEntries.map((entry) => ({
        code: entry.code,
        label: entry.score?.name ?? entry.code,
        sections: scoreSections(protocol, sections, questions, responses, entry.code),
      })),
    [compareEntries, sections, questions, responses],
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

  // Jumps from a "Submit revised evidence" tile straight to the question it's
  // about - closes the dialog, switches to the section that owns it, then
  // scrolls once the section's questions have actually rendered (a single
  // rAF landed before the section-switch's own re-render in testing, so this
  // waits two).
  const goToQuestion = (questionId: string) => {
    const question = questions.find((q) => q.id === questionId);
    if (!question) return;
    setSubmitOpen(false);
    setTab(SECTIONS);
    setActiveSectionId(question.sectionId);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document
          .getElementById(`question-${questionId}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });
  };

  // Mounts CountryReportDocument off-screen (see the render below), waits a
  // couple of frames for it to actually lay out, then rasterises it into a
  // PDF - same two-step shape as the sibling gridsim-frontend project's own
  // report export (ResultsPanel.tsx's handleExportPdf there): render first,
  // capture second, because html2canvas needs real painted pixels to read.
  const handleDownloadReport = async () => {
    setBuildingReport(true);
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    try {
      await generateCountryReportPdf(
        "country-report-root",
        `Solar Policy Explorer - ${score.name} - ${fmtTimestamp()}.pdf`,
      );
    } finally {
      setBuildingReport(false);
    }
  };

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
      <Box sx={{ px: 3, pt: 2, pb: 1 }}>
        {/* Name row and stat-tile row are separate on mobile - one shared
            row squeezed the country name toward nothing on a narrow screen,
            since the tiles and headerAction refused to shrink and nothing
            wrapped. Desktop keeps them on one line, where there's room. */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            mb: isMobile ? 1 : 1.5,
            flexWrap: isMobile ? "wrap" : "nowrap",
          }}
        >
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

          {!isMobile && (
            <>
              <Box sx={{ flexShrink: 0 }}>
                <StatTile
                  size="small"
                  icon={<TrendingUpIcon fontSize="small" />}
                  color={score.ranked ? scoreBand(score.score).color : theme.palette.text.disabled}
                  label="Score"
                  value={score.ranked ? scoreLabel(score.score) : "N/A"}
                />
              </Box>
              <Box sx={{ flexShrink: 0 }}>
                <StatTile
                  size="small"
                  icon={<FactCheckIcon fontSize="small" />}
                  color={theme.palette.primary.main}
                  label="Data completeness"
                  value={`${Math.round(score.completeness * 100)}%`}
                />
              </Box>
            </>
          )}

          {headerAction}
        </Box>

        {isMobile && (
          <Collapse in={!headerShrunk}>
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 1 }}>
              <StatTile
                size="small"
                icon={<TrendingUpIcon fontSize="small" />}
                color={score.ranked ? scoreBand(score.score).color : theme.palette.text.disabled}
                label="Score"
                value={score.ranked ? scoreLabel(score.score) : "N/A"}
              />
              <StatTile
                size="small"
                icon={<FactCheckIcon fontSize="small" />}
                color={theme.palette.primary.main}
                label="Data completeness"
                value={`${Math.round(score.completeness * 100)}%`}
              />
            </Box>
          </Collapse>
        )}
      </Box>

      {/* Matches the sibling gridsim-frontend project's own sidebar - a grey
          rule under the country name, separating the header from whatever
          comes next (there, the KPI cards; here, the tab bar). */}
      <Divider sx={{ borderColor: "#E5E7EB" }} />

      {/* The single most useful thing to do with a country's page is see what
          would raise its score, so that gets a real tab rather than a rail
          item competing with 9 section names for attention.
          `hideTabs` hides this visually (visibility, not display/omission) -
          the compare view's second panel needs the same height reserved
          here as the first panel's real tab bar, or its header ends up
          shorter and everything below stops lining up between the two,
          including what the scroll-position mirror is actually syncing to. */}
      <Box sx={{ px: 2, pt: 1 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          data-tour="country-tabs"
          variant={isMobile ? "fullWidth" : "scrollable"}
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{ minWidth: 0, visibility: hideTabs ? "hidden" : "visible" }}
        >
          <Tab value={WINDROSE} label="Summary" />
          <Tab value={IMPACT} label="Policy Wins" />
          <Tab value={SECTIONS} label="Policy Landscape" />
        </Tabs>
      </Box>

      {/* Its own row below the tabs, not squeezed onto the same line - the
          download button sharing a row with the tabs rendered on top of
          them once the tabs had room to be scrollable/wrap on a narrow
          screen; up to MAX_COMPARE_COUNTRIES compare chips (a jurisdiction
          name like "New South Wales" is not short) plus the add button
          don't reliably fit alongside three tabs either. Compare and
          Download sit together here instead. */}
      <Collapse in={!headerShrunk}>
        <Box
          sx={{
            display: "flex",
            justifyContent: isMobile ? "center" : "flex-start",
            alignItems: "center",
            gap: 1,
            px: 2,
            py: 1.5,
            flexWrap: "wrap",
            bgcolor: "#F9FAFB",
            borderTop: "1px solid",
            borderColor: "divider",
          }}
        >
          {inlineCompare && (
            <ComparePicker
              primaryCode={code}
              allScores={allScores ?? []}
              compareEntries={compareEntries}
              maxCount={MAX_COMPARE_COUNTRIES}
              onAdd={addCompareCountry}
              onRemove={removeCompareCountry}
            />
          )}
          <Button
            size="small"
            variant="contained"
            startIcon={<DownloadIcon fontSize="small" />}
            disabled={buildingReport}
            onClick={handleDownloadReport}
            sx={{ flexShrink: 0 }}
          >
            {buildingReport ? "Building report..." : "Download report"}
          </Button>
        </Box>
      </Collapse>
      <Divider />

      <Box sx={{ flex: 1, display: "flex", flexDirection: isMobile ? "column" : "row", overflow: "hidden" }}>
        {tab === SECTIONS && (
          <SectionRail
            sections={railSections}
            selected={activeSectionId}
            onSelect={setActiveSectionId}
            horizontal={isMobile}
            pendingCount={pendingChanges.length}
            onSubmit={() => setSubmitOpen(true)}
          />
        )}

        <Box
          ref={contentRef}
          onScroll={handleContentScroll}
          sx={{ flex: 1, overflowY: "auto", p: isMobile ? 1.5 : 3, minWidth: 0 }}
        >
          {tab === WINDROSE ? (
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
                    compareSeries={compareWindroseSeries}
                    primaryLabel={score.name}
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
                    compareSeries={compareWindroseSeries}
                    primaryLabel={score.name}
                  />
                </Box>
              </Box>
            </>
          ) : tab === IMPACT ? (
            <>
              <Typography variant="body2" sx={{ mb: 2 }}>
                Biggest policy wins based on policy score and evidence provided.
              </Typography>
              <ImpactList items={impact} limit={20} />
            </>
          ) : activeSection ? (
            <Stack spacing={2}>
              {sectionQuestions.map((q) => (
                <QuestionCard
                  key={q.id}
                  question={q}
                  response={byQuestion.get(q.id)}
                  code={code}
                  compareEntries={compareEntries.map((entry) => ({
                    code: entry.code,
                    color: entry.color,
                    name: entry.score?.name,
                    response: compareByQuestionByCode.get(entry.code)?.get(q.id),
                  }))}
                />
              ))}
            </Stack>
          ) : null}
        </Box>
      </Box>

      <SubmitSuggestionDialog
        open={submitOpen}
        onClose={() => setSubmitOpen(false)}
        countryCode={code}
        countryName={score.name}
        onNavigateToQuestion={goToQuestion}
      />

      {/* Mounted off-screen only while a download is in flight - handleDownloadReport
          waits two animation frames for this to actually paint before html2canvas
          captures it. Matches the sibling gridsim-frontend project's own report
          export (ResultsPanel.tsx there mounts ReportDocument the same way). */}
      {buildingReport && (
        <Box sx={{ position: "fixed", top: 0, left: "-99999px", pointerEvents: "none" }} aria-hidden="true">
          <CountryReportDocument
            data={{
              countryCode: code,
              countryName: score.name,
              generatedOn: fmtReportDate(),
              score,
              sectionScores,
              impact,
              sections,
              questions,
              byQuestion,
              compareEntries: compareEntries
                .filter((entry) => entry.score)
                .map((entry) => ({
                  code: entry.code,
                  name: entry.score!.name,
                  color: entry.color,
                  score: entry.score!,
                  sections: compareWindroseSeries.find((s) => s.code === entry.code)?.sections ?? [],
                  byQuestion: compareByQuestionByCode.get(entry.code) ?? new Map(),
                })),
            }}
          />
        </Box>
      )}
    </Box>
  );
}
