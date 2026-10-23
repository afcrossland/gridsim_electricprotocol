import type { PaletteMode } from "@mui/material/styles";
import { useTranslation } from "react-i18next";

import MemberTopNavbar from "../../../shared/components/MemberTopNavbar";

interface Props {
  mode: PaletteMode;
  setMode: (mode: PaletteMode) => void;
  onOpenHelp: () => void;
  member: boolean;
  onOpenLogin: () => void;
}

/**
 * Deployment Explorer's top bar: the shared member top bar (shared/components/MemberTopNavbar.tsx) with this app's
 * translated words. This app's own "Members only" charts (LockedMetricChart.tsx) stay locked regardless of `member`,
 * since they are a teaser for metrics with no real data source at all, not real content behind a paywall; logging in here
 * still contributes to the shared cross-app member flag other apps' own real gated content reads.
 */
export default function TopNavbar({ mode, setMode, onOpenHelp, member, onOpenLogin }: Props) {
  const { t } = useTranslation();
  return (
    <MemberTopNavbar
      title={t("appName")}
      bylineText={t("byGsc")}
      tagline={t("tagline")}
      helpLabel={t("nav.help")}
      loginLabel={t("nav.login")}
      memberLabel={t("nav.member")}
      logInPromptTooltip={t("nav.logInPrompt")}
      memberUnlockedTooltip={t("nav.memberUnlocked")}
      mode={mode}
      setMode={setMode}
      onOpenHelp={onOpenHelp}
      member={member}
      onOpenLogin={onOpenLogin}
      darkModeTooltip={{ toLight: t("theme.switchToLight"), toDark: t("theme.switchToDark") }}
    />
  );
}
