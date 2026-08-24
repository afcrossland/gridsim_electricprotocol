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
import WarningAmberIcon from "@mui/icons-material/WarningAmber";

import { diffResponses, type SuggestionChange } from "../../lib/suggestions";
import { useProtocolStore } from "../../stores/protocolStore";

interface Props {
  open: boolean;
  onClose: () => void;
  countryCode: string;
  countryName: string;
}

type Step = "summary" | "details" | "done";

/**
 * Everything changed for one country this session, reviewed and then filed
 * as a named suggestion. Editing itself stays live and immediate elsewhere
 * (QuestionCard) - this is just the "package it up and hand it to a
 * reviewer" step, not a gate on the editing itself.
 */
export default function SubmitSuggestionDialog({ open, onClose, countryCode, countryName }: Props) {
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

  // A new or changed answer needs something backing it up - flagged here
  // rather than silently accepted, so an admin isn't the first person to
  // notice a suggestion has no evidence behind it. Evidence-only changes
  // (added/removed/edited) obviously already have evidence, so only score
  // changes are checked.
  const evidenceByQuestion = useMemo(
    () => new Map(currentResponses.map((r) => [r.questionId, r.evidence])),
    [currentResponses],
  );
  const isMissingEvidence = (change: SuggestionChange) =>
    change.kind === "score" && (evidenceByQuestion.get(change.questionId)?.length ?? 0) === 0;
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
                {missingEvidenceCount === 1 ? "has" : "have"} no evidence yet - add at least one
                citation for each before this can be submitted.
              </Typography>
            )}
            <Stack spacing={1}>
              {changes.map((c, i) => {
                const flagged = isMissingEvidence(c);
                return (
                  <Box
                    key={i}
                    sx={{
                      p: 1.5,
                      borderRadius: 1.5,
                      border: "1px solid",
                      borderColor: flagged ? "warning.main" : "divider",
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                        {c.questionText}
                      </Typography>
                      {flagged && (
                        <Chip
                          size="small"
                          icon={<WarningAmberIcon fontSize="small" />}
                          label="No evidence"
                          color="warning"
                          variant="outlined"
                          sx={{ flexShrink: 0 }}
                        />
                      )}
                    </Box>
                    <Typography variant="body2">{c.description}</Typography>
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
