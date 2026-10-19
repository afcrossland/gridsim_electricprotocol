import { Box, ButtonBase, Typography, useTheme } from "@mui/material";
import { lighten } from "@mui/material/styles";
import { useTranslation } from "react-i18next";

import { scoreSuns, scoreTextColor } from "../../lib/scoring";
import { Suns } from "../ui/Suns";
import type { CountryScore, Section } from "../../lib/types";

export interface SectionOverviewEntry {
  section: Section;
  score: CountryScore;
}

interface Props {
  entries: SectionOverviewEntry[];
  /** Which section's detail is expanded below - highlights that tile, full-size or compact, so it reads as "open." */
  selectedId: string;
  onSelect: (sectionId: string) => void;
  /**
   * Narrow horizontal strip instead of the full card grid - switched on as
   * soon as a section is picked (per Andrew's own instruction 2026-10-09,
   * "when we click a tile, make them narrow and go to the top to make it
   * obvious"): shrinking every tile down to a thin pill, together with
   * CountryPanel's own scroll-to-top on the same click, is the visual cue
   * that the view just changed state, not just a style preference.
   */
  compact?: boolean;
}

/**
 * Replaces the old Summary tab's windrose (per Andrew's own instruction
 * 2026-10-09, "When we load up say Germany, we want tiles for each policy
 * area and the score in each. Not the windrose") - one tile per section,
 * carrying its own absolute score (`scoreTextColor`/`scoreBandLabel`, the
 * same banding used everywhere else in the app).
 *
 * Originally its own tab, with a click switching to a separate Policy
 * Landscape tab - merged into one accordion-style tab the same day
 * ("I wonder if we can pull all this into a single tab... click on say
 * access, can we pull up the question areas below") per Andrew's own
 * follow-up instruction: clicking a tile now expands that section's own
 * question list directly below (see CountryPanel.tsx), with every other
 * tile staying reachable (now as a compact strip, see `compact` above) so
 * switching sections doesn't mean leaving the detail view.
 *
 * Two things tried and dropped the same day: a per-section answered/total
 * badge ("we do not need the x/y badge"), and a relative "leading/typical/
 * behind the field" standing badge - the latter stopped making sense once
 * exemplars moved from a section-wide ranking to a per-question one (a
 * tile could read "leading" while individual questions inside it show
 * someone else out front, or vice versa), so it was removed rather than
 * left to contradict the per-question exemplar columns below
 * (QuestionCard.tsx's own `exemplars` prop).
 *
 * Shows the band label only, no percentage (per Andrew's own instruction
 * 2026-10-09, "we dont need to show the % scores on the tils") - a
 * precise-looking number invited comparing "52% vs 55%" as if that gap
 * meant something, the same reasoning `scoreLabel`'s own doc comment gives
 * for leading with the band everywhere else; the tiles just drop the
 * percentage entirely rather than keeping it secondary.
 *
 * The unselected tile/pill border used to hardcode the theme's own
 * light-mode divider hex (`#E5E7EB`) instead of the `divider` token, so it
 * stayed pale grey in dark mode too rather than following the theme's own
 * dark divider - fixed 2026-10-09 ("the colour of the tiles and sidebar
 * more generally does not work in light or dark mode").
 *
 * Tiles moved off `action.hover` onto `background.paper` with a real
 * shadow the same day ("the 9 tiles are very difficult to distinguish
 * from the background") - `action.hover` is a near-transparent 4%-opacity
 * tint, so against the page's own off-white background the unselected
 * tiles read as almost the same colour with a faint grey outline. A solid
 * paper surface (white in light mode) plus a low shadow gives them an
 * actual edge regardless of mode, the same lift `Paper`/`Card` already use
 * elsewhere in the app. Grown larger at the same time (wider grid minimum,
 * more padding, a bigger score label) and the border thickened to 2px for
 * the same reason.
 */
export default function SectionOverview({ entries, selectedId, onSelect, compact = false }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  // A touch lighter than plain `background.paper` in dark mode only (per
  // Andrew's own instruction 2026-10-09, "tweak the colour in dark mode. A
  // bit lighter") - dark mode's own paper tone (#20272A) sits close enough
  // to the page's own default (#171D1E) that the tiles, while no longer
  // invisible, still read as a little flat next to light mode's crisp
  // white-on-off-white. Light mode is untouched - `lighten` by 0 there
  // would be a no-op anyway, but the ternary keeps it explicit.
  const tileBg = theme.palette.mode === "dark" ? lighten(theme.palette.background.paper, 0.12) : "background.paper";

  if (compact) {
    return (
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
        {entries.map(({ section, score }) => {
          const selected = section.id === selectedId;
          return (
            <ButtonBase
              key={section.id}
              onClick={() => onSelect(section.id)}
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                px: "12px",
                py: "6px",
                borderRadius: "999px",
                border: "2px solid",
                borderColor: selected ? "primary.main" : "divider",
                bgcolor: tileBg,
                boxShadow: 1,
                "&:hover": { bgcolor: "action.hover" },
                transition: "background-color 120ms ease, border-color 120ms ease",
              }}
            >
              <Typography sx={{ fontSize: "0.75rem", fontWeight: selected ? 700 : 500, whiteSpace: "nowrap" }}>
                {section.title}
              </Typography>
              <Typography
                sx={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                  color: score.ranked ? scoreTextColor(score.score, theme.palette.mode) : "text.disabled",
                }}
              >
                {score.ranked ? <Suns count={scoreSuns(score.score)} size={14} /> : t("countryPanel.notApplicable")}
              </Typography>
            </ButtonBase>
          );
        })}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
        gap: "14px",
      }}
    >
      {entries.map(({ section, score }) => {
        const selected = section.id === selectedId;
        return (
          <ButtonBase
            key={section.id}
            onClick={() => onSelect(section.id)}
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: "8px",
              textAlign: "left",
              p: "18px",
              borderRadius: "12px",
              border: "2px solid",
              borderColor: selected ? "primary.main" : "divider",
              bgcolor: tileBg,
              boxShadow: 1,
              "&:hover": { bgcolor: "action.hover", boxShadow: 2 },
              transition: "background-color 120ms ease, border-color 120ms ease, box-shadow 120ms ease",
            }}
          >
            <Typography
              sx={{
                fontSize: "0.6875rem",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "text.disabled",
                fontWeight: 600,
                lineHeight: 1.3,
                minHeight: "2.6em",
              }}
            >
              {section.title}
            </Typography>

            <Typography
              sx={{
                fontSize: "1.5rem",
                fontWeight: 700,
                lineHeight: 1,
                color: score.ranked ? scoreTextColor(score.score, theme.palette.mode) : "text.disabled",
              }}
            >
              {score.ranked ? <Suns count={scoreSuns(score.score)} size={22} /> : t("countryPanel.notApplicable")}
            </Typography>
          </ButtonBase>
        );
      })}
    </Box>
  );
}
