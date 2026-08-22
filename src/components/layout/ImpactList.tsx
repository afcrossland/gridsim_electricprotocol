import { Box, Chip, Stack, Typography } from "@mui/material";

import type { ImpactItem } from "../../lib/types";

interface Props {
  items: ImpactItem[];
  limit?: number;
  onJump?: (questionId: string) => void;
}

/**
 * Highest-impact changes, ranked by weighted points available. Weight is shown
 * explicitly because it is the whole basis of the ranking, and a reader who
 * disagrees with an ordering usually disagrees with a weight.
 */
export default function ImpactList({ items, limit = 10, onJump }: Props) {
  const shown = items.slice(0, limit);

  if (shown.length === 0) {
    return (
      <Typography variant="body2" sx={{ p: 2 }}>
        Nothing to show yet - every answered question is already at full marks,
        or none have been answered. Use Answer the questions to add some.
      </Typography>
    );
  }

  return (
    <Stack spacing={1}>
      {shown.map((item) => (
        <Box
          key={item.question.id}
          onClick={() => onJump?.(item.question.id)}
          sx={{
            p: 1.5,
            borderRadius: 2,
            border: "1px solid",
            borderColor: "divider",
            bgcolor: "background.paper",
            cursor: onJump ? "pointer" : "default",
            "&:hover": onJump ? { borderColor: "primary.light" } : undefined,
          }}
        >
          <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="overline" sx={{ display: "block" }}>
                {item.section.title}
              </Typography>
              <Typography variant="body1">{item.question.text}</Typography>
            </Box>
            <Chip
              size="small"
              label={`+${item.gain.toFixed(1)}`}
              color="primary"
              sx={{ flexShrink: 0 }}
            />
          </Box>

          <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
            <Chip
              size="small"
              variant="outlined"
              label={`Currently: ${item.question.rubric.find((t) => t.score === item.currentScore)?.label ?? item.currentScore}`}
            />
            <Chip size="small" variant="outlined" label={`Weight ${item.question.weight}`} />
          </Box>
        </Box>
      ))}
    </Stack>
  );
}
