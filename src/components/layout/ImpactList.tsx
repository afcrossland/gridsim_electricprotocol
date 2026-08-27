import { Box, Chip, Stack, Typography } from "@mui/material";

import type { ImpactItem } from "../../lib/types";
import { impactColor, impactLabel, impactTextColor } from "../../lib/scoring";
import { capitalizeFirst } from "../../lib/text";

interface Props {
  items: ImpactItem[];
  limit?: number;
}

/**
 * Highest-impact changes, ranked by weighted points available. Each
 * question's impact is shown explicitly because it is the whole basis of the
 * ranking, and a reader who disagrees with an ordering usually disagrees with
 * an impact score.
 */
export default function ImpactList({ items, limit = 10 }: Props) {
  const shown = items.slice(0, limit);

  if (shown.length === 0) {
    return (
      <Typography variant="body2" sx={{ p: 2 }}>
        Nothing to show yet - every answered question is already at full marks,
        or none have been answered. Use Policy Landscape to add some.
      </Typography>
    );
  }

  return (
    <Stack spacing={1}>
      {shown.map((item) => (
        <Box
          key={item.question.id}
          sx={{
            p: 1.5,
            borderRadius: 2,
            border: "1px solid",
            borderColor: "divider",
            bgcolor: "background.paper",
          }}
        >
          <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="overline" sx={{ display: "block", color: "primary.dark", fontWeight: 700 }}>
                {item.section.title}
              </Typography>
              <Typography variant="body1" sx={{ overflowWrap: "break-word" }}>
                {item.question.text}
              </Typography>
            </Box>
            {/* The raw weighted-points gain (e.g. "+12.0") used to sit here as
                its own chip, but a wide number on a narrow tile could overflow
                it - the question's Impact is the more useful, consistently
                bounded thing to show at a glance, and it is shown once here
                rather than duplicated below too. */}
            <Chip
              size="small"
              label={`Impactfullness: ${impactLabel(item.question.weight)}`}
              sx={{
                flexShrink: 0,
                bgcolor: impactColor(item.question.weight),
                color: impactTextColor(item.question.weight),
                fontWeight: 600,
              }}
            />
          </Box>

          {/* A rubric tier's label can run to a full sentence - a Chip clips
              its label to one line with an ellipsis, so plain wrapping text
              is used instead to keep the whole thing readable. */}
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, overflowWrap: "break-word" }}>
            <Box component="span" sx={{ color: "warning.main", fontWeight: 600 }}>
              Currently:
            </Box>{" "}
            {(() => {
              const label = item.question.rubric.find((t) => t.score === item.currentScore)?.label;
              return label ? capitalizeFirst(label) : item.currentScore;
            })()}
          </Typography>
        </Box>
      ))}
    </Stack>
  );
}
