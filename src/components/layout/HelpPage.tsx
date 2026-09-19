import { Box, Divider, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

import HelpPageShell from "../../../shared/components/HelpPageShell";
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
    <HelpPageShell title={t("help.title")} onBack={onBack} backTooltip={t("help.back")}>
      <Box>
        <Typography variant="h5" gutterBottom sx={{ color: "primary.dark", fontWeight: 700 }}>
          {CHARTER.title}
        </Typography>
        {CHARTER.intro.map((para) => (
          <Typography key={para.slice(0, 32)} variant="body2" sx={{ mb: 1.5 }}>
            {para}
          </Typography>
        ))}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 2 }}>
          {CHARTER.rights.map((right) => (
            <Box key={right.heading}>
              <Typography variant="subtitle2" gutterBottom>
                {right.heading}
              </Typography>
              <Typography variant="body2">{right.body}</Typography>
            </Box>
          ))}
        </Box>
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
    </HelpPageShell>
  );
}
