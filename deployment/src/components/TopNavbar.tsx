import { Box } from "@mui/material";
import type { PaletteMode } from "@mui/material/styles";
import { useTranslation } from "react-i18next";

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
 * Ported onto the shared `AppHeader`/`NavItem` (`shared/components/`)
 * 2026-09-19 - the identity block (logo/title/subtitle) and dark-mode
 * toggle are now the shared component; everything below (Tour/Help nav
 * links, the lock/login placeholder button, i18n) stays exactly as it
 * was, composed as `AppHeader`'s own `children`. This is the first of the
 * three apps ported onto `shared/` - see the "shared UI" plan for the
 * others still pending (root app, calculator).
 */
export default function TopNavbar({ mode, setMode, page, setPage, onStartTour }: Props) {
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
      <NavItem active={false} onClick={onStartTour}>
        {/* Abbreviated below `sm`, same as Policy Explorer's own nav -
            "Take the tour" alone was part of the header's mobile overflow. */}
        <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
          {t("nav.takeTheTour")}
        </Box>
        <Box component="span" sx={{ display: { xs: "inline", sm: "none" } }}>
          {t("nav.takeTheTourShort")}
        </Box>
      </NavItem>

      <NavItem active={page === "help"} onClick={() => setPage(page === "help" ? "map" : "help")}>
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
