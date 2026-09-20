/**
 * One localStorage key shared by all three apps, so choosing dark mode in
 * any one of them (policy, deployment, calculator - each its own separate
 * page load, not a single SPA) carries over to the others too, rather than
 * each app remembering its own independent preference. Added 2026-09-20
 * per Andrew's own instruction ("dark mode should persist across the
 * app... when selected in one section apply to all").
 */
export const DARK_MODE_KEY = "gsc-dark-mode";

export function getStoredMode(): "light" | "dark" | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(DARK_MODE_KEY);
  return v === "light" || v === "dark" ? v : null;
}

export function setStoredMode(mode: "light" | "dark"): void {
  localStorage.setItem(DARK_MODE_KEY, mode);
}
