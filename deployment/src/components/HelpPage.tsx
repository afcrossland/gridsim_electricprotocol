import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

import HelpPageShell from "../../../shared/components/HelpPageShell";
import { getHelpContent, type HelpRun } from "../i18n/help";

interface Props {
  onBack: () => void;
}

/** One run of text, rendered as a link, bold, or plain, matching the HelpRun shape from src/i18n/help.ts. */
function Run({ run }: { run: HelpRun }) {
  if (run.href) {
    return (
      <Box
        component="a"
        href={run.href}
        target="_blank"
        rel="noopener noreferrer"
        sx={{ color: "primary.main", fontWeight: run.bold ? 700 : 400 }}
      >
        {run.text}
      </Box>
    );
  }
  return run.bold ? <strong>{run.text}</strong> : <>{run.text}</>;
}

/**
 * Simple, plain-language reference page - matches ep_policymap's
 * HelpPage.tsx structure (back arrow + h2 header, a centered max-width
 * column of topic sections). Content moved into structured, per-language
 * JSON 2026-09-11 as part of this app's i18next setup (see
 * src/i18n/help.ts for why it's richer than ep_policymap's own flat
 * heading/body shape - bullets, bold terms and a formula line need more
 * than a plain string per section).
 */
export default function HelpPage({ onBack }: Props) {
  const { t, i18n } = useTranslation();
  const sections = getHelpContent(i18n.language);

  return (
    <HelpPageShell title={t("help.title")} onBack={onBack} backTooltip={t("help.back")}>
      {sections.map((section) => (
        <Box key={section.heading}>
          <Typography variant="h6" gutterBottom>
            {section.heading}
          </Typography>
          {section.blocks.map((block, i) => {
            if (block.type === "paragraph") {
              return (
                <Typography key={i} variant="body2" sx={{ mt: i > 0 ? 1 : 0 }}>
                  {block.runs.map((run, j) => (
                    <Run key={j} run={run} />
                  ))}
                </Typography>
              );
            }
            if (block.type === "list") {
              return (
                <Box key={i} component="ul" sx={{ my: 1, pl: 3 }}>
                  {block.items.map((item, j) => (
                    <Typography key={j} component="li" variant="body2">
                      {item.map((run, k) => (
                        <Run key={k} run={run} />
                      ))}
                    </Typography>
                  ))}
                </Box>
              );
            }
            return (
              <Typography
                key={i}
                variant="body2"
                sx={{
                  my: 1,
                  py: 1,
                  px: 1.5,
                  borderRadius: 1,
                  bgcolor: "action.hover",
                  fontFamily: "monospace",
                  textAlign: "center",
                }}
              >
                {block.text}
              </Typography>
            );
          })}
        </Box>
      ))}
    </HelpPageShell>
  );
}
