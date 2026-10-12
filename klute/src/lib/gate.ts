/**
 * The /klute password gate.
 *
 * This site is static (GitHub Pages): there is no server here to enforce anything, so this is
 * a deterrent, not security. The typed password is checked against a SHA-256 hash that is
 * baked into the bundle at build time (VITE_KLUTE_PASSWORD_HASH), which keeps the password
 * itself out of the repo and the page, but the explorer's own data files (policy answers,
 * Ember series, calculator tables) are ordinary bundle assets and are readable by anyone who
 * looks. The one thing the password does protect for real is the Future Grid Simulator panel:
 * the same password is sent to the simulator's backend, which checks it on every request.
 *
 * Fails closed: with no hash configured nobody gets in.
 */
const SESSION_KEY = "klute-password";

export function gateConfigured(): boolean {
  return Boolean(import.meta.env.VITE_KLUTE_PASSWORD_HASH);
}

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function tryUnlock(password: string): Promise<boolean> {
  const expected = (import.meta.env.VITE_KLUTE_PASSWORD_HASH ?? "").toLowerCase();
  if (!expected) return false;
  if ((await sha256Hex(password)) !== expected) return false;
  try {
    sessionStorage.setItem(SESSION_KEY, password);
  } catch {
    // private window etc.: the page still unlocks, it just asks again on reload
  }
  memoryPassword = password;
  return true;
}

let memoryPassword = "";

/** The password entered this session (sent to the simulator backend), or "". */
export function sessionPassword(): string {
  if (memoryPassword) return memoryPassword;
  try {
    return sessionStorage.getItem(SESSION_KEY) ?? "";
  } catch {
    return "";
  }
}

export function lock() {
  memoryPassword = "";
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

/** Re-checks a password saved by an earlier visit in this tab. */
export async function alreadyUnlocked(): Promise<boolean> {
  const saved = sessionPassword();
  return saved ? tryUnlock(saved) : false;
}
