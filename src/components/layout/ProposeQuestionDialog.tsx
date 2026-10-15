import { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";

import { useProtocolStore } from "../../stores/protocolStore";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Section pre-selected in the dropdown - the section the visitor is looking at, if any. */
  defaultSectionId?: string;
}

/**
 * Proposes a brand-new policy question. Files a pending proposal only - the
 * question joins the set (and every country's score) once a reviewer accepts
 * it. Anyone can propose; name is required, organisation is not.
 */
export default function ProposeQuestionDialog({ open, onClose, defaultSectionId }: Props) {
  const { t } = useTranslation();
  const sections = useProtocolStore((s) => s.sections);
  const submitQuestionProposal = useProtocolStore((s) => s.submitQuestionProposal);

  const [sectionId, setSectionId] = useState(defaultSectionId ?? "");
  const [text, setText] = useState("");
  const [strong, setStrong] = useState("");
  const [developed, setDeveloped] = useState("");
  const [weak, setWeak] = useState("");
  const [reason, setReason] = useState("");
  const [source, setSource] = useState("");
  const [name, setName] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [done, setDone] = useState(false);

  // Re-seed the section each time the dialog opens, since the visitor may have moved sections since last time.
  useEffect(() => {
    if (open) setSectionId(defaultSectionId ?? sections[0]?.id ?? "");
  }, [open, defaultSectionId, sections]);

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      setText("");
      setStrong("");
      setDeveloped("");
      setWeak("");
      setReason("");
      setSource("");
      setName("");
      setOrganisation("");
      setDone(false);
    }, 200);
  };

  const required = [sectionId, text, strong, weak, reason, source, name]; // the middle answer is optional - some questions only have two
  const canSubmit = required.every((v) => v.trim() !== "");

  const handleSubmit = () => {
    if (!canSubmit) return;
    submitQuestionProposal({
      sectionId,
      sectionTitle: sections.find((s) => s.id === sectionId)?.title ?? "",
      text: text.trim(),
      strongLabel: strong.trim(),
      developedLabel: developed.trim(),
      weakLabel: weak.trim(),
      reason: reason.trim(),
      source: source.trim(),
      submitterName: name.trim(),
      submitterOrganisation: organisation.trim(),
    });
    setDone(true);
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>{t("proposeDialog.title")}</DialogTitle>
      <DialogContent>
        {done ? (
          <Typography variant="body2">{t("proposeDialog.done")}</Typography>
        ) : (
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              {t("proposeDialog.intro")}
            </Typography>
            <TextField select required size="small" fullWidth label={t("proposeDialog.section")} value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
              {sections.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.title}
                </MenuItem>
              ))}
            </TextField>
            <TextField required size="small" fullWidth multiline minRows={2} label={t("proposeDialog.question")} value={text} onChange={(e) => setText(e.target.value)} />
            <TextField required size="small" fullWidth label={t("proposeDialog.strong")} value={strong} onChange={(e) => setStrong(e.target.value)} />
            <TextField size="small" fullWidth label={t("proposeDialog.developed")} value={developed} onChange={(e) => setDeveloped(e.target.value)} />
            <TextField required size="small" fullWidth label={t("proposeDialog.weak")} value={weak} onChange={(e) => setWeak(e.target.value)} />
            <TextField required size="small" fullWidth multiline minRows={2} label={t("proposeDialog.reason")} value={reason} onChange={(e) => setReason(e.target.value)} />
            <TextField required size="small" fullWidth label={t("proposeDialog.source")} helperText={t("proposeDialog.sourceHint")} value={source} onChange={(e) => setSource(e.target.value)} />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <TextField required size="small" fullWidth label={t("proposeDialog.name")} value={name} onChange={(e) => setName(e.target.value)} />
              <TextField size="small" fullWidth label={t("proposeDialog.organisation")} value={organisation} onChange={(e) => setOrganisation(e.target.value)} />
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
              {t("proposeDialog.submit")}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
