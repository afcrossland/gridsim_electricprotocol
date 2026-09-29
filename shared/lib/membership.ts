/**
 * A client-side-only "member" gate, matching this repo's own established
 * "stands in for auth" convention (see any of the three apps' own
 * AuthButton usage - there's no real backend, login, or password storage
 * anywhere in this repo yet). One shared password, one shared localStorage
 * flag - logging in on any of the three apps unlocks member-only content
 * on all of them, same cross-app pattern as `shared/lib/darkMode.ts`.
 * Added 2026-09-28 per Andrew's own instruction ("login click is a popup...
 * when 'password' entered we can see the member only parts").
 */
const MEMBER_KEY = "gsc-member";
const MEMBER_PASSWORD = "password";

export function isMember(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(MEMBER_KEY) === "1";
}

/** Checks the password and, on success, persists the member flag. Returns whether it succeeded. */
export function tryLogin(password: string): boolean {
  if (password !== MEMBER_PASSWORD) return false;
  localStorage.setItem(MEMBER_KEY, "1");
  return true;
}
