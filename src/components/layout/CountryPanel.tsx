import { useEffect, useMemo, useRef, useState, type ReactNode, type Ref, type UIEvent } from "react";
import { Box, Button, Collapse, Divider, Stack, Typography, useMediaQuery, useTheme } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DownloadIcon from "@mui/icons-material/DownloadOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import FactCheckIcon from "@mui/icons-material/FactCheckOutlined";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import { useTranslation } from "react-i18next";

import { MAX_COMPARE_COUNTRIES, compareColorFor } from "../../lib/compareColors";
import { editsSaveToDatabase, useEditorStore } from "../../lib/editorAuth";
import { rankImpact, scoreSections, scoreTextColor, sectionLeaderboard } from "../../lib/scoring";
import { SunScore } from "../ui/Suns";
import type { CountryScore } from "../../lib/types";
import { protocol, useProtocolStore } from "../../stores/protocolStore";
import ReportOverlay from "../../../shared/pdf/ReportOverlay";
import { loadPdfAssets } from "../../../shared/pdf/assets";
import { buildPdfBlob } from "../../../shared/pdf/buildPdf";
import { buildPolicyReportModel, policyReportDate, policyReportFileName } from "../../lib/report/policyReportModel";
import ComparePicker from "./ComparePicker";
import ProposeQuestionDialog from "./ProposeQuestionDialog";
import QuestionCard from "./QuestionCard";
import SectionOverview from "./SectionOverview";
import FlagImg from "../ui/FlagImg";
import SaveStatus from "../ui/SaveStatus";
import StatTile from "../ui/StatTile";
import DetailHeader from "../../../shared/components/DetailHeader";

/**
 * How many other jurisdictions count as a section's own exemplar pool - per
 * Andrew's own instruction 2026-10-09 ("make it the exemplars"), plural
 * rather than just the single strongest comparator. Which of them actually
 * show up against any one question, and in what order, is filtered
 * further, per question - see QuestionCard.tsx's own `exemplars` prop.
 * Raised from 3 to 8 the same day ("top 3 exemplars shown and a dropdown
 * list for more") - a wider candidate pool is what makes "more" a real
 * thing to drop down to on a well-evidenced question, rather than the
 * dropdown always being empty because the pool itself topped out at 3.
 */
const EXEMPLAR_COUNT = 8;

/**
 * Hides the inline Compare row (the picker button plus the per-tile flag
 * clusters it feeds) - per Andrew's own instruction 2026-10-09 ("the
 * compare button is not very useful. Hide for now"). Picking arbitrary
 * jurisdictions to overlay turned out less useful than the exemplars
 * already surfaced per-question; the actually-wanted version is a "compare
 * to peers" feature - jurisdictions that answered similarly to this one,
 * not just any pick from the full list - which needs its own matching
 * logic (TODO, not built yet) rather than a flag flip. Flagged off here
 * rather than deleted so the existing picker UI and tile-cluster rendering
 * stay ready to revive once that's designed.
 */
const COMPARE_ENABLED = false;

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
  /**
   * Every jurisdiction's score - powers the inline compare picker
   * (JurisdictionSearch) when inlineCompare is on, and also the candidate
   * list for each section's own exemplar pool (see `sectionLeaderboard` in
   * scoring.ts) regardless of inlineCompare. Omitted entirely only by
   * CompareView's own legacy two-panel usage, which degrades to no
   * exemplars shown (the leaderboard has only this one country to rank)
   * rather than crashing.
   */
  allScores?: CountryScore[];
  /**
   * Navigates the whole app to a different country - wired to App.tsx's
   * own `handleSelectCountry`, used by a question's own exemplar column
   * (Q3: jump straight to whoever answered this specific question better).
   * Omitted by CompareView's legacy usage, which has no equivalent
   * "replace the primary country" action.
   */
  onSelectCountry?: (code: string) => void;
}

/** Two-line call to action: a short question on top, the button underneath. */
function ProposePrompt({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 0.25, flexShrink: 0 }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
        {t("proposeDialog.prompt")}
      </Typography>
      <Button size="small" variant="outlined" startIcon={<AddIcon fontSize="small" />} onClick={onClick}>
        {t("proposeDialog.link")}
      </Button>
    </Box>
  );
}

export default function CountryPanel({
  code,
  score,
  onBack,
  headerAction,
  contentRef,
  onContentScroll,
  sectionId: controlledSectionId,
  onSectionChange,
  inlineCompare,
  allScores,
  onSelectCountry,
}: Props) {
  const { t } = useTranslation();
  const sections = useProtocolStore((s) => s.sections);
  const questions = useProtocolStore((s) => s.questions);
  const responses = useProtocolStore((s) => s.responses);
  const compareCountries = useProtocolStore((s) => s.compareCountries);
  const addCompareCountry = useProtocolStore((s) => s.addCompareCountry);
  const removeCompareCountry = useProtocolStore((s) => s.removeCompareCountry);
  const theme = useTheme();
  // The section rail is a left-hand column on desktop, but that leaves too
  // little width for the answer area on a phone in portrait - below `sm` it
  // becomes a horizontal scrolling strip above the questions instead.
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  // Which section's accordion panel is open. Starts at "" (none open)
  // rather than defaulting to the first section - per Andrew's own
  // instruction 2026-10-09, the full tile grid should be what a visitor
  // sees first, with the narrow/expanded state only kicking in once
  // they've actually picked one (see `handleSelectSection` below and
  // SectionOverview.tsx's own `compact` prop).
  // The "uncontrolled" case lives in the store (not local state) so the URL
  // can carry it.
  const uncontrolledSectionId = useProtocolStore((s) => s.activeSectionId);
  const setUncontrolledSectionId = useProtocolStore((s) => s.setActiveSectionId);
  const activeSectionId = controlledSectionId ?? uncontrolledSectionId;
  const setActiveSectionId = onSectionChange ?? setUncontrolledSectionId;

  // The scrollable content area's own node - kept as a plain ref alongside
  // (not instead of) the external `contentRef` prop (CompareView's own
  // scroll-mirroring), since picking a section needs to scroll this
  // specific panel to the top regardless of whether a caller is also
  // watching it. See `handleSelectSection` below.
  const scrollRef = useRef<HTMLDivElement>(null);
  const setScrollNode = (node: HTMLDivElement | null) => {
    scrollRef.current = node;
    if (typeof contentRef === "function") contentRef(node);
    else if (contentRef) (contentRef as { current: HTMLDivElement | null }).current = node;
  };
  // Picking a section (from the full grid or the compact strip) scrolls
  // back to the top of the panel - per Andrew's own instruction 2026-10-09
  // ("when we click a tile, make them narrow and go to the top to make it
  // obvious"): shrinking the tiles alone doesn't read as a state change if
  // the visitor is already scrolled past them into a long question list, so
  // the scroll and the resize reinforce each other. Clicking the
  // already-open section again closes it, back to the full tile grid -
  // fixes a real bug flagged the same day ("we cannot return to the
  // summary view of each country after we click the tiles"): once a
  // section was open there had been no way back to the overview at all.
  // All sections' questions now sit in one scrolling list under their group heading,
  // so picking a section (a tile, or ?section= in the link) scrolls to its heading
  // and marks it. Picking the marked one again just
  // scrolls back to it; "Back to overview" clears it.
  const scrollToSection = (id: string) =>
    requestAnimationFrame(() => document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  const handleSelectSection = (id: string) => {
    if (id === activeSectionId) scrollToSection(id);
    else setActiveSectionId(id);
  };
  // Runs once the tiles have shrunk to their pinned strip, so the heading lands under it.
  useEffect(() => {
    if (activeSectionId) scrollToSection(activeSectionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSectionId, code]);
  const handleBackToOverview = () => {
    setActiveSectionId("");
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };
  const [reportOpen, setReportOpen] = useState(false);
  const [proposeOpen, setProposeOpen] = useState(false);

  // Edit mode (ROADMAP.md Phase 4): only for a signed-in editor whose changes
  // save to the policy database - QuestionCard's `editMode` unlocks its rubric
  // tiles, evidence fields and clear control. Read-only again on every country
  // switch, so browsing never inherits an edit session left open elsewhere.
  const mayEditAnswers = useEditorStore((s) => editsSaveToDatabase(s));
  const [editMode, setEditMode] = useState(false);
  useEffect(() => setEditMode(false), [code]);
  const editing = editMode && mayEditAnswers;

  // Collapses the stat tiles and the Compare row once the content below is
  // scrolled, so shrinking the header buys back the most visible content.
  // Reset on country change so reopening a different country starts from
  // the expanded header.
  const [contentScrolled, setContentScrolled] = useState(false);
  useEffect(() => setContentScrolled(false), [code]);
  const headerShrunk = isMobile && contentScrolled;
  const tileGridRef = useRef<HTMLDivElement>(null);
  const [gridOut, setGridOut] = useState(false);
  useEffect(() => setGridOut(false), [code]);
  const handleContentScroll = (e: UIEvent<HTMLDivElement>) => {
    onContentScroll?.(e);
    setContentScrolled(e.currentTarget.scrollTop > 8);
    // The full tile grid has scrolled out of view - time for the pinned strip.
    const grid = tileGridRef.current;
    setGridOut(Boolean(grid) && grid!.getBoundingClientRect().bottom < e.currentTarget.getBoundingClientRect().top + 8);
  };

  const compareCodes = COMPARE_ENABLED && inlineCompare ? compareCountries : [];
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

  // The candidate pool for "who leads this section" - every jurisdiction
  // the app already knows a score for (allScores is App.tsx's own `scores`
  // array, built fresh on every load from every country with any data at
  // all). Falls back to just this country alone when allScores is omitted
  // (CompareView's legacy usage) - the leaderboard then has only this one
  // country to rank, so every section's own exemplar list comes out empty
  // rather than crashing.
  const allCodes = useMemo(() => allScores?.map((s) => s.code) ?? [code], [allScores, code]);

  // Each section's own exemplar pool - the data behind both the tile grid
  // (SectionOverview.tsx) and the per-question exemplar columns below
  // (QuestionCard.tsx's own `exemplars` prop). Computed once here, for
  // every section at once, rather than separately per tab. No longer
  // carries a relative "leading/typical/behind" standing - dropped
  // 2026-10-09 per Andrew's own instruction once exemplars moved to a
  // per-question basis, since a section-wide standing badge sitting next
  // to a per-question exemplar column stopped making sense (a tile could
  // read "leading" while every individual question inside it shows someone
  // else out front, or vice versa).
  const sectionOverview = useMemo(
    () =>
      sectionScores.map(({ section, score: own }) => {
        const leaderboard = sectionLeaderboard(protocol, section, questions, responses, allCodes);
        // Top EXEMPLAR_COUNT other jurisdictions by overall section score,
        // best first - this is just the candidate pool a question's own
        // exemplar column draws from; which of them actually show up
        // against any one question is decided per question, not here (see
        // QuestionCard.tsx's own `exemplars` prop - "exemplars should be by
        // question not category", per Andrew's own instruction 2026-10-09).
        // Names resolved against allScores here so this stays presentational
        // data all the way down.
        const exemplars = leaderboard
          .filter((s) => s.code !== code)
          .slice(0, EXEMPLAR_COUNT)
          .map((s) => ({ code: s.code, name: allScores?.find((a) => a.code === s.code)?.name ?? s.code, score: s.score }));
        return { section, score: own, exemplars };
      }),
    [sectionScores, questions, responses, allCodes, allScores, code],
  );

  // Per-exemplar, their answer to every question in the active section -
  // only computed for the (up to EXEMPLAR_COUNT) jurisdictions actually
  // relevant to whichever section is open, not every jurisdiction's answer
  // to everything. Feeds QuestionCard.tsx's own `exemplars` prop, which
  // decides per question (not here) whether a given exemplar's answer is
  // actually worth showing.
  const exemplarResponsesByCode = useMemo(() => {
    const exemplarCodes = new Set(sectionOverview.flatMap((e) => e.exemplars.map((ex) => ex.code)));
    const byCode = new Map<string, Map<string, (typeof responses)[number]>>([...exemplarCodes].map((c) => [c, new Map()]));
    for (const r of responses) byCode.get(r.countryCode)?.set(r.questionId, r);
    return byCode;
  }, [sectionOverview, responses]);

  // Per-comparator section scores, feeding the PDF report's compare table
  // (the live UI dropped its own windrose 2026-10-09 in favour of
  // SectionOverview.tsx's tiles).
  const compareWindroseSeries = useMemo(
    () =>
      compareEntries.map((entry) => ({
        code: entry.code,
        label: entry.score?.name ?? entry.code,
        sections: scoreSections(protocol, sections, questions, responses, entry.code),
      })),
    [compareEntries, sections, questions, responses],
  );

  // The report is a real, tagged PDF made in the browser (shared/pdf) - the same one every Electric Protocol app
  // uses. Built when the preview opens, from whatever this page is showing at that moment.
  const buildReport = async () => {
    const model = buildPolicyReportModel({
      countryCode: code,
      countryName: score.name,
      generatedOn: policyReportDate(),
      score,
      sectionScores,
      impact,
      sections,
      questions,
      byQuestion,
      exemplars: Object.fromEntries(
        sectionOverview.map((e) => [
          e.section.id,
          e.exemplars.map((ex) => ({
            code: ex.code,
            name: ex.name,
            byQuestion: new Map(responses.filter((r) => r.countryCode === ex.code).map((r) => [r.questionId, r])),
          })),
        ]),
      ),
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
    });
    const assets = await loadPdfAssets(`${import.meta.env.BASE_URL}favicon.png`, 1);
    return buildPdfBlob(model, assets);
  };

  const questionGroups = useMemo(
    () =>
      sections.map((section) => ({
        section,
        questions: questions.filter((q) => q.sectionId === section.id).sort((a, b) => a.order - b.order),
      })),
    [sections, questions],
  );

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", minWidth: 0 }}>
      <Box sx={{ px: 3, pt: 2, pb: 1 }}>
        {/* Name row and stat-tile row are separate at every width - one
            shared row squeezed the country name to nothing, since the tiles
            and the report button refused to shrink and nothing wrapped. That
            happened on desktop too once the detail panel became half the
            screen (2026-10-16): at 1440px "Germany" vanished entirely and
            the report button was clipped. */}
        <DetailHeader
          onBack={onBack}
          backTooltip={t("countryPanel.backToScoreboard")}
          flag={<FlagImg code={code} size={28} />}
          name={score.name}
          sx={{ p: 0, gap: 1.5, mb: 1, flexWrap: isMobile ? "wrap" : "nowrap" }}
        >
          <Button
            size="small"
            variant="contained"
            startIcon={<DownloadIcon fontSize="small" />}
            onClick={() => setReportOpen(true)}
            sx={{ flexShrink: 0 }}
          >
            {t("countryPanel.downloadReport")}
          </Button>

          {mayEditAnswers && (
            <Button
              size="small"
              variant={editing ? "contained" : "outlined"}
              color={editing ? "secondary" : "primary"}
              startIcon={editing ? undefined : <EditOutlinedIcon fontSize="small" />}
              onClick={() => setEditMode(!editing)}
              sx={{ flexShrink: 0 }}
            >
              {editing ? t("countryPanel.doneEditing") : t("countryPanel.editAnswers")}
            </Button>
          )}
          {editing && <SaveStatus />}

          {headerAction}
        </DetailHeader>

        {/* headerShrunk is mobile-only, so on desktop this always stays open. */}
        <Collapse in={!headerShrunk}>
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 1 }}>
            <StatTile
              size="small"
              icon={<TrendingUpIcon fontSize="small" />}
              color={score.ranked ? scoreTextColor(score.score, theme.palette.mode) : theme.palette.text.disabled}
              label={t("countryPanel.score")}
              value={score.ranked ? <SunScore score={score.score} color={scoreTextColor(score.score, theme.palette.mode)} size={12} /> : t("countryPanel.notApplicable")}
            />
            <StatTile
              size="small"
              icon={<FactCheckIcon fontSize="small" />}
              color={theme.palette.primary.main}
              label={t("countryPanel.dataCompleteness")}
              value={`${Math.round(score.completeness * 100)}%`}
            />
          </Box>
        </Collapse>
      </Box>

      {/* Matches the sibling gridsim-frontend project's own sidebar - a grey
          rule under the country name, separating the header from whatever
          comes next (there, the KPI cards; here, the tab bar). No sx
          override any more - it was a literal copy of the theme's own
          light-mode divider token, which just hardcoded over dark mode's
          own value and left this one rule glowing pale grey against a dark
          surface (2026-10-09, "the colour of the tiles and sidebar more
          generally does not work in light or dark mode"); the default
          MuiDivider style in mui-theme.tsx is already mode-aware. */}
      <Divider />

      {/* Compare's own row, directly under the header rule now - the tab bar
          that used to separate them (Policy Landscape / Policy Wins) is
          gone (2026-10-09, see this component's own doc comment): Policy
          Wins was a cross-section gap list, and once every question's own
          rubric box started showing exemplars who'd already solved that
          exact gap (Q3), a separate ranked-gaps view stopped pulling its
          weight next to it, per Andrew's own instruction ("because of this
          we dont need the policy wins and we therefore dont need the
          tabs"). `rankImpact`'s own output (`impact`) still feeds the PDF
          report below, which keeps its own ranked list for a
          leave-behind summary - only the live interactive tab was
          redundant, not the underlying computation. */}
      {COMPARE_ENABLED && inlineCompare && (
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
              bgcolor: "action.hover",
              borderTop: "1px solid",
              borderColor: "divider",
            }}
          >
            <ComparePicker
              primaryCode={code}
              allScores={allScores ?? []}
              compareEntries={compareEntries}
              maxCount={MAX_COMPARE_COUNTRIES}
              onAdd={addCompareCountry}
              onRemove={removeCompareCountry}
            />
          </Box>
        </Collapse>
      )}
      <Divider />

      <Box sx={{ flex: 1, overflow: "hidden" }}>
        <Box
          ref={setScrollNode}
          onScroll={handleContentScroll}
          sx={{ height: "100%", overflowY: "auto", p: isMobile ? 1.5 : 3, minWidth: 0 }}
        >
          {/* Overview tiles + the Submit control that used to live pinned
              atop the now-removed SectionRail - combined into one row here
              since there's no rail column to anchor it to any more
              (2026-10-09, see SectionOverview.tsx's own doc comment for
              the full merge). Carries the tour's own "country-tabs"
              spotlight target too, now that the actual tab bar is gone -
              this intro row is the first thing this view shows, so it's
              the natural new anchor. */}
          <Box
            data-tour="country-tabs"
            sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2, mb: 2, flexWrap: "wrap" }}
          >
            <Typography variant="body2" sx={{ flex: "1 1 280px", minWidth: 0 }}>
              {t("countryPanel.overviewIntro", { name: score.name })}
            </Typography>
            {!activeSectionId && (
              <ProposePrompt onClick={() => setProposeOpen(true)} />
            )}
          </Box>

          {/* Explicit way back to the full tile grid, not just the implicit
              "click the open tile again" toggle in handleSelectSection -
              added 2026-10-09 after that implicit path alone turned out
              not to be discoverable ("we cannot return to the summary
              view... after we click the tiles"). */}
          {activeSectionId && (
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mb: 1.5, flexWrap: "wrap" }}>
              <Button size="small" startIcon={<ArrowBackIcon fontSize="small" />} onClick={handleBackToOverview}>
                {t("countryPanel.backToOverview")}
              </Button>
              <ProposePrompt onClick={() => setProposeOpen(true)} />
            </Box>
          )}

          {/* Once a section is open the pills become one pinned row, so
              switching areas never means scrolling back up past a long
              question list - a wrapped strip used to take ~200px above
              the questions. Negative top/margins cancel the scroll
              container's own padding so the row pins flush to its edge. */}
          {!activeSectionId && gridOut && (
            <Box sx={{ position: "sticky", top: isMobile ? -12 : -24, height: 0, zIndex: 2, mx: isMobile ? -1.5 : -3 }}>
              <Box
                sx={{
                  px: isMobile ? 1.5 : 3,
                  py: 1,
                  bgcolor: "background.paper",
                  borderBottom: "1px solid",
                  borderColor: "divider",
                }}
              >
                <SectionOverview entries={sectionOverview} selectedId="" onSelect={handleSelectSection} compact />
              </Box>
            </Box>
          )}
          <Box
            ref={activeSectionId ? undefined : tileGridRef}
            sx={
              activeSectionId
                ? {
                    position: "sticky",
                    top: isMobile ? -12 : -24,
                    zIndex: 2,
                    mx: isMobile ? -1.5 : -3,
                    px: isMobile ? 1.5 : 3,
                    py: 1,
                    bgcolor: "background.paper",
                    borderBottom: "1px solid",
                    borderColor: "divider",
                  }
                : undefined
            }
          >
            <SectionOverview
              entries={sectionOverview}
              selectedId={activeSectionId}
              onSelect={handleSelectSection}
              compact={Boolean(activeSectionId)}
            />
          </Box>

          {/* The expanded panel for whichever tile is active - that
              section's own questions, each now carrying its own exemplar
              column rather than one callout for the whole section (Q3:
              "who are the exemplars, how do we borrow their practice" -
              moved to per-question, per Andrew's own instruction
              2026-10-09, "exemplars should be by question not category" -
              see QuestionCard.tsx's own `exemplars` prop for the filtering
              logic). */}
          {questionGroups.map(({ section, questions: groupQuestions }) => (
            <Box key={section.id} sx={{ mt: 3 }}>
              <Typography
                id={`section-${section.id}`}
                variant="h6"
                component="h2"
                sx={{ mb: 1.5, scrollMarginTop: isMobile ? 64 : 72 }}
              >
                {section.title}
              </Typography>
              <Stack spacing={2}>
                {groupQuestions.map((q) => (
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
                    exemplars={(sectionOverview.find((e) => e.section.id === section.id)?.exemplars ?? []).map((ex) => ({
                      code: ex.code,
                      name: ex.name,
                      response: exemplarResponsesByCode.get(ex.code)?.get(q.id),
                    }))}
                    onSelectCountry={onSelectCountry}
                    editMode={editing}
                  />
                ))}
              </Stack>
            </Box>
          ))}
        </Box>
      </Box>

      <ProposeQuestionDialog open={proposeOpen} onClose={() => setProposeOpen(false)} defaultSectionId={activeSectionId || undefined} />

      <ReportOverlay
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        build={buildReport}
        fileName={policyReportFileName(score.name)}
        labels={{
          preview: t("report.preview"),
          making: t("report.making"),
          ready: t("report.ready"),
          failed: t("report.failed"),
          openTab: t("report.openTab"),
          pageOf: (n: number, total: number) => t("report.pageOf", { n, total }),
          download: t("report.download"),
          close: t("report.close"),
        }}
      />
    </Box>
  );
}
