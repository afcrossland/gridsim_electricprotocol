import { Alert, Box, CircularProgress, Typography } from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import { useTranslation } from "react-i18next";

import { editsSaveToDatabase, useEditorStore } from "../../lib/editorAuth";
import { useSyncStore } from "../../lib/policySync";

/**
 * Whether editors' changes have reached the policy database
 * (lib/policySync.ts). Renders nothing on builds where edits stay in the
 * browser.
 */
export default function SaveStatus() {
  const { t } = useTranslation();
  const active = useEditorStore((s) => editsSaveToDatabase(s));
  const pending = useSyncStore((s) => s.pending);
  const error = useSyncStore((s) => s.error);

  if (!active) return null;
  if (error) {
    return (
      <Alert severity="error" sx={{ py: 0, px: 1, fontSize: "0.8rem" }}>
        {t("sync.error", { message: error })}
      </Alert>
    );
  }
  return (
    <Box role="status" aria-live="polite" sx={{ display: "flex", alignItems: "center", gap: 0.5, color: "text.secondary", flexShrink: 0 }}>
      {pending > 0 ? <CircularProgress size={12} color="inherit" /> : <CheckIcon sx={{ fontSize: 14 }} />}
      <Typography variant="caption">{pending > 0 ? t("sync.saving") : t("sync.saved")}</Typography>
    </Box>
  );
}
