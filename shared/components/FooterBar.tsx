import type { ReactNode } from "react";
import { Box } from "@mui/material";

/**
 * The footer bar shell shared by all three apps - a flex sibling of the
 * map/sidebar row (not `position: fixed`), border-top, `background.paper`,
 * fixed 48px height. Height is deliberately NOT a prop - per Andrew's own
 * instruction 2026-09-19 ("on the footer, lets take a common height
 * between them"), all three apps converge on one height rather than each
 * keeping its own (deployment and the root app were already at 48px;
 * calculator was the outlier at 56px and moves to 48px whenever it's
 * actually ported over to this component - not done yet).
 *
 * Composition (search box, a metric `ToggleButtonGroup`, a flex spacer,
 * an app-specific extra like `EmberBadge`, `LanguageSwitcher`) stays
 * owned by each app's own `children` - the conditions for hiding any one
 * of those pieces (on mobile, once a selection is made) already differ
 * per app and aren't forced into one config shape here.
 */
export default function FooterBar({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        flexShrink: 0,
        height: 48,
        bgcolor: "background.paper",
        borderTop: "1px solid",
        borderColor: "divider",
        display: "flex",
        alignItems: "center",
        px: 2,
        gap: 1.5,
      }}
    >
      {children}
    </Box>
  );
}
