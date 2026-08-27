import { useState } from "react";
import { Box, Collapse, IconButton, Stack, Typography } from "@mui/material";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

import { jurisdictionName } from "../../lib/jurisdictions";
import { groupScores, scoreBand, scoreLabel } from "../../lib/scoring";
import {
  compareGroups,
  isCompletenessSort,
  matchesFilters,
  type ScoreboardSort,
} from "../../lib/scoreboardFilters";
import type { CountryScore, GroupedScore } from "../../lib/types";
import { useProtocolStore } from "../../stores/protocolStore";
import FlagImg from "../ui/FlagImg";
import ScoreboardFilters from "./ScoreboardFilters";

/**
 * What a row's tile shows, driven by the current sort - sorting by score
 * shows the score (as before); sorting by data completeness shows that
 * instead, since that is the number the list is actually ordered by and a
 * reader comparing rows top to bottom wants to see the value creating that
 * order, not a different one.
 */
function tileDisplay(
  entry: Pick<CountryScore, "score" | "completeness" | "ranked">,
  sort: ScoreboardSort,
): { text: string; color: string } {
  if (isCompletenessSort(sort)) {
    return { text: `${Math.round(entry.completeness * 100)}%`, color: "primary.main" };
  }
  return entry.ranked
    ? { text: scoreLabel(entry.score), color: scoreBand(entry.score).color }
    : { text: "Not enough data to score yet", color: "text.disabled" };
}

interface Props {
  scores: CountryScore[];
  selectedCountry: string | null;
  onSelect: (code: string) => void;
  /** Omits the "Policy Explorer" heading and its description - the mobile stacked layout shows that above the map instead, ahead of this list. */
  hideHeading?: boolean;
}

/**
 * Jurisdictions, grouped by sovereign state and ordered by how much of the
 * questionnaire has actually been answered - a country with states or
 * provinces (Australia, the US, Canada) shows as one row rather than a wall
 * of near-identical entries, and its own completeness is the average across
 * its children. Data completeness leads rather than score because it is the
 * more honest thing to sort a research wiki by: it says how much is actually
 * known about a jurisdiction, not how well that jurisdiction happens to
 * score, and a reader deciding where to research next wants the thin rows,
 * not just the impressive ones.
 */
export default function Scoreboard({ scores, selectedCountry, onSelect, hideHeading }: Props) {
  const filters = useProtocolStore((s) => s.scoreboardFilters);
  const sort = useProtocolStore((s) => s.scoreboardSort);
  const allGroups = groupScores(scores);
  const grouped = allGroups
    .filter((g) => matchesFilters(g, filters))
    .sort((a, b) => compareGroups(a, b, sort));

  return (
    <Box data-tour="scoreboard" sx={{ p: 2, overflowY: "auto", height: "100%", bgcolor: "#ffffff" }}>
      {!hideHeading && (
        <>
          {/* Same size/weight/colour as the sibling gridsim-frontend project's
              own country-name heading at the top of its sidebar. */}
          <Typography sx={{ fontSize: "1.375rem", fontWeight: 700, color: "#1A1A1A", lineHeight: 1.2, mb: 0.5 }}>
            Policy Explorer
          </Typography>
          <Typography variant="body2" sx={{ mb: 1.5 }}>
            <strong>Pick a country on the map or in this list</strong> to see/edit its
            answers, the evidence behind each one, and the changes that would raise its
            score the most.
          </Typography>
        </>
      )}

      <ScoreboardFilters groups={allGroups} />

      {grouped.length === 0 && (
        <Typography variant="body2" sx={{ mb: 2 }}>
          No jurisdiction matches these filters.
        </Typography>
      )}

      {/* Light-grey tiles on the sidebar's own white background, matching
          the sibling gridsim-frontend project's own card colours exactly
          (#F9FAFB fill, #E5E7EB border) rather than a theme token. */}
      <Stack spacing={0.75}>
        {grouped.map((g, i) => (
          <Row
            key={g.code}
            rank={i + 1}
            group={g}
            selectedCountry={selectedCountry}
            onSelect={onSelect}
            sort={sort}
          />
        ))}
      </Stack>
    </Box>
  );
}

/**
 * One line per top-level jurisdiction.
 *
 * A group with its own score (France) opens that country's page on click, the
 * same as any other row, with a separate chevron to expand its exclaves. A
 * group with no score of its own (Australia) has nothing of its own to open,
 * so the whole row toggles the child list instead.
 */
function Row({
  rank,
  group,
  selectedCountry,
  onSelect,
  sort,
}: {
  rank?: number;
  group: GroupedScore;
  selectedCountry: string | null;
  onSelect: (code: string) => void;
  sort: ScoreboardSort;
}) {
  const [expanded, setExpanded] = useState(false);
  const selected = group.hasOwnScore
    ? group.code === selectedCountry
    : group.children.some((c) => c.code === selectedCountry);

  return (
    <Box>
      <Box
        onClick={() =>
          group.hasOwnScore ? onSelect(group.code) : setExpanded((v) => !v)
        }
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.25,
          pl: 1.25,
          pr: 1,
          py: 0.9,
          borderRadius: "8px",
          border: "1px solid",
          borderColor: selected ? "primary.main" : "#E5E7EB",
          cursor: "pointer",
          overflow: "hidden",
          bgcolor: selected ? "action.selected" : "#F9FAFB",
          transition: "background-color 120ms ease, border-color 120ms ease",
          "&:hover": { bgcolor: selected ? "action.selected" : "#F3F4F6" },
          "&:hover .row-chevron": { color: "primary.main", transform: "translateX(2px)" },
        }}
      >
        {rank !== undefined && (
          <Typography
            variant="caption"
            sx={{ width: 16, textAlign: "right", fontWeight: 600, flexShrink: 0 }}
          >
            {rank}
          </Typography>
        )}

        <FlagImg code={group.code} size={16} />

        <Typography variant="subtitle1" noWrap sx={{ flex: 1, minWidth: 0 }}>
          {group.name}
        </Typography>

        <Typography
          variant="body2"
          noWrap={isCompletenessSort(sort) || group.ranked}
          sx={{
            width: 130,
            textAlign: "right",
            fontWeight: 700,
            flexShrink: 0,
            lineHeight: isCompletenessSort(sort) || group.ranked ? undefined : 1.2,
            color: tileDisplay(group, sort).color,
          }}
        >
          {tileDisplay(group, sort).text}
        </Typography>

        {group.isGroup ? (
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
            sx={{ flexShrink: 0, p: 0.25 }}
          >
            <ExpandMoreIcon
              fontSize="small"
              sx={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 150ms" }}
            />
          </IconButton>
        ) : (
          <ChevronRightIcon
            className="row-chevron"
            fontSize="small"
            sx={{ color: "text.disabled", flexShrink: 0, transition: "color 120ms, transform 120ms" }}
          />
        )}
      </Box>

      {group.isGroup && (
        <Collapse in={expanded}>
          <Stack spacing={0.5} sx={{ pl: 3, pt: 0.75, bgcolor: "#ffffff" }}>
            {[...group.children]
              .sort((a, b) => compareGroups(a, b, sort))
              .map((child) => (
                <ChildRow
                  key={child.code}
                  child={child}
                  selected={child.code === selectedCountry}
                  onSelect={onSelect}
                  sort={sort}
                />
              ))}
          </Stack>
        </Collapse>
      )}

    </Box>
  );
}

/** A province, state or exclave nested under its country's row. */
function ChildRow({
  child,
  selected,
  onSelect,
  sort,
}: {
  child: CountryScore;
  selected: boolean;
  onSelect: (code: string) => void;
  sort: ScoreboardSort;
}) {
  return (
    <Box
      onClick={() => onSelect(child.code)}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        pl: 1,
        pr: 1.5,
        py: 0.6,
        borderRadius: "8px",
        border: "1px solid",
        borderColor: selected ? "primary.main" : "transparent",
        cursor: "pointer",
        bgcolor: selected ? "action.selected" : "transparent",
        "&:hover": { bgcolor: selected ? "action.selected" : "#F9FAFB" },
      }}
    >
      {/* Plain name, not the qualified "State, Country" form CountryScore
          carries elsewhere - redundant once already nested under the country's
          own row. */}
      <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0, color: "text.secondary" }}>
        {jurisdictionName(child.code)}
      </Typography>
      <Typography
        variant="caption"
        noWrap={isCompletenessSort(sort) || child.ranked}
        sx={{
          width: 120,
          textAlign: "right",
          fontWeight: 600,
          flexShrink: 0,
          lineHeight: isCompletenessSort(sort) || child.ranked ? undefined : 1.2,
          color: tileDisplay(child, sort).color,
        }}
      >
        {tileDisplay(child, sort).text}
      </Typography>
    </Box>
  );
}
