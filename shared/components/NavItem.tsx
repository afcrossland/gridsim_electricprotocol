import type { ReactNode } from "react";
import { Box } from "@mui/material";

interface Props {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}

/**
 * The plain underlined-link look every app's own header nav (Tour, Help,
 * Admin console, Login) already uses - originated in the root app's own
 * `TopNavbar.tsx`'s local `navItemSx(active)`, then copy-pasted into
 * deployment's own `TopNavbar.tsx` (its own doc comment says so
 * outright: "ported from ep_policymap's own TopNavbar.tsx's navItemSx").
 * Extracted as a real component 2026-09-19 (per Andrew's own instruction
 * "link together the nav links on header with a common style") instead of
 * a third copy - each app still decides which links exist and what they
 * do (composed as `AppHeader`'s own `children`); only the link's *look*
 * (grey text, aqua text + bottom border when active, hover colour) is
 * shared here.
 */
export default function NavItem({ active, onClick, children }: Props) {
  return (
    <Box
      onClick={onClick}
      sx={{
        display: "flex",
        alignItems: "center",
        height: "100%",
        px: { xs: 1, sm: 2 },
        cursor: "pointer",
        color: active ? "primary.main" : "text.secondary",
        fontWeight: active ? 500 : 400,
        fontSize: "0.875rem",
        borderBottom: active ? "2px solid" : "2px solid transparent",
        borderColor: active ? "primary.main" : "transparent",
        transition: "color 0.15s ease, border-color 0.15s ease",
        userSelect: "none",
        "&:hover": { color: "primary.main" },
      }}
    >
      {children}
    </Box>
  );
}
