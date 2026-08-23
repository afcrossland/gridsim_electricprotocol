import { useState } from "react";
import { Box, Collapse, IconButton, LinearProgress, Stack, Typography } from "@mui/material";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

import { jurisdictionName } from "../../lib/jurisdictions";
import { groupScores, scoreBand, scoreLabel } from "../../lib/scoring";
import type { CountryScore, GroupedScore } from "../../lib/types";
import { customMixins } from "../../mui-theme";
import FlagImg from "../ui/FlagImg";
import JurisdictionSearch from "./JurisdictionSearch";

/**
 * customMixins.tile's transition timing and hover shadow, typed concretely.
 * Its CSSObject type is a wide union (emotion allows nested selectors,
 * keyframes, arrays...) so TypeScript cannot narrow `tile["&:hover"]` down to
 * an object with a `boxShadow` string - pulled out here once, as the literal
 * values the mixin actually holds, rather than fighting that typing inline.
 */
const TILE_HOVER = {
  transition: String(customMixins.tile.transition),
  boxShadow: "0 6px 20px rgba(0,0,0,0.08)" as const,
};

interface Props {
  scores: CountryScore[];
  selectedCountry: string | null;
  onSelect: (code: string) => void;
}

/**
 * Ranked jurisdictions, grouped by sovereign state. A country with states or
 * provinces (Australia, the US, Canada) shows as one row rather than a wall of
 * near-identical entries; its score is the average across whichever of its
 * children individually clear the completeness threshold, so one thin
 * province cannot drag a whole country's figure down on almost no evidence.
 * Anything below the threshold - a country outright, or a group with no
 * ranked children - is listed under the ranked table rather than mixed into
 * it.
 */
export default function Scoreboard({ scores, selectedCountry, onSelect }: Props) {
  const grouped = groupScores(scores);
  const ranked = grouped.filter((g) => g.ranked).sort((a, b) => b.score - a.score);
  const unranked = grouped
    .filter((g) => !g.ranked && (g.isGroup ? g.totalChildren > 0 : true))
    .sort((a, b) => b.completeness - a.completeness);

  return (
    <Box sx={{ p: 2, overflowY: "auto", height: "100%" }}>
      <Typography variant="body2" sx={{ mb: 1.5 }}>
        How well does a country's electricity policy let ordinary homes and
        businesses generate, store and sell their own power?{" "}
        <strong>Pick a country on the map or in this list</strong> to see/edit its
        answers, the evidence behind each one, and the changes that would raise its
        score the most.
      </Typography>

      <Box sx={{ mb: 2 }}>
        <JurisdictionSearch scores={scores} selected={selectedCountry} onSelect={onSelect} />
      </Box>

      {ranked.length === 0 && (
        <Typography variant="body2" sx={{ mb: 2 }}>
          No jurisdiction has enough answers to be ranked yet.
        </Typography>
      )}

      <Stack spacing={0.75}>
        {ranked.map((g, i) => (
          <Row
            key={g.code}
            rank={i + 1}
            group={g}
            selectedCountry={selectedCountry}
            onSelect={onSelect}
          />
        ))}
      </Stack>

      {unranked.length > 0 && (
        <>
          <Typography variant="overline" sx={{ display: "block", mt: 2.5, mb: 1 }}>
            Not enough data to rank
          </Typography>
          <Stack spacing={0.75}>
            {unranked.map((g) => (
              <Row key={g.code} group={g} selectedCountry={selectedCountry} onSelect={onSelect} />
            ))}
          </Stack>
        </>
      )}
    </Box>
  );
}

/**
 * One line per top-level jurisdiction. Completeness is a hairline bar along
 * the bottom edge rather than its own row, which keeps the row to a single
 * band of text without losing the signal that a score rests on partial
 * evidence.
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
}: {
  rank?: number;
  group: GroupedScore;
  selectedCountry: string | null;
  onSelect: (code: string) => void;
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
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: 1.25,
          pl: 1.25,
          pr: 1,
          py: 0.4,
          borderRadius: 1.5,
          cursor: "pointer",
          overflow: "hidden",
          bgcolor: selected ? "action.selected" : "background.paper",
          border: "1px solid",
          borderColor: selected ? "primary.main" : "divider",
          // customMixins.tile's hover lift and transition timing, scaled down
          // from its -4px (tuned for a squarer dashboard card) to suit a
          // compact list row; the hover shadow value is its own too, pulled in
          // directly since the mixin's loosely-typed CSSObject does not narrow
          // a nested "&:hover" selector enough to read it back out.
          transition: `transform 180ms ease, box-shadow 180ms ease, ${TILE_HOVER.transition}`,
          "&:hover": {
            borderColor: "primary.light",
            transform: "translateY(-2px)",
            boxShadow: TILE_HOVER.boxShadow,
          },
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

        {group.isGroup && (
          <Typography variant="caption" sx={{ flexShrink: 0 }}>
            {group.rankedChildren}/{group.totalChildren} {group.hasOwnScore ? "overseas" : ""}
          </Typography>
        )}

        <Typography
          variant="body2"
          noWrap={group.ranked}
          sx={{
            width: 130,
            textAlign: "right",
            fontWeight: 700,
            flexShrink: 0,
            lineHeight: group.ranked ? undefined : 1.2,
            color: group.ranked ? scoreBand(group.score).color : "text.disabled",
          }}
        >
          {group.ranked ? scoreLabel(group.score) : "Not enough data to score yet"}
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

        <LinearProgress
          variant="determinate"
          value={group.completeness * 100}
          sx={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 2,
            bgcolor: "transparent",
            "& .MuiLinearProgress-bar": { bgcolor: "grey.300" },
          }}
        />
      </Box>

      {group.isGroup && (
        <Collapse in={expanded}>
          <Stack spacing={0.5} sx={{ pl: 3, pt: 0.5 }}>
            {[...group.children]
              .sort((a, b) => (b.ranked ? b.score : -1) - (a.ranked ? a.score : -1))
              .map((child) => (
                <ChildRow
                  key={child.code}
                  child={child}
                  selected={child.code === selectedCountry}
                  onSelect={onSelect}
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
}: {
  child: CountryScore;
  selected: boolean;
  onSelect: (code: string) => void;
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
        py: 0.5,
        borderRadius: 1,
        cursor: "pointer",
        border: "1px solid",
        borderColor: selected ? "primary.main" : "transparent",
        bgcolor: selected ? "action.selected" : "transparent",
        "&:hover": { bgcolor: selected ? "action.selected" : "action.hover" },
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
        noWrap={child.ranked}
        sx={{
          width: 120,
          textAlign: "right",
          fontWeight: 600,
          flexShrink: 0,
          lineHeight: child.ranked ? undefined : 1.2,
          color: child.ranked ? scoreBand(child.score).color : "text.disabled",
        }}
      >
        {child.ranked ? scoreLabel(child.score) : "Not enough data to score yet"}
      </Typography>
    </Box>
  );
}
