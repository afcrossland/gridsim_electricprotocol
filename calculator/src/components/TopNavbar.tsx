import type { PaletteMode } from "@mui/material/styles";

import MemberTopNavbar from "../../../shared/components/MemberTopNavbar";

interface Props {
  mode: PaletteMode;
  setMode: (mode: PaletteMode) => void;
  onOpenHelp: () => void;
  member: boolean;
  onOpenLogin: () => void;
}

/**
 * The Solar Homes Calculator's top bar: the shared member top bar (shared/components/MemberTopNavbar.tsx) in plain
 * English, since this app has no translations. "Login" opens the shared password popup; once `member` is true it becomes
 * an inert "Member" label.
 */
export default function TopNavbar({ mode, setMode, onOpenHelp, member, onOpenLogin }: Props) {
  return (
    <MemberTopNavbar
      title="Homes Calculator"
      bylineText="by The Global Solar Council"
      tagline="Solar. Storage. Future Secured."
      helpLabel="Help"
      loginLabel="Login"
      memberLabel="Member"
      logInPromptTooltip="Log in with the member password"
      memberUnlockedTooltip="Member content unlocked"
      mode={mode}
      setMode={setMode}
      onOpenHelp={onOpenHelp}
      member={member}
      onOpenLogin={onOpenLogin}
    />
  );
}
