import type { ReactNode } from "react";
import { Box } from "@mui/material";

import FooterBar from "./FooterBar";

interface Props {
  /** The location/jurisdiction search box - omit to hide (e.g. on mobile, where search moves elsewhere). */
  search?: ReactNode;
  /** The map's own metric `ToggleButtonGroup` - omit to hide (e.g. once a selection is made). */
  toggle?: ReactNode;
  /** An app-specific extra between the spacer and the language switcher - e.g. deployment's own `EmberBadge`. */
  extra?: ReactNode;
  languageSwitcher: ReactNode;
}

/**
 * The footer's own fixed slot order - search, toggle, a flex spacer,
 * an optional extra, then the language switcher - confirmed identical
 * across all three apps 2026-09-19 (per Andrew's own instruction "footer
 * composition... should be the same and common"). Each app still decides
 * *what* goes in each slot and when to hide it (mobile state, a selection
 * having been made) by passing or omitting the prop - only the slot set
 * and their order is shared here, on top of `FooterBar`'s own shell.
 */
export default function FooterComposition({ search, toggle, extra, languageSwitcher }: Props) {
  return (
    <FooterBar>
      {search}
      {toggle}
      <Box sx={{ flex: 1 }} />
      {extra}
      {languageSwitcher}
    </FooterBar>
  );
}
