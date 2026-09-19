import type { ReactNode } from "react";
import { Box } from "@mui/material";

interface Props {
  width: number | string;
  children: ReactNode;
}

/**
 * The desktop sidebar shell shared by all three apps - a flex sibling of
 * the map (not an overlay), border-left, `background.paper`, its own
 * column-flex/scroll container, and a width transition when the width
 * value changes (e.g. a default width growing once something's
 * selected) - confirmed byte-identical between deployment's own
 * `Sidebar.tsx` wrapper and calculator's own inline sidebar `Box` in
 * `App.tsx` before this shared copy was written 2026-09-19. Each app
 * still decides its own `width` (fixed vs. expanding) and still composes
 * its own content - the default (no-selection) view and the detail
 * view's content are both entirely per-app, only this outer shell and
 * `DetailHeader.tsx` (the detail view's own header row) are shared.
 */
export default function SidebarShell({ width, children }: Props) {
  return (
    <Box
      sx={{
        width,
        flexShrink: 0,
        borderLeft: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
        display: "flex",
        flexDirection: "column",
        transition: "width 220ms ease",
        overflow: "hidden",
      }}
    >
      {children}
    </Box>
  );
}
