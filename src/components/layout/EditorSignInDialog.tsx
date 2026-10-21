import { useEffect } from "react";
import { Alert, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

import { signInEditor, signOutEditor, useEditorStore } from "../../lib/editorAuth";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called once the person is confirmed as an editor while this is open. */
  onSignedIn: () => void;
}

/**
 * The gate in front of the admin console on builds that edit the shared
 * database (see lib/editorAuth.ts): sign in with Google, then the server says
 * whether that account may edit.
 */
export default function EditorSignInDialog({ open, onClose, onSignedIn }: Props) {
  const { t } = useTranslation();
  const status = useEditorStore((s) => s.status);
  const message = useEditorStore((s) => s.message);

  useEffect(() => {
    if (open && status === "editor") onSignedIn();
  }, [open, status, onSignedIn]);

  const busy = status === "checking";

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t("editor.signInTitle")}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary">
          {t("editor.signInBody")}
        </Typography>
        {status === "not-editor" && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {message ?? t("editor.notEditor")}
          </Alert>
        )}
        {status === "error" && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {t("editor.error")}
            {message ? ` (${message})` : ""}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("editor.cancel")}</Button>
        {status === "not-editor" ? (
          <Button variant="contained" onClick={() => void signOutEditor().then(signInEditor)}>
            {t("editor.useAnotherAccount")}
          </Button>
        ) : (
          <Button
            variant="contained"
            disabled={busy}
            startIcon={busy ? <CircularProgress size={16} color="inherit" /> : undefined}
            onClick={() => void signInEditor()}
          >
            {busy ? t("editor.signingIn") : t("editor.signInButton")}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
