import { useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";

import { diffResponses, type SuggestionChange } from "../../lib/suggestions";
import { useProtocolStore } from "../../stores/protocolStore";

interface Props {
  open: boolean;
  onClose: () => void;
  countryCode: string;
  countryName: string;
  /** Jumps the country panel to the section that owns this question and scrolls to it - used so a tile doubles as a shortcut back to where its evidence actually lives. */
  onNavigateToQuestion: (questionId: string) => void;
}

type Step = "summary" | "details" | "done";

/** One colour per change kind, so "what kind of change is this" reads at a glance across a list of tiles - distinct from the question's own colour and the answer text's colour. */
const KIND_COLOR: Record<SuggestionChange["kind"], string> = {
  score: "#008194", // GSC teal - matches the "Answer" chip
  "evidence-added": "#2E7D32",
  "evidence-removed": "#C62828",
  "evidence-edited": "#EF864C", // GSC burnt orange
};

const KIND_LABEL: Record<SuggestionChange["kind"], string> = {
  score: "Answer",
  "evidence-added": "Evidence added",
  "evidence-removed": "Evidence removed",
  "evidence-edited": "Evidence edited",
};

/**
 * Everything changed for one country this session, reviewed and then filed
 * as a named suggestion. Editing itself stays live and immediate elsewhere
 * (QuestionCard) - this is just the "package it up and hand it to a
 * reviewer" step, not a gate on the editing itself.
 */
export default function SubmitSuggestionDialog({
  open,
  onClose,
  countryCode,
  countryName,
  onNavigateToQuestion,
}: Props) {
  const questions = useProtocolStore((s) => s.questions);
  const responses = useProtocolStore((s) => s.responses);
  const editBaselines = useProtocolStore((s) => s.editBaselines);
  const submitSuggestion = useProtocolStore((s) => s.submitSuggestion);

  const [step, setStep] = useState<Step>("summary");
  const [name, setName] = useState("");
  const [organisation, setOrganisation] = useState("");

  // This component is always mounted (MUI's `open` only controls visibility,
  // not whether React runs it) - the diffing below only actually needs to
  // run while the dialog is open, and skipping it otherwise means a bug in
  // it can only ever break the dialog itself, not the whole country page
  // sitting behind it every time it re-renders.
  const currentResponses = useMemo(
    () => (open ? responses.filter((r) => r.countryCode === countryCode) : []),
    [open, responses, countryCode],
  );

  const changes = useMemo(() => {
    if (!open) return [];
    try {
      const baseline = editBaselines[countryCode] ?? [];
      return diffResponses(baseline, currentResponses, questions);
    } catch (err) {
      console.error("diffResponses failed", err);
      return [];
    }
  }, [open, editBaselines, countryCode, currentResponses, questions]);

  // A changed answer needs its evidence revised too, not just left over from
  // whatever the old answer cited - flagged here rather than silently
  // accepted, so an admin isn't the first person to notice a suggestion
  // rests on evidence that no longer matches what it's meant to support.
  // Evidence-only changes obviously come with revised evidence already, so
  // only a score change needs to be paired with an evidence-added/-edited/
  // -removed change on that same question to clear the flag.
  const questionIdsWithEvidenceChange = useMemo(
    () =>
      new Set(
        changes.filter((c) => c.kind !== "score").map((c) => c.questionId),
      ),
    [changes],
  );
  const isMissingEvidence = (change: SuggestionChange) =>
    change.kind === "score" && !questionIdsWithEvidenceChange.has(change.questionId);
  const missingEvidenceCount = changes.filter(isMissingEvidence).length;

  const reset = () => {
    setStep("summary");
    setName("");
    setOrganisation("");
  };

  const handleClose = () => {
    onClose();
    reset();
  };

  const handleSubmit = () => {
    submitSuggestion({
      countryCode,
      countryName,
      submitterName: name.trim(),
      submitterOrganisation: organisation.trim(),
    });
    setStep("done");
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Submit revised evidence</DialogTitle>
      <DialogContent dividers>
        {step === "summary" && (
          <>
            <Typography variant="body2" sx={{ mb: missingEvidenceCount > 0 ? 1 : 2 }}>
              {changes.length === 0
                ? `No changes recorded yet for ${countryName} this session.`
                : `${changes.length} change${changes.length === 1 ? "" : "s"} for ${countryName} this session:`}
            </Typography>
            {missingEvidenceCount > 0 && (
              <Typography variant="body2" color="warning.main" sx={{ mb: 2, fontWeight: 600 }}>
                {missingEvidenceCount} answer{missingEvidenceCount === 1 ? "" : "s"} below{" "}
                {missingEvidenceCount === 1 ? "has" : "have"} not had its evidence revised - add or
                edit at least one citation for each before this can be submitted.
              </Typography>
            )}
            <Stack spacing={1}>
              {changes.map((c, i) => {
                const flagged = isMissingEvidence(c);
                return (
                  <Box
                    key={i}
                    onClick={() => onNavigateToQuestion(c.questionId)}
                    sx={{
                      p: 1.5,
                      borderRadius: 1.5,
                      border: "1px solid",
                      borderColor: flagged ? "warning.main" : "divider",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 0.5,
                      "&:hover": { borderColor: "primary.main", bgcolor: "action.hover" },
                    }}
                  >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1, mb: 0.5 }}>
                        <Typography
                          variant="caption"
                          sx={{ display: "block", color: "primary.dark", fontWeight: 700 }}
                        >
                          {c.questionText}
                        </Typography>
                        <Box sx={{ display: "flex", gap: 0.5, flexShrink: 0 }}>
                          <Chip
                            size="small"
                            label={KIND_LABEL[c.kind]}
                            sx={{
                              bgcolor: `${KIND_COLOR[c.kind]}1F`,
                              color: KIND_COLOR[c.kind],
                              fontWeight: 600,
                            }}
                          />
                          {flagged && (
                            <Chip
                              size="small"
                              icon={<WarningAmberIcon fontSize="small" />}
                              label="Evidence not revised"
                              color="warning"
                              variant="outlined"
                            />
                          )}
                        </Box>
                      </Box>
                      <Typography variant="body2" sx={{ color: "text.primary", fontWeight: 500 }}>
                        {c.description}
                      </Typography>
                    </Box>
                    <ChevronRightIcon fontSize="small" sx={{ color: "text.disabled", flexShrink: 0, mt: 0.25 }} />
                  </Box>
                );
              })}
            </Stack>
          </>
        )}

        {step === "details" && (
          <Stack spacing={2}>
            <Typography variant="body2">
              Add your name and organisation so a reviewer knows who suggested this.
            </Typography>
            <TextField
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              required
            />
            <TextField
              label="Organisation"
              value={organisation}
              onChange={(e) => setOrganisation(e.target.value)}
              fullWidth
              required
            />
          </Stack>
        )}

        {step === "done" && (
          <Typography variant="body2">
            Thanks - your suggested changes have been submitted for review.
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        {step === "summary" && (
          <>
            <Button onClick={handleClose}>Cancel</Button>
            <Button
              variant="contained"
              onClick={() => setStep("details")}
              disabled={changes.length === 0 || missingEvidenceCount > 0}
            >
              Continue
            </Button>
          </>
        )}
        {step === "details" && (
          <>
            <Button onClick={() => setStep("summary")}>Back</Button>
            <Button variant="contained" onClick={handleSubmit} disabled={!name.trim() || !organisation.trim()}>
              Submit
            </Button>
          </>
        )}
        {step === "done" && (
          <Button variant="contained" onClick={handleClose}>
            Close
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
