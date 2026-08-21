import { Box, CircularProgress, LinearProgress, Typography } from "@mui/material";
import BoltIcon from "@mui/icons-material/Bolt";

import type { CountryScore, Section } from "../../lib/types";

export interface RailSection extends Section {
  answered: number;
  total: number;
}

interface Props {
  sections: RailSection[];
  selected: string;
  impactCount: number;
  score: CountryScore;
  onSelect: (id: string) => void;
}

const RAIL_WIDTH = 232;

/**
 * Persistent list of sections with per-section progress, so it is always
 * visible how much of a country is filled in and where the gaps are. The
 * highest-impact list sits at the top as a pinned entry rather than a tab,
 * because it is the thing most worth acting on.
 */
export default function SectionRail({
  sections,
  selected,
  impactCount,
  score,
  onSelect,
}: Props) {
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
        <RailItem
          label="Highest impact"
          selected={selected === "impact"}
          onClick={() => onSelect("impact")}
          icon={<BoltIcon fontSize="small" color="secondary" />}
          trailing={
            <Typography variant="caption" sx={{ fontWeight: 600 }}>
              {impactCount}
            </Typography>
          }
        />

        <Typography variant="overline" sx={{ display: "block", px: 2, pt: 2, pb: 0.5 }}>
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
          <Typography variant="caption">Completeness</Typography>
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
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <Box
      onClick={onClick}
      sx={{
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
      <Typography
        variant="body2"
        sx={{
          flex: 1,
          minWidth: 0,
          color: selected ? "text.primary" : "text.secondary",
          fontWeight: selected ? 600 : 400,
        }}
      >
        {label}
      </Typography>
      {trailing}
    </Box>
  );
}

/** Progress ring with the count inside, drawn over a faint full-circle track. */
function Ring({ answered, total }: { answered: number; total: number }) {
  const pct = total > 0 ? (answered / total) * 100 : 0;
  const complete = answered === total && total > 0;

  return (
    <Box sx={{ position: "relative", display: "inline-flex", flexShrink: 0 }}>
      <CircularProgress
        variant="determinate"
        value={100}
        size={30}
        thickness={4}
        sx={{ color: "grey.200" }}
      />
      <CircularProgress
        variant="determinate"
        value={pct}
        size={30}
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
        <Typography sx={{ fontSize: "0.6rem", fontWeight: 600 }}>
          {answered}/{total}
        </Typography>
      </Box>
    </Box>
  );
}
