import { useState } from "react";
import { Box, Button, Chip, Collapse, IconButton, Paper, Stack, Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

import type { Suggestion } from "../../lib/suggestions";
import { useProtocolStore } from "../../stores/protocolStore";
import FlagImg from "../ui/FlagImg";

const STATUS_COLOR: Record<Suggestion["status"], "warning" | "success" | "error"> = {
  pending: "warning",
  accepted: "success",
  rejected: "error",
};

/** Border/tint colour for the whole row, not just the status Chip, so accepted/rejected read at a glance across the list. */
const STATUS_BORDER: Record<Suggestion["status"], string> = {
  pending: "warning.main",
  accepted: "success.main",
  rejected: "error.main",
};

/**
 * Every suggestion submitted so far ("Submit revised evidence" in
 * CountryPanel), newest first. Editing itself already happened live when
 * it was made - accepting one here is just marking it reviewed; rejecting
 * one reverts exactly the fields it touched, via `reviewSuggestion` in the
 * store.
 *
 * TODO: only ever shows suggestions submitted in this same browser - see
 * the TODO on `diffResponses` in `lib/suggestions.ts` for why, and open to
 * anyone for the same reason the rest of the Admin console is (no auth yet).
 */
export default function SuggestionsReview() {
  const suggestions = useProtocolStore((s) => s.suggestions);
  const reviewSuggestion = useProtocolStore((s) => s.reviewSuggestion);

  const sorted = [...suggestions].sort((a, b) => {
    if (a.status !== b.status) return a.status === "pending" ? -1 : b.status === "pending" ? 1 : 0;
    return b.submittedAt.localeCompare(a.submittedAt);
  });

  if (sorted.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No suggested changes yet. When someone uses "Submit revised evidence" on a country's page,
        it shows up here for review.
      </Typography>
    );
  }

  return (
    <Stack spacing={1.5}>
      {sorted.map((s) => (
        <SuggestionRow key={s.id} suggestion={s} onReview={reviewSuggestion} />
      ))}
    </Stack>
  );
}

function SuggestionRow({
  suggestion,
  onReview,
}: {
  suggestion: Suggestion;
  onReview: (id: string, decision: "accepted" | "rejected") => void;
}) {
  const [expanded, setExpanded] = useState(suggestion.status === "pending");

  return (
    <Paper
      variant="outlined"
      sx={{ p: 2, borderLeft: "4px solid", borderLeftColor: STATUS_BORDER[suggestion.status] }}
    >
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <FlagImg code={suggestion.countryCode} size={18} />
            <Typography variant="subtitle1">{suggestion.countryName}</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            <Box component="span" sx={{ fontWeight: 600 }}>From:</Box> {suggestion.submitterName}
            {" · "}
            <Box component="span" sx={{ fontWeight: 600 }}>Organisation:</Box> {suggestion.submitterOrganisation}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {new Date(suggestion.submittedAt).toLocaleString()} - {suggestion.changes.length} change
            {suggestion.changes.length === 1 ? "" : "s"}
          </Typography>
        </Box>

        <Chip
          size="small"
          label={suggestion.status}
          color={STATUS_COLOR[suggestion.status]}
          sx={{ fontWeight: 700, textTransform: "capitalize" }}
        />

        <IconButton size="small" onClick={() => setExpanded((v) => !v)}>
          <ExpandMoreIcon
            fontSize="small"
            sx={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 150ms" }}
          />
        </IconButton>
      </Box>

      <Collapse in={expanded}>
        <Stack spacing={1} sx={{ mt: 1.5 }}>
          {suggestion.changes.map((c, i) => (
            <Box key={i} sx={{ p: 1.25, borderRadius: 1.5, border: "1px solid", borderColor: "divider" }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                {c.questionText}
              </Typography>
              <Typography variant="body2">{c.description}</Typography>
            </Box>
          ))}
        </Stack>

        <Box sx={{ display: "flex", gap: 1, mt: 1.5 }}>
          {suggestion.status !== "accepted" && (
            <Button size="small" variant="contained" color="success" onClick={() => onReview(suggestion.id, "accepted")}>
              Accept
            </Button>
          )}
          {suggestion.status !== "rejected" && (
            <Button size="small" variant="outlined" color="error" onClick={() => onReview(suggestion.id, "rejected")}>
              Reject
            </Button>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
}
