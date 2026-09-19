import type { ReactNode } from "react";
import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

interface Props {
  /** Omit to render no back arrow at all - the root app's own compare-view second panel has nothing to go back to. */
  onBack?: () => void;
  /** Each app renders its own flag image component (`FlagImg.tsx` isn't one of this pass's four shared areas) - pass the already-sized element, e.g. `<FlagImg code={location.countryCode} size={22} />`, or another icon entirely (deployment's own "Global" row uses a `PublicIcon` here instead of a flag). */
  flag: ReactNode;
  name: string;
  /** Anything appended after the name - the root app's own detail view appends a `Tabs` row here. */
  children?: ReactNode;
  /** Tooltip text on the back arrow - default "Back to map"; deployment's own says "Back to ranking" instead. */
  backTooltip?: string;
  /** Extra sx merged onto the row's own Box, e.g. a border-bottom some apps always show and others show conditionally - left to the caller rather than baked in here since that condition already differs per app. */
  sx?: SxProps<Theme>;
}

/**
 * The detail view's own header row - back arrow, flag, name in an `h2` at
 * 1.125rem (`noWrap`) - confirmed byte-identical between deployment's own
 * `Sidebar.tsx` and calculator's own inline sidebar header in `App.tsx`
 * before this shared copy was written 2026-09-19; the root app's own
 * `CountryPanel.tsx` header matches the same skeleton with a bigger flag
 * and a trailing `Tabs` row, covered here via `children`.
 */
export default function DetailHeader({ onBack, flag, name, children, backTooltip = "Back to map", sx }: Props) {
  return (
    <Box sx={[{ p: 2, display: "flex", alignItems: "center", gap: 1 }, ...(Array.isArray(sx) ? sx : [sx])]}>
      {onBack && (
        <Tooltip title={backTooltip}>
          <IconButton size="small" onClick={onBack}>
            <ArrowBackIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      {flag}
      <Typography variant="h2" sx={{ fontSize: "1.125rem", flex: 1, minWidth: 0 }} noWrap>
        {name}
      </Typography>
      {children}
    </Box>
  );
}
