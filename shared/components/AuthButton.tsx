import { Button, IconButton, Tooltip } from "@mui/material";
import type { PaletteMode } from "@mui/material/styles";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";

interface Props {
  /** "Login" (deployment, calculator) or "Admin console" (policy). */
  label: string;
  mode: PaletteMode;
  /** Tooltip text - default "Coming soon" (deployment's own convention, the clearer of the two pre-existing versions - policy's own just repeated the label). */
  tooltip?: string;
  /**
   * Policy's own "Admin console" button is NOT a placeholder like the
   * other two apps' "Login" - it opens a real editing page (behind an
   * editor's Google sign-in on builds that edit the shared database - see
   * policy's `lib/editorAuth.ts`), so it needs a real `onClick`. Omit for
   * the true placeholder case (deployment's/calculator's own "Login").
   */
  onClick?: () => void;
  /**
   * "contained" (default) is the filled brand button. "text" is a quiet nav
   * link - policy's own Admin console, which is for the few people editing
   * answers, not the public reading them, so it shouldn't be the most
   * prominent control in the header.
   */
  variant?: "contained" | "text";
}

/**
 * The Login/Admin-console lock-icon placeholder button - icon-only on
 * mobile, a labelled `Button` with the same `startIcon` on desktop -
 * confirmed near-identical between deployment's and the root app's own
 * `TopNavbar.tsx` before this shared copy was written 2026-09-19. No real
 * auth exists anywhere in this repo yet - this is a deliberate
 * placeholder in every app that renders it (see each app's own "stands in
 * for auth" callout), not a dead click; the tooltip is what tells a
 * visitor that.
 */
export default function AuthButton({ label, mode, tooltip = "Coming soon", onClick, variant = "contained" }: Props) {
  const quiet = variant === "text";
  return (
    <>
      <Tooltip title={tooltip}>
        <IconButton
          onClick={onClick}
          sx={
            quiet
              ? { display: { xs: "inline-flex", sm: "none" }, ml: 1.5, color: "text.secondary" }
              : {
                  display: { xs: "inline-flex", sm: "none" },
                  ml: 1.5,
                  bgcolor: mode === "dark" ? "#4B5563" : "primary.main",
                  color: "primary.contrastText",
                  "&:hover": { bgcolor: mode === "dark" ? "#5B6570" : "primary.dark" },
                }
          }
        >
          <LockOutlinedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title={tooltip}>
        <Button
          size="small"
          variant={variant}
          startIcon={<LockOutlinedIcon fontSize="small" />}
          onClick={onClick}
          sx={{ display: { xs: "none", sm: "inline-flex" }, ml: 1.5, ...(quiet && { color: "text.secondary" }) }}
        >
          {label}
        </Button>
      </Tooltip>
    </>
  );
}
