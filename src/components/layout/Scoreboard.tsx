import { Box, LinearProgress, Stack, Typography } from "@mui/material";

import { scoreColor } from "../../lib/scoring";
import type { CountryScore } from "../../lib/types";
import FlagImg from "../ui/FlagImg";

interface Props {
  scores: CountryScore[];
  selectedCountry: string | null;
  onSelect: (code: string) => void;
}

/**
 * Ranked jurisdictions. Anything below the completeness threshold is listed
 * under the ranked table rather than mixed into it — a country with four
 * confident answers would otherwise sit at the top of the board on almost no
 * evidence.
 */
export default function Scoreboard({ scores, selectedCountry, onSelect }: Props) {
  const ranked = scores.filter((s) => s.ranked).sort((a, b) => b.score - a.score);
  const unranked = scores
    .filter((s) => !s.ranked && s.answered > 0)
    .sort((a, b) => b.completeness - a.completeness);

  return (
    <Box sx={{ p: 2, overflowY: "auto", height: "100%" }}>
      <Typography variant="h2" gutterBottom>
        Scoreboard
      </Typography>

      {ranked.length === 0 && (
        <Typography variant="body2" sx={{ mb: 2 }}>
          No jurisdiction has enough answers to be ranked yet.
        </Typography>
      )}

      <Stack spacing={0.75}>
        {ranked.map((s, i) => (
          <Row
            key={s.code}
            rank={i + 1}
            score={s}
            selected={s.code === selectedCountry}
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
            {unranked.map((s) => (
              <Row
                key={s.code}
                score={s}
                selected={s.code === selectedCountry}
                onSelect={onSelect}
              />
            ))}
          </Stack>
        </>
      )}
    </Box>
  );
}

/**
 * One line per jurisdiction. Completeness is a hairline bar along the bottom
 * edge rather than its own row, which keeps the row to a single band of text
 * without losing the signal that a score rests on partial evidence.
 */
function Row({
  rank,
  score,
  selected,
  onSelect,
}: {
  rank?: number;
  score: CountryScore;
  selected: boolean;
  onSelect: (code: string) => void;
}) {
  return (
    <Box
      onClick={() => onSelect(score.code)}
      sx={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        pl: 1.25,
        pr: 1.5,
        py: 0.75,
        borderRadius: 1.5,
        cursor: "pointer",
        overflow: "hidden",
        bgcolor: selected ? "action.selected" : "background.paper",
        border: "1px solid",
        borderColor: selected ? "primary.main" : "divider",
        "&:hover": { borderColor: "primary.light" },
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

      <FlagImg code={score.code} size={22} />

      <Typography variant="subtitle1" noWrap sx={{ flex: 1, minWidth: 0 }}>
        {score.name}
      </Typography>

      <Typography variant="caption" sx={{ flexShrink: 0 }}>
        {score.answered}/{score.total}
      </Typography>

      <Typography
        variant="subtitle1"
        sx={{
          width: 44,
          textAlign: "right",
          fontWeight: 700,
          flexShrink: 0,
          color: score.ranked ? scoreColor(score.score) : "text.disabled",
        }}
      >
        {score.ranked ? `${Math.round(score.score * 100)}%` : "—"}
      </Typography>

      <LinearProgress
        variant="determinate"
        value={score.completeness * 100}
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
  );
}
