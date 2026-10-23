import { useState } from "react";

import { isMember } from "./membership";

/**
 * The shared member flag plus the login popup's open state, for the Login button and `LoginModal`. `member` seeds from
 * the cross-app localStorage flag, so logging in on one app already unlocks the others on their next load. This is a
 * client-side gate, not real authentication (see membership.ts).
 */
export function useMembership() {
  const [member, setMember] = useState(isMember);
  const [loginOpen, setLoginOpen] = useState(false);
  return {
    member,
    loginOpen,
    openLogin: () => setLoginOpen(true),
    closeLogin: () => setLoginOpen(false),
    onLoginSuccess: () => setMember(true),
  };
}
