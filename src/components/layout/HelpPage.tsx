import { Box, Divider, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useTranslation } from "react-i18next";

import { getCharter } from "../../i18n/charter";
import { getHelpContent } from "../../i18n/help";

interface Props {
  onBack: () => void;
}

/**
 * Single-page reference for the app's own concepts - scoring, evidence,
 * jurisdictions - plus the Citizens Electrification Charter itself (the
 * argument for why any of this matters) up top. The Charter used to also
 * have its own nav link opening a modal, but that was redundant with the
 * onboarding tour's own "Read the Citizens Electrification Charter" pill -
 * this is now the one place to read it outside the tour.
 *
 * Both the topic list and the Charter block read from structured,
 * per-language content (getHelpContent()/getCharter(), see
 * src/i18n/help.ts and src/i18n/charter.ts) - flat translation keys don't
 * fit prose this long. The Charter itself is shared verbatim with
 * WelcomeModal.tsx, which reads the same getCharter().
 */
export default function HelpPage({ onBack }: Props) {
  const { t, i18n } = useTranslation();
  const topics = getHelpContent(i18n.language);
  const CHARTER = getCharter(i18n.language);

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", minWidth: 0 }}>
      <Box
        sx={{
          px: 3,
          py: 2,
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Tooltip title={t("help.back")}>
          <IconButton size="small" onClick={onBack}>
            <ArrowBackIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Typography variant="h2">{t("help.title")}</Typography>
      </Box>

      <Box sx={{ flex: 1, overflowY: "auto", p: 3, display: "flex", justifyContent: "center" }}>
        <Stack spacing={3} sx={{ maxWidth: 720, width: "100%" }}>
          <Box>
            <Typography variant="h5" gutterBottom sx={{ color: "primary.dark", fontWeight: 700 }}>
              {CHARTER.title}
            </Typography>
            {CHARTER.intro.map((para) => (
              <Typography key={para.slice(0, 32)} variant="body2" sx={{ mb: 1.5 }}>
                {para}
              </Typography>
            ))}
            <Stack spacing={2} sx={{ mt: 2 }}>
              {CHARTER.rights.map((right) => (
                <Box key={right.heading}>
                  <Typography variant="subtitle2" gutterBottom>
                    {right.heading}
                  </Typography>
                  <Typography variant="body2">{right.body}</Typography>
                </Box>
              ))}
            </Stack>
          </Box>

          <Divider />

          {topics.map((topic) => (
            <Box key={topic.heading}>
              <Typography variant="h6" gutterBottom>
                {topic.heading}
              </Typography>
              <Typography variant="body2">{topic.body}</Typography>
            </Box>
          ))}
        </Stack>
      </Box>
    </Box>
  );
}
