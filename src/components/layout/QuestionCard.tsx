import { useState } from "react";
import {
  Box,
  Button,
  ButtonBase,
  Collapse,
  IconButton,
  Menu,
  MenuItem,
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
import { SECTION_STANDING_COLORS } from "../../lib/scoring";
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
  /** Navigates to a different country - wired to CountryPanel's own onSelectCountry, lets a reader jump straight to whichever exemplar is shown. Omitted when nothing should be clickable (CompareView's legacy usage). */
  onSelectCountry?: (code: string) => void;
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
 *
 * Mode-aware since 2026-10-09 ("the colour of the tiles and sidebar more
 * generally does not work in light or dark mode") - the light-mode values
 * (solid citrus border over a 12%-opacity tint) blended down to a muddy
 * brown-olive wash on a dark surface, reading as a smudge rather than a
 * highlight. Dark mode keeps the same two building blocks - a solid border,
 * a translucent tint of it - but moves to the theme's own lighter citrus
 * step (`secondary.light`, already used for this purpose in mui-theme.tsx's
 * own dark-mode chip/toggle fills) and a higher tint opacity, which holds
 * up against a dark surface the same way the light version does against a
 * white one.
 */
function selectedTierColors(mode: "light" | "dark") {
  return mode === "dark"
    ? { border: "#FCCA4A", tint: "rgba(252, 202, 74, 0.2)" }
    : { border: "#FBB114", tint: "rgba(251, 177, 20, 0.12)" };
}

/** How many of a tier box's own qualifying exemplars show inline before the rest fold into a "+N more" dropdown - per Andrew's own instruction 2026-10-09 ("top 3 exemplars shown and a dropdown list for more"). */
const EXEMPLAR_DISPLAY_LIMIT = 3;

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
  // Which tier's "+N more" dropdown is open, if any - one piece of state
  // for the whole card (not one per tier box) since at most one dropdown
  // is ever open at once; the Menu itself is rendered once, below the
  // rubric grid, and looks its own tier's overflow exemplars back up by
  // score when open.
  const [moreAnchor, setMoreAnchor] = useState<{ el: HTMLElement; tierScore: number } | null>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  // Only an exemplar who actually answered this question, and scored the
  // same or higher doing so, is worth showing here - per Andrew's own
  // instruction 2026-10-09 ("only show exemplars that have the same or
  // higher score"). An own country with no answer yet (response undefined)
  // treats any exemplar answer as qualifying, since there's nothing to be
  // "higher than" - showing it is still useful context for filling the
  // question in.
  const qualifyingExemplars = exemplars.filter(
    (ex) => ex.response && (!response || ex.response.score >= response.score),
  );

  const { border: selectedBorder, tint: selectedTint } = selectedTierColors(theme.palette.mode);

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
      <Box sx={{ mb: 1.5 }}>
        {question.subsection && (
          <Typography variant="overline" sx={{ display: "block" }}>
            {question.subsection}
          </Typography>
        )}
        <Typography variant="body1" sx={{ fontWeight: 700 }}>{question.text}</Typography>
      </Box>

      <Box
        data-tour="question-rubric"
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            md: `repeat(${question.rubric.length + 1}, 1fr)`,
          },
          gap: 1,
        }}
      >
        {/* Explicit fourth state, to the left of the real rubric tiers -
            per Andrew's own instruction 2026-10-09 ("all questions not
            answered need to be on the left with a box 'not known'"). An
            unanswered question previously just left every tier
            unhighlighted, which reads the same as "not yet loaded" rather
            than "deliberately nothing to report here" - this box makes the
            absence of an answer a first-class, clickable state rather than
            an implicit one. */}
        <Box
          onClick={editMode && response ? () => deleteResponse(code, question.id) : undefined}
          sx={{
            p: 1.25,
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

        {question.rubric.map((tier) => {
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
                borderColor: selected ? selectedBorder : "divider",
                bgcolor: selected ? selectedTint : "transparent",
                ...(editMode && { "&:hover": { borderColor: selected ? selectedBorder : "primary.light" } }),
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

              {/* Flag + name rows, in normal flow below the tier label (not
                  absolutely positioned like the Compare cluster above) -
                  teal text (matching the rest of the app's "leading"
                  accent) rather than compareColorFor's per-jurisdiction
                  colours, since every exemplar row here means the same
                  thing regardless of which country it is. Clickable
                  (unlike the Compare cluster, which has nowhere to
                  navigate to) - this is the "click to explore" Q3
                  affordance. */}
              {tierExemplars.length > 0 && (
                <Box sx={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  {tierExemplars.slice(0, EXEMPLAR_DISPLAY_LIMIT).map((exemplar) => {
                    const evidenceTitles = exemplar.response?.evidence
                      ?.map((e) => e.title)
                      .filter(Boolean)
                      .join(", ");
                    const tooltip = evidenceTitles || undefined;
                    const row = (
                      <ButtonBase
                        key={exemplar.code}
                        disabled={!onSelectCountry}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectCountry?.(exemplar.code);
                        }}
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          width: "100%",
                          justifyContent: "flex-start",
                          borderRadius: "4px",
                          px: "4px",
                        }}
                      >
                        <FlagImg code={exemplar.code} size={14} />
                        <Typography
                          variant="caption"
                          noWrap
                          sx={{ color: SECTION_STANDING_COLORS.leading, fontWeight: 600 }}
                        >
                          {exemplar.name}
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
                      sx={{ display: "flex", justifyContent: "flex-start", px: "4px", borderRadius: "4px" }}
                    >
                      <Typography variant="caption" color="primary" sx={{ fontWeight: 600 }}>
                        {t("questionCard.moreExemplars", { count: tierExemplars.length - EXEMPLAR_DISPLAY_LIMIT })}
                      </Typography>
                    </ButtonBase>
                  )}
                </Box>
              )}
            </Box>
          );
        })}
      </Box>

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
              onClick={() => {
                setMoreAnchor(null);
                onSelectCountry?.(exemplar.code);
              }}
              disabled={!onSelectCountry}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <FlagImg code={exemplar.code} size={16} />
                <Typography variant="body2">{exemplar.name}</Typography>
              </Box>
            </MenuItem>
          ))}
      </Menu>

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
                  {/* title/note are free text, not translated - see
                      EvidenceItem's doc comment in lib/types.ts and
                      ROADMAP.md's "Known gaps flagged in code". */}
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
