import type { PaletteMode } from "@mui/material/styles";

import AppHeader from "./AppHeader";
import AuthButton from "./AuthButton";
import NavItem from "./NavItem";

interface Props {
  title: string;
  /** "by The Global Solar Council" - the text before the tagline. */
  bylineText: string;
  tagline: string;
  helpLabel: string;
  loginLabel: string;
  memberLabel: string;
  logInPromptTooltip: string;
  memberUnlockedTooltip: string;
  mode: PaletteMode;
  setMode: (mode: PaletteMode) => void;
  onOpenHelp: () => void;
  member: boolean;
  onOpenLogin: () => void;
  /** Tooltip text for the dark-mode toggle, keyed by the mode it would switch to (omit for none). */
  darkModeTooltip?: { toLight: string; toDark: string };
}

/**
 * The top bar of the Deployment Explorer and the Solar Homes Calculator, which were identical but for their words: the
 * logo (back to the Electric Futures Playbook page), the title and "by GSC - tagline" line, a Help link, and the Login
 * button that becomes an inert "Member" label once logged in. The words are passed in, so an app with translations
 * passes its translated strings and one without passes plain English. (The Policy Explorer's bar has more in it - the
 * admin console - so it keeps its own.)
 */
export default function MemberTopNavbar({
  title,
  bylineText,
  tagline,
  helpLabel,
  loginLabel,
  memberLabel,
  logInPromptTooltip,
  memberUnlockedTooltip,
  mode,
  setMode,
  onOpenHelp,
  member,
  onOpenLogin,
  darkModeTooltip,
}: Props) {
  // The logo leaves the app entirely, back to the Electric Futures Playbook page at the site root - a real page
  // navigation. BASE_URL rather than a literal "/" so it still resolves under a GitHub Pages subpath (a literal "/"
  // worked in dev but 404'd once deployed - found 2026-09-20).
  const goHome = () => {
    window.location.href = import.meta.env.BASE_URL;
  };

  return (
    <AppHeader
      title={title}
      byline={
        <>
          {bylineText}&ensp;·&ensp;
          <span style={{ color: "#FBB114", fontStyle: "italic", fontWeight: 600 }}>{tagline}</span>
        </>
      }
      mode={mode}
      setMode={setMode}
      onLogoClick={goHome}
      darkModeTooltip={darkModeTooltip}
    >
      <NavItem active={false} onClick={onOpenHelp}>
        {helpLabel}
      </NavItem>
      <AuthButton
        label={member ? memberLabel : loginLabel}
        mode={mode}
        tooltip={member ? memberUnlockedTooltip : logInPromptTooltip}
        onClick={member ? undefined : onOpenLogin}
      />
    </AppHeader>
  );
}
