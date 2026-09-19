import { Box } from "@mui/material";
import type { PaletteMode } from "@mui/material/styles";

import AppHeader from "../../../shared/components/AppHeader";
import AuthButton from "../../../shared/components/AuthButton";
import NavItem from "../../../shared/components/NavItem";

interface Props {
  mode: PaletteMode;
  setMode: (mode: PaletteMode) => void;
  page: "map" | "help";
  setPage: (page: "map" | "help") => void;
  onStartTour: () => void;
}

/**
 * Ported onto the shared `AppHeader` (`shared/components/`) 2026-09-19 -
 * the identity block (logo/title/subtitle) and dark-mode toggle are now
 * the shared component. Gained Tour/Help/Login nav links the same day,
 * per Andrew's own instruction ("give calculator the same buttons too") -
 * this app had none before; the buttons are the same shared `NavItem`/
 * `AuthButton` deployment and policy already use, with new content
 * (`../tour/scenes.ts`, `./HelpPage.tsx`) behind them since this app had
 * no tour or Help page at all.
 */
export default function TopNavbar({ mode, setMode, page, setPage, onStartTour }: Props) {
  // Unlike the sibling apps (which link back to their shared site root via
  // BASE_URL), this app's own BASE_URL is "/calculator/" - one path segment
  // below the Electric Futures Playbook root it needs to return to, not
  // the root itself, so this is hardcoded rather than derived from it.
  const goHome = () => {
    window.location.href = "/";
  };

  return (
    <AppHeader
      title="Solar Homes Calculator"
      byline={
        <>
          by The Global Solar Council&ensp;·&ensp;
          <span style={{ color: "#FBB114", fontStyle: "italic", fontWeight: 600 }}>Solar. Storage. Future Secured.</span>
        </>
      }
      mode={mode}
      setMode={setMode}
      onLogoClick={goHome}
    >
      <NavItem active={false} onClick={onStartTour}>
        <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
          Take the tour
        </Box>
        <Box component="span" sx={{ display: { xs: "inline", sm: "none" } }}>
          Tour
        </Box>
      </NavItem>

      <NavItem active={page === "help"} onClick={() => setPage(page === "help" ? "map" : "help")}>
        Help
      </NavItem>

      <AuthButton label="Login" mode={mode} />
    </AppHeader>
  );
}
