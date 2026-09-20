import type { PaletteMode } from "@mui/material/styles";
import { useTranslation } from "react-i18next";

import AppHeader from "../../../shared/components/AppHeader";
import AuthButton from "../../../shared/components/AuthButton";
import NavItem from "../../../shared/components/NavItem";

interface Props {
  mode: PaletteMode;
  setMode: (mode: PaletteMode) => void;
  onOpenHelp: () => void;
}

/**
 * Ported onto the shared `AppHeader`/`NavItem` (`shared/components/`)
 * 2026-09-19 - the identity block (logo/title/subtitle) and dark-mode
 * toggle are now the shared component. Tour and Help merged into one
 * button 2026-09-20 ("combine the tour and help... Click help, get the
 * welcome to screen and then have a new button which is 'read
 * documentation'") - clicking it opens the tour's own hero scene
 * (`onOpenHelp` is just `openTour` from `useTourState`), which now has a
 * "Read documentation" button of its own (`shared/tour/TourOverlay.tsx`'s
 * `onReadDocs`) for a visitor who wants the written docs instead of the
 * guided walkthrough.
 */
export default function TopNavbar({ mode, setMode, onOpenHelp }: Props) {
  const { t } = useTranslation();
  // Same as ep_policymap's own TopNavbar.tsx: the logo leaves this app
  // entirely, back to the Electric Futures Playbook splash at the site
  // root - a real page navigation (this app's own React routing doesn't
  // cover that page, it's a separate static file). BASE_URL rather than a
  // hardcoded "/" so it still resolves under a GitHub Pages subpath.
  const goHome = () => {
    window.location.href = import.meta.env.BASE_URL;
  };

  return (
    <AppHeader
      title={t("appName")}
      byline={
        <>
          {t("byGsc")}&ensp;·&ensp;
          <span style={{ color: "#FBB114", fontStyle: "italic", fontWeight: 600 }}>{t("tagline")}</span>
        </>
      }
      mode={mode}
      setMode={setMode}
      onLogoClick={goHome}
      darkModeTooltip={{ toLight: t("theme.switchToLight"), toDark: t("theme.switchToDark") }}
    >
      <NavItem active={false} onClick={onOpenHelp}>
        {t("nav.help")}
      </NavItem>

      {/* Same filled-button treatment as Policy Explorer's "Admin
          console" (ep_policymap/src/components/layout/TopNavbar.tsx) -
          added 2026-09-11 per Andrew's instruction. No sign-in exists
          yet, same "stands in for auth" state that button started in, so
          this one is a placeholder too - "Coming soon" on hover rather
          than a dead click. Ported onto the shared `AuthButton` 2026-09-19. */}
      <AuthButton label={t("nav.login")} mode={mode} tooltip={t("nav.comingSoon")} />
    </AppHeader>
  );
}
