import type { ReactNode } from "react";
import { Box, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

interface Props {
  title: string;
  onBack: () => void;
  backTooltip?: string;
  children: ReactNode;
}

/**
 * The Help page's own shell - back arrow + `h2` header row, a centered
 * max-width-720 scrollable column below it - confirmed byte-identical
 * between deployment's and the root app's own `HelpPage.tsx` before this
 * shared copy was written 2026-09-19. The actual topic content stays
 * per-app (as `children`) - policy's own concepts (scoring, evidence,
 * jurisdictions, the Citizens Electrification Charter) and deployment's
 * (capacity, generation, data sources) don't share anything but this
 * shell; calculator's own new Help page (added the same day) is built on
 * it too.
 */
export default function HelpPageShell({ title, onBack, backTooltip = "Back", children }: Props) {
  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", minWidth: 0 }}>
      <Box sx={{ px: 3, py: 2, display: "flex", alignItems: "center", gap: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
        <Tooltip title={backTooltip}>
          <IconButton size="small" onClick={onBack}>
            <ArrowBackIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Typography variant="h2">{title}</Typography>
      </Box>

      <Box sx={{ flex: 1, overflowY: "auto", p: 3, display: "flex", justifyContent: "center" }}>
        <Stack spacing={3} sx={{ maxWidth: 720, width: "100%" }}>
          {children}
        </Stack>
      </Box>
    </Box>
  );
}
