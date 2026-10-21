import { useState } from "react";
import CorrectionDialog from "./CorrectionDialog";
import Linkified from "./Linkified";
import {
  Box,
  Button,
  ButtonBase,
  Collapse,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Popover,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import { useTranslation } from "react-i18next";

import type { Question, Response } from "../../lib/types";
import { SCORE_BANDS } from "../../lib/scoring";
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

export interface ExemplarEntry {
  code: string;
  name: string;
  /** Undefined when this exemplar hasn't answered this specific question - excluded from the rendered column, see the component's own doc comment. */
  response: Response | undefined;
}

interface Props {
  question: Question;
  response: Response | undefined;
  code: string;
  /** Empty outside compare mode - see CountryPanel's `inlineCompare`. */
  compareEntries?: CompareEntry[];
  /**
   * This section's own exemplar pool (CountryPanel.tsx's `sectionOverview`,
   * up to EXEMPLAR_COUNT jurisdictions, ranked by overall section score) -
   * not every one of them renders against every question, only those whose
   * own answer to *this* question scores the same or higher than this
   * country's, see the component's own doc comment for why.
   */
  exemplars?: ExemplarEntry[];
  /**
   * Navigates to a different country - wired to CountryPanel's own
   * onSelectCountry. No longer the default click action on an exemplar
   * (2026-10-09, "when we click on that country, dont swap to that
   * country view, have a pop-up with the evidence for it") - clicking now
   * opens that exemplar's evidence in place; this is only reached from the
   * popup's own "view country profile" link, an explicit opt-in rather
   * than the click itself. Omitted when nothing should be clickable
   * (CompareView's legacy usage) - the link just doesn't render then.
   */
  onSelectCountry?: (code: string) => void;
  /** Gates every write action (rubric tiles, evidence fields, clear response) behind CountryPanel's Edit toggle - off by default, a read-only view of whatever's already answered. */
  editMode?: boolean;
}

/**
 * The chosen rubric tier is marked by a soft neutral fill, a slight lift and
 * a labelled "<Country>'s answer" badge, not a colour. (A solid text-colour
 * outline was tried first and read as too heavy, 2026-10-21.) It used to be GSC Citrus, but
 * since the score ramp was inverted (2026-10-21) amber also means "strong",
 * so a highlighted Weak answer read as a good one, and the citrus exemplar
 * names beside it blurred the two further. Colour on a tier now only ever
 * means how strong that tier is (its left edge and label).
 */
const SELECTED_TINT = "action.selected";

/** How many of a tier box's own qualifying exemplars show inline before the rest fold into a "+N more" dropdown - per Andrew's own instruction 2026-10-09 ("top 3 exemplars shown and a dropdown list for more"). */
const EXEMPLAR_DISPLAY_LIMIT = 3;

/** Width of the Strong/Developed/Weak label column on each answer tile - the exemplars block is indented by this (plus the 10px gap) so it lines up under the answer text. */
const TIER_LABEL_WIDTH = 92;

/**
 * An exemplar is only worth surfacing if there's something to actually show
 * in its evidence popup - per Andrew's own instruction 2026-10-09 ("only
 * show exemplars if there is a complete set of evidence to that qn
 * answer"). A bare score with no citation, or a citation missing the
 * fields that identify it (what it is, where it's from), isn't evidence a
 * reader can act on - `note` (the free-text justification) is left out of
 * the check since a real citation can legitimately have nothing more to
 * add there.
 */
function hasCompleteEvidence(response: Response | undefined): response is Response {
  if (!response || response.evidence.length === 0) return false;
  return response.evidence.every((e) => e.title.trim() !== "" && e.source.trim() !== "");
}

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
 * Each exemplar (added 2026-10-09, per Andrew's own instruction "exemplars
 * should be by question not category") is pinned to whichever rubric tier
 * box *they themselves* answered this question with - not every exemplar
 * in the section's own pool qualifies for every question (a country can
 * lead a section overall while trailing on one specific question within
 * it), so each box only shows the exemplars who matched or beat this
 * country's own tier *at that box* (moved from a dedicated fourth column
 * into the tier boxes themselves the same day, "move the exemplars into
 * each of the answer boxes... show exemplars in each box at or above the
 * score of the country we are looking at"), each as a flag + name row
 * rather than a bare flag (a further same-day refinement, "lets have flag
 * and country name") - up to EXEMPLAR_DISPLAY_LIMIT inline, the rest
 * behind a "+N more" dropdown (one shared `<Menu>` for the whole card,
 * driven by `moreAnchor`, rather than one per tier box, since only one can
 * ever be open at a time). The Compare feature's own flag cluster stays a
 * separate, absolutely-positioned row at the opposite corner of the same
 * box, since a box can carry both at once.
 *
 * Editing the question itself - its text, weight or rubric - happens in the
 * Admin Console, not here; this card only records an answer against whatever
 * the question currently says.
 */
export default function QuestionCard({
  question,
  response,
  code,
  compareEntries = [],
  exemplars = [],
  onSelectCountry,
  editMode = false,
}: Props) {
  const { t, i18n } = useTranslation();
  const setResponse = useProtocolStore((s) => s.setResponse);
  const deleteResponse = useProtocolStore((s) => s.deleteResponse);
  const addEvidence = useProtocolStore((s) => s.addEvidence);
  const updateEvidence = useProtocolStore((s) => s.updateEvidence);
  const removeEvidence = useProtocolStore((s) => s.removeEvidence);

  const [showEvidence, setShowEvidence] = useState(false);
  // Read-only answered cards fold away the tiers below the chosen answer -
  // they're the least useful to a reader (no exemplars ever sit below the
  // answer, see qualifyingExemplars) and stacking every tier made each card
  // roughly 450px tall.
  const [showAllTiers, setShowAllTiers] = useState(false);
  // Which tier's "+N more" dropdown is open, if any - one piece of state
  // for the whole card (not one per tier box) since at most one dropdown
  // is ever open at once; the Menu itself is rendered once, below the
  // rubric grid, and looks its own tier's overflow exemplars back up by
  // score when open.
  const [moreAnchor, setMoreAnchor] = useState<{ el: HTMLElement; tierScore: number } | null>(null);
  // Which exemplar's evidence popup is open, if any - replaces the old
  // navigate-away click (2026-10-09, see `onSelectCountry`'s own doc
  // comment above for why); one piece of state for the whole card, same
  // reasoning as `moreAnchor`.
  const [evidencePopup, setEvidencePopup] = useState<{ el: HTMLElement; exemplar: ExemplarEntry } | null>(null);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  // Only an exemplar who actually answered this question, scored the same
  // or higher doing so, AND backed that answer with a complete citation is
  // worth showing here - per Andrew's own instructions 2026-10-09 ("only
  // show exemplars that have the same or higher score", then "only show
  // exemplars if there is a complete set of evidence to that qn answer").
  // An own country with no answer yet (response undefined) treats any
  // exemplar answer as qualifying on the score test, since there's nothing
  // to be "higher than" - showing it is still useful context for filling
  // the question in; the evidence test still applies regardless.
  const qualifyingExemplars = exemplars.filter(
    (ex) => hasCompleteEvidence(ex.response) && (!response || ex.response.score >= response.score),
  );

  const rubricAscending = [...question.rubric].sort((a, b) => a.score - b.score);
  const countryName = qualifiedName(code, i18n.language);
  // Tiers below the chosen answer, folded away on read-only answered cards.
  const foldedTierCount = !editMode && response ? question.rubric.filter((tier) => tier.score < response.score).length : 0;
  const isFolded = (tierScore: number) => foldedTierCount > 0 && !showAllTiers && tierScore < response!.score;

  return (
    <Paper
      id={`question-${question.id}`}
      variant="outlined"
      sx={{
        p: isMobile ? 1.5 : 2,
        // Same 12px rounded card as Deployment/Calculator's detail-view cards.
        borderRadius: "12px",
        borderColor: "divider",
        borderLeftWidth: 3,
        borderLeftStyle: response ? "solid" : "dashed",
        borderLeftColor: response ? "primary.main" : "text.disabled",
        scrollMarginTop: 16,
      }}
    >
      <Box sx={{ mb: 1.5 }}>
        {question.subsection && (
          <Typography variant="overline" sx={{ display: "block" }}>
            {question.subsection}
          </Typography>
        )}
        <Typography variant="body1" sx={{ fontWeight: 700 }}>{question.text}</Typography>
      </Box>

      <Box data-tour="question-rubric" sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {/* Explicit fourth state, to the left of the real rubric tiers -
            per Andrew's own instruction 2026-10-09 ("all questions not
            answered need to be on the left with a box 'not known'"). An
            unanswered question previously just left every tier
            unhighlighted, which reads the same as "not yet loaded" rather
            than "deliberately nothing to report here" - this box makes the
            absence of an answer a first-class, clickable state rather than
            an implicit one. Only shown when it *is* the state (or in edit
            mode, where it's the way to clear an answer) - on an answered
            card it was just one more row of noise. */}
        {(!response || editMode) && (
        <Box
          onClick={editMode && response ? () => deleteResponse(code, question.id) : undefined}
          sx={{
            order: 99,
            px: 1.25,
            py: 0.75,
            borderRadius: 1.5,
            cursor: editMode && response ? "pointer" : "default",
            border: "2px dashed",
            borderColor: !response ? "text.disabled" : "divider",
            bgcolor: !response ? "action.hover" : "transparent",
            ...(editMode && response && { "&:hover": { borderColor: "text.disabled" } }),
            display: "flex",
            flexDirection: "column",
            gap: 0.75,
          }}
        >
          <Typography
            variant="body2"
            sx={{
              color: !response ? "text.secondary" : "text.disabled",
              fontWeight: !response ? 600 : 400,
              fontStyle: "italic",
            }}
          >
            {t("questionCard.notKnown")}
          </Typography>
        </Box>
        )}

        {[...question.rubric].sort((a, b) => b.score - a.score).filter((tier) => !isFolded(tier.score)).map((tier) => {
          const tierIndex = rubricAscending.findIndex((t) => t.score === tier.score);
          const tierRank = rubricAscending.length > 1 ? tierIndex / (rubricAscending.length - 1) : 1;
          const tierColor = SCORE_BANDS[Math.round(tierRank * (SCORE_BANDS.length - 1))].color;
          const tierName = tierRank === 1 ? t("questionCard.tierStrong") : tierRank === 0 ? t("questionCard.tierWeak") : t("questionCard.tierPartial");
          const selected = response?.score === tier.score;
          // Every comparator who picked this exact tier, clustered along the
          // tile's bottom edge rather than one badge each - up to
          // MAX_COMPARE_COUNTRIES flags is still readable in a row, where
          // stacking them over the label text (the old single-comparator
          // treatment) would not be.
          const tierComparators = compareEntries.filter((entry) => entry.response?.score === tier.score);
          // This box's own exemplars - qualifying (same-or-higher than this
          // country's own answer, computed once above) AND matching this
          // exact tier, since an exemplar pins to whichever box *they*
          // actually picked, not every box that happens to qualify.
          const tierExemplars = qualifyingExemplars.filter((ex) => ex.response?.score === tier.score);
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
                borderLeftWidth: 8,
                borderColor: "divider",
                borderLeftColor: tierColor,
                bgcolor: selected ? SELECTED_TINT : "transparent",
                boxShadow: selected ? 2 : "none",
                ...(editMode && { "&:hover": { borderColor: "primary.light" } }),
                display: "flex",
                flexDirection: "column",
                gap: 0.75,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "baseline", gap: 1.25 }}>
                <Typography
                  variant="caption"
                  sx={{
                    flexShrink: 0,
                    width: TIER_LABEL_WIDTH,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    fontSize: "0.65rem",
                    // Amber for strong, teal for weak - the same way round as
                    // SCORE_BANDS (and so the tile's own left edge), darkened
                    // a step for legibility as text.
                    color: tierRank === 1 ? "#B07A00" : tierRank === 0 ? "#008593" : "text.secondary",
                  }}
                >
                  {tierName}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: selected ? "text.primary" : undefined,
                    fontWeight: selected ? 600 : 400,
                  }}
                >
                  {capitalizeFirst(tier.label)}
                </Typography>
              </Box>

              {selected && (
                <Box sx={{ display: "flex", alignItems: "center", gap: "6px", ml: `calc(${TIER_LABEL_WIDTH}px + 10px)` }}>
                  <FlagImg code={code} size={14} />
                  <Typography variant="caption" sx={{ fontWeight: 700, color: "text.primary" }}>
                    {t("questionCard.currentAnswer", { name: countryName })}
                  </Typography>
                </Box>
              )}

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

              {/* Flag + name run, in normal flow below the tier label (not
                  absolutely positioned like the Compare cluster above) -
                  teal text (matching the rest of the app's "leading"
                  accent) rather than compareColorFor's per-jurisdiction
                  colours, since every exemplar here means the same thing
                  regardless of which country it is. Clickable (unlike the
                  Compare cluster, which has nowhere to navigate to) - this
                  is the "click to explore" Q3 affordance.

                  A labelled, single-line, comma-separated run rather than
                  one flag+name per row (2026-10-09, "they need a header
                  before saying what they are... do not wrap these,
                  separate with a comma so the formatting is nicer") - a
                  header makes the flag row legible on its own rather than
                  reading as an unexplained second flag cluster next to the
                  Compare one, and a single nowrapping line reads as one
                  list rather than a stack of unrelated rows. */}
              {tierExemplars.length > 0 && (
                <Box sx={{ display: "flex", flexDirection: "column", gap: "2px", ml: `calc(${TIER_LABEL_WIDTH}px + 10px)` }}>
                  <Typography
                    variant="caption"
                    sx={{
                      color: "text.secondary",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      fontSize: "0.625rem",
                    }}
                  >
                    {t("questionCard.exemplars")}
                  </Typography>
                  <Box sx={{ display: "flex", alignItems: "center", flexWrap: "nowrap", overflow: "hidden", gap: "4px" }}>
                    {tierExemplars.slice(0, EXEMPLAR_DISPLAY_LIMIT).map((exemplar, i, visible) => {
                      const evidenceTitles = exemplar.response?.evidence
                        ?.map((e) => e.title)
                        .filter(Boolean)
                        .join(", ");
                      const tooltip = evidenceTitles || undefined;
                      const isLastOverall =
                        tierExemplars.length <= EXEMPLAR_DISPLAY_LIMIT && i === visible.length - 1;
                      const row = (
                        <ButtonBase
                          key={exemplar.code}
                          onClick={(e) => {
                            e.stopPropagation();
                            setEvidencePopup({ el: e.currentTarget, exemplar });
                          }}
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            flexShrink: 0,
                            borderRadius: "4px",
                            px: "2px",
                          }}
                        >
                          <FlagImg code={exemplar.code} size={14} />
                          <Typography
                            variant="caption"
                            noWrap
                            sx={{ color: "text.primary", fontWeight: 600, textDecoration: "underline dotted", textUnderlineOffset: "3px" }}
                          >
                            {exemplar.name}
                            {isLastOverall ? "" : ","}
                          </Typography>
                        </ButtonBase>
                      );
                      return tooltip ? (
                        <Tooltip key={exemplar.code} title={tooltip}>
                          {row}
                        </Tooltip>
                      ) : (
                        row
                      );
                    })}

                    {tierExemplars.length > EXEMPLAR_DISPLAY_LIMIT && (
                      <ButtonBase
                        onClick={(e) => {
                          e.stopPropagation();
                          setMoreAnchor({ el: e.currentTarget, tierScore: tier.score });
                        }}
                        sx={{ display: "flex", flexShrink: 0, borderRadius: "4px", px: "2px" }}
                      >
                        <Typography variant="caption" color="primary" noWrap sx={{ fontWeight: 600 }}>
                          {t("questionCard.moreExemplars", { count: tierExemplars.length - EXEMPLAR_DISPLAY_LIMIT })}
                        </Typography>
                      </ButtonBase>
                    )}
                  </Box>
                </Box>
              )}
            </Box>
          );
        })}
      </Box>

      {foldedTierCount > 0 && (
        <Button
          size="small"
          onClick={() => setShowAllTiers((v) => !v)}
          endIcon={<ExpandMoreIcon fontSize="small" sx={{ transform: showAllTiers ? "rotate(180deg)" : "none", transition: "transform 150ms" }} />}
          sx={{ mt: 0.5 }}
        >
          {showAllTiers ? t("questionCard.showFewerLevels") : t("questionCard.showAllLevels", { count: foldedTierCount })}
        </Button>
      )}

      {/* One shared dropdown for the whole card (see `moreAnchor`'s own
          doc comment above) - looks its tier's exemplars back up by score
          when open, rather than every tier box carrying its own Menu. */}
      <Menu anchorEl={moreAnchor?.el} open={Boolean(moreAnchor)} onClose={() => setMoreAnchor(null)}>
        {qualifyingExemplars
          .filter((ex) => ex.response?.score === moreAnchor?.tierScore)
          .slice(EXEMPLAR_DISPLAY_LIMIT)
          .map((exemplar) => (
            <MenuItem
              key={exemplar.code}
              onClick={(e) => {
                setMoreAnchor(null);
                setEvidencePopup({ el: e.currentTarget, exemplar });
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <FlagImg code={exemplar.code} size={16} />
                <Typography variant="body2">{exemplar.name}</Typography>
              </Box>
            </MenuItem>
          ))}
      </Menu>

      {/* Evidence popup, opened by clicking an exemplar (replaces the old
          navigate-straight-to-that-country click, 2026-10-09 - see
          `onSelectCountry`'s own doc comment on the Props interface) -
          shows the exemplar's own tier and citations for this exact
          question, with an explicit "view profile" link for the (now
          secondary) navigate case. */}
      <Popover
        anchorEl={evidencePopup?.el ?? null}
        open={Boolean(evidencePopup)}
        onClose={() => setEvidencePopup(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
      >
        {evidencePopup && (
          <Box sx={{ p: 2, maxWidth: 320 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
              <FlagImg code={evidencePopup.exemplar.code} size={18} />
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                {evidencePopup.exemplar.name}
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
              {question.rubric.find((tier) => tier.score === evidencePopup.exemplar.response?.score)?.label}
            </Typography>
            <Stack spacing={1.25}>
              {evidencePopup.exemplar.response?.evidence.map((e, i) => (
                <Box key={i}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {e.title}
                  </Typography>
                  {e.source && (
                    <Typography variant="caption" sx={{ display: "block", color: "primary.main", wordBreak: "break-word" }}>
                      <Linkified text={e.source} />
                    </Typography>
                  )}
                  {e.note && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                      <Linkified text={e.note} />
                    </Typography>
                  )}
                </Box>
              ))}
            </Stack>
            {onSelectCountry && (
              <Button
                size="small"
                sx={{ mt: 1.5 }}
                onClick={() => {
                  onSelectCountry(evidencePopup.exemplar.code);
                  setEvidencePopup(null);
                }}
              >
                {t("questionCard.viewProfile")}
              </Button>
            )}
          </Box>
        )}
      </Popover>

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
            {!editMode && (
              <Button data-tour="suggest-correction" size="small" variant="text" color="inherit" sx={{ color: "text.secondary" }} startIcon={<EditOutlinedIcon fontSize="small" />} onClick={() => setCorrectionOpen(true)}>
                {t("correctionDialog.link")}
              </Button>
            )}
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
                  {/* title/note are free text, not translated - see
                      EvidenceItem's doc comment in lib/types.ts and
                      ROADMAP.md's "Known gaps flagged in code". Read-only,
                      each item reads as a citation (title, source link,
                      note) - the same layout as an exemplar's evidence
                      popup - rather than a form of disabled text fields. */}
                  {editMode ? (
                    <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
                      <TextField
                        fullWidth
                        size="small"
                        label={t("questionCard.title")}
                        placeholder={t("questionCard.titlePlaceholder")}
                        value={item.title}
                        onChange={(e) => updateEvidence(code, question.id, i, { title: e.target.value })}
                      />
                      <TextField
                        fullWidth
                        size="small"
                        label={t("questionCard.source")}
                        placeholder={t("questionCard.sourcePlaceholder")}
                        value={item.source}
                        onChange={(e) => updateEvidence(code, question.id, i, { source: e.target.value })}
                      />
                      <TextField
                        fullWidth
                        multiline
                        minRows={2}
                        size="small"
                        label={t("questionCard.notes")}
                        value={item.note}
                        onChange={(e) => updateEvidence(code, question.id, i, { note: e.target.value })}
                      />
                    </Stack>
                  ) : (
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      {item.title && (
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {item.title}
                        </Typography>
                      )}
                      {item.source && (
                        <Typography variant="caption" sx={{ display: "block", color: "primary.main", wordBreak: "break-word" }}>
                          <Linkified text={item.source} />
                        </Typography>
                      )}
                      {item.note && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                          <Linkified text={item.note} />
                        </Typography>
                      )}
                    </Box>
                  )}
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

      {/* Quiet per-answer entry point to the correction flow - the evidence
          requirement is taught by the dialog's own required fields, not by
          text here. With an answer it sits in the Evidence row above; with
          none it gets a row of its own. Hidden in edit mode, where the full
          edit workflow applies. */}
      {!editMode && !response && (
        <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 1 }}>
          <Button data-tour="suggest-correction" size="small" variant="text" color="inherit" sx={{ color: "text.secondary" }} startIcon={<EditOutlinedIcon fontSize="small" />} onClick={() => setCorrectionOpen(true)}>
            {t("correctionDialog.link")}
          </Button>
        </Box>
      )}
      <CorrectionDialog
        open={correctionOpen}
        onClose={() => setCorrectionOpen(false)}
        question={question}
        response={response}
        countryCode={code}
        countryName={qualifiedName(code, i18n.language)}
      />
    </Paper>
  );
}
