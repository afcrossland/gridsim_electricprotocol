import type { PaletteMode } from "@mui/material/styles";

import AppHeader from "../../../shared/components/AppHeader";
import AuthButton from "../../../shared/components/AuthButton";
import NavItem from "../../../shared/components/NavItem";

interface Props {
  mode: PaletteMode;
  setMode: (mode: PaletteMode) => void;
  onOpenHelp: () => void;
  member: boolean;
  onOpenLogin: () => void;
}

/**
 * Ported onto the shared `AppHeader` (`shared/components/`) 2026-09-19 -
 * the identity block (logo/title/subtitle) and dark-mode toggle are now
 * the shared component. Gained a Help/Login nav link the same day, per
 * Andrew's own instruction ("give calculator the same buttons too") - this
 * app had none before. Tour and Help merged into this one button 2026-09-20
 * ("combine the tour and help... Click help, get the welcome to screen and
 * then have a new button which is 'read documentation'") - clicking it
 * opens the tour's own hero scene (`onOpenHelp` is just `openTour` from
 * `useTourState`), which now has a "Read documentation" button of its own
 * (`shared/tour/TourOverlay.tsx`'s `onReadDocs`) for a visitor who wants
 * the written docs instead of the guided walkthrough.
 *
 * "Login" opens the shared password popup (`onOpenLogin`, `App.tsx`'s own
 * `LoginModal`) 2026-09-28 - once `member` is true it becomes an inert
 * "Member" label instead (see `AuthButton`'s own `onClick` doc comment for
 * why `undefined` rather than a no-op function).
 */
export default function TopNavbar({ mode, setMode, onOpenHelp, member, onOpenLogin }: Props) {
  // Same as the sibling apps' own TopNavbar.tsx: `base` in vite.config.ts is
  // one setting shared by all four HTML entries (the site root splash page
  // and the three app subpaths), so `BASE_URL` always resolves to the site
  // root regardless of which app reads it - "/" in dev, the GitHub Pages
  // repo-name prefix in production. A literal "/" here worked in dev but
  // 404'd once deployed - found 2026-09-20 after this app synced to git.
  const goHome = () => {
    window.location.href = import.meta.env.BASE_URL;
  };

  return (
    <AppHeader
      title="Homes Calculator"
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
      <NavItem active={false} onClick={onOpenHelp}>
        Help
      </NavItem>

      <AuthButton
        label={member ? "Member" : "Login"}
        mode={mode}
        tooltip={member ? "Member content unlocked" : "Log in with the member password"}
        onClick={member ? undefined : onOpenLogin}
      />
    </AppHeader>
  );
}
