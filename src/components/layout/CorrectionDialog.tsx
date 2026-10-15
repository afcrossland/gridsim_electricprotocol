import { useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";

import { capitalizeFirst } from "../../lib/text";
import type { Question, Response } from "../../lib/types";
import { useProtocolStore } from "../../stores/protocolStore";

interface Props {
  open: boolean;
  onClose: () => void;
  question: Question;
  response: Response | undefined;
  countryCode: string;
  countryName: string;
}

/**
 * One-question correction: pick the answer you think is right, link the
 * evidence, say what it shows, say who you are. Files a pending Suggestion
 * without touching the live answer (see `submitCorrection`). Submit stays
 * disabled until every required field is filled - the evidence requirement
 * is taught by the form itself rather than by text on the main screen.
 */
export default function CorrectionDialog({ open, onClose, question, response, countryCode, countryName }: Props) {
  const { t } = useTranslation();
  const submitCorrection = useProtocolStore((s) => s.submitCorrection);

  const [score, setScore] = useState<number | null>(null);
  const [source, setSource] = useState("");
  const [reason, setReason] = useState("");
  const [name, setName] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [done, setDone] = useState(false);
  const [touchedSource, setTouchedSource] = useState(false);

  const handleClose = () => {
    onClose();
    // Reset after the close animation so the form doesn't flash empty.
    setTimeout(() => {
      setScore(null);
      setSource("");
      setReason("");
      setName("");
      setOrganisation("");
      setDone(false);
      setTouchedSource(false);
    }, 200);
  };

  const sourceOk = source.trim() !== "";
  const canSubmit = score !== null && sourceOk && reason.trim() !== "" && name.trim() !== "";

  const handleSubmit = () => {
    if (!canSubmit) return;
    submitCorrection({
      countryCode,
      countryName,
      questionId: question.id,
      proposedScore: score,
      source,
      reason,
      submitterName: name.trim(),
      submitterOrganisation: organisation.trim(),
    });
    setDone(true);
  };

  const tiers = [...question.rubric].sort((a, b) => b.score - a.score);

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>{t("correctionDialog.title")}</DialogTitle>
      <DialogContent>
        {done ? (
          <Typography variant="body2">{t("correctionDialog.done")}</Typography>
        ) : (
          <Stack spacing={2.5} sx={{ pt: 0.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {question.text}
            </Typography>

            <Box>
              <Typography variant="caption" color="text.secondary">
                {t("correctionDialog.which")}
              </Typography>
              <RadioGroup value={score ?? ""} onChange={(e) => setScore(Number(e.target.value))}>
                {tiers.map((tier) => (
                  <FormControlLabel
                    key={tier.score}
                    value={tier.score}
                    control={<Radio size="small" />}
                    label={
                      <Typography variant="body2">
                        {capitalizeFirst(tier.label)}
                        {response?.score === tier.score && (
                          <Typography component="span" variant="caption" color="text.secondary">
                            {" "}
                            ({t("correctionDialog.current")})
                          </Typography>
                        )}
                      </Typography>
                    }
                    sx={{ alignItems: "flex-start", "& .MuiRadio-root": { pt: 0.5 } }}
                  />
                ))}
              </RadioGroup>
            </Box>

            <TextField
              required
              size="small"
              fullWidth
              label={t("correctionDialog.source")}
              placeholder={t("correctionDialog.sourcePlaceholder")}
              value={source}
              onChange={(e) => setSource(e.target.value)}
              onBlur={() => setTouchedSource(true)}
              error={touchedSource && !sourceOk}
              helperText={touchedSource && !sourceOk ? t("correctionDialog.sourceError") : t("correctionDialog.sourceHint")}
            />

            <TextField
              required
              size="small"
              fullWidth
              multiline
              minRows={2}
              label={t("correctionDialog.reason")}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <TextField
                required
                size="small"
                fullWidth
                label={t("correctionDialog.name")}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <TextField
                size="small"
                fullWidth
                label={t("correctionDialog.organisation")}
                value={organisation}
                onChange={(e) => setOrganisation(e.target.value)}
              />
            </Stack>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        {done ? (
          <Button onClick={handleClose}>{t("suggestionDialog.close")}</Button>
        ) : (
          <>
            <Button onClick={handleClose}>{t("suggestionDialog.cancel")}</Button>
            <Button variant="contained" disabled={!canSubmit} onClick={handleSubmit}>
              {t("correctionDialog.submit")}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
