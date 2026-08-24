import { Box, CircularProgress, LinearProgress, Typography } from "@mui/material";

import type { CountryScore, Section } from "../../lib/types";

export interface RailSection extends Section {
  answered: number;
  total: number;
}

interface Props {
  sections: RailSection[];
  selected: string;
  score: CountryScore;
  onSelect: (id: string) => void;
  /** Horizontal scrolling strip instead of a left-hand column - for narrow screens, where a fixed-width sidebar would leave the answer area too cramped. */
  horizontal?: boolean;
}

const RAIL_WIDTH = 232;

/**
 * Persistent list of sections with per-section progress, so it is always
 * visible how much of a country is filled in and where the gaps are.
 * "Highest impact" lives in the tab bar above this, not here, since it is the
 * single most important thing to find and a rail item was not visible enough.
 */
export default function SectionRail({ sections, selected, score, onSelect, horizontal }: Props) {
  if (horizontal) {
    return (
      <Box
        sx={{
          flexShrink: 0,
          borderBottom: "1px solid",
          borderColor: "divider",
          bgcolor: "background.paper",
        }}
      >
        <Box sx={{ display: "flex", overflowX: "auto", px: 1 }}>
          {sections.map((section) => (
            <RailItem
              key={section.id}
              label={section.title}
              selected={selected === section.id}
              onClick={() => onSelect(section.id)}
              horizontal
              trailing={<Ring answered={section.answered} total={section.total} size={22} />}
            />
          ))}
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width: RAIL_WIDTH,
        flexShrink: 0,
        borderRight: "1px solid",
        borderColor: "divider",
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.paper",
      }}
    >
      <Box sx={{ flex: 1, overflowY: "auto", py: 1 }}>
        <Typography variant="overline" sx={{ display: "block", px: 2, pt: 1, pb: 0.5 }}>
          Sections
        </Typography>

        {sections.map((section) => (
          <RailItem
            key={section.id}
            label={section.title}
            selected={selected === section.id}
            onClick={() => onSelect(section.id)}
            trailing={<Ring answered={section.answered} total={section.total} />}
          />
        ))}
      </Box>

      <Box sx={{ p: 2, borderTop: "1px solid", borderColor: "divider" }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
          <Typography variant="caption">Data completeness</Typography>
          <Typography variant="caption" sx={{ fontWeight: 600 }}>
            {Math.round(score.completeness * 100)}%
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={score.completeness * 100}
          sx={{ height: 6, borderRadius: 3 }}
        />
        <Typography variant="caption" sx={{ display: "block", mt: 0.5 }}>
          {score.answered} of {score.total} questions
        </Typography>
      </Box>
    </Box>
  );
}

function RailItem({
  label,
  selected,
  onClick,
  icon,
  trailing,
  horizontal,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
  horizontal?: boolean;
}) {
  return (
    <Box
      onClick={onClick}
      sx={horizontal
        ? {
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 0.5,
            px: 1.5,
            py: 1,
            flexShrink: 0,
            width: 84,
            cursor: "pointer",
            borderBottom: "3px solid",
            borderColor: selected ? "primary.main" : "transparent",
            "&:hover": { bgcolor: "action.hover" },
          }
        : {
            display: "flex",
            alignItems: "center",
            gap: 1,
            px: 2,
            py: 1.25,
            cursor: "pointer",
            borderLeft: "3px solid",
            borderColor: selected ? "primary.main" : "transparent",
            bgcolor: selected ? "action.selected" : "transparent",
            "&:hover": { bgcolor: selected ? "action.selected" : "action.hover" },
          }}
    >
      {icon}
      {trailing}
      <Typography
        variant={horizontal ? "caption" : "body2"}
        sx={{
          flex: horizontal ? undefined : 1,
          minWidth: 0,
          maxWidth: horizontal ? "100%" : undefined,
          textAlign: horizontal ? "center" : undefined,
          color: selected ? "text.primary" : "text.secondary",
          fontWeight: selected ? 600 : 400,
          overflow: horizontal ? "hidden" : undefined,
          textOverflow: horizontal ? "ellipsis" : undefined,
          display: horizontal ? "-webkit-box" : undefined,
          WebkitLineClamp: horizontal ? 2 : undefined,
          WebkitBoxOrient: horizontal ? "vertical" : undefined,
        }}
      >
        {label}
      </Typography>
    </Box>
  );
}

/** Progress ring with the count inside, drawn over a faint full-circle track. */
function Ring({ answered, total, size = 30 }: { answered: number; total: number; size?: number }) {
  const pct = total > 0 ? (answered / total) * 100 : 0;
  const complete = answered === total && total > 0;

  return (
    <Box sx={{ position: "relative", display: "inline-flex", flexShrink: 0 }}>
      <CircularProgress
        variant="determinate"
        value={100}
        size={size}
        thickness={4}
        sx={{ color: "grey.200" }}
      />
      <CircularProgress
        variant="determinate"
        value={pct}
        size={size}
        thickness={4}
        color={complete ? "success" : "primary"}
        sx={{ position: "absolute", left: 0 }}
      />
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Typography sx={{ fontSize: size < 30 ? "0.5rem" : "0.6rem", fontWeight: 600 }}>
          {answered}/{total}
        </Typography>
      </Box>
    </Box>
  );
}
