import { create } from "zustand";
import type { Auth } from "firebase/auth";

import { usingDatabase } from "../data/policyData";

/**
 * Who is editing the policy data (ROADMAP.md, Phase 2; decision 2).
 *
 * Only builds that read the policy database (VITE_POLICY_API - dev, see
 * deploy.yml) have editors at all: there, the admin console needs a Google
 * sign-in (Firebase Auth) whose email the server accepts (`/api/policy/me`,
 * klute/gate/ep_db/auth.py). Other builds keep the old open, browser-only
 * admin console until they move to the database too.
 *
 * Firebase is loaded on demand - when someone asks to sign in, or on load if
 * this browser signed in before - so ordinary visitors never download it.
 * Its web config comes from `/api/policy/auth-config`, the same project the
 * /klute gate signs in with.
 */
export const EDITING_NEEDS_SIGN_IN = Boolean(import.meta.env.VITE_POLICY_API);

export type EditorStatus =
  /** This build has no sign-in (see EDITING_NEEDS_SIGN_IN). */
  | "not-required"
  | "signed-out"
  | "checking"
  | "editor"
  /** Signed in, but the server doesn't list this email as an editor. */
  | "not-editor"
  | "error";

interface EditorState {
  status: EditorStatus;
  email: string | null;
  /** Shown to the person when status is not-editor or error. */
  message: string | null;
}

export const useEditorStore = create<EditorState>(() => ({
  status: EDITING_NEEDS_SIGN_IN ? "signed-out" : "not-required",
  email: null,
  message: null,
}));

/**
 * True when this person may use the admin console (and, on database builds,
 * Edit mode). An editor's sign-in isn't enough on its own: if this page fell
 * back to its bundled JSON, saving would write that stale copy over the
 * database, so editing waits for a reload that reaches it.
 */
export function canEdit(state: Pick<EditorState, "status"> = useEditorStore.getState()): boolean {
  return state.status === "not-required" || (state.status === "editor" && usingDatabase());
}

/** Edits save to the policy database (rather than staying in this browser). */
export function editsSaveToDatabase(state: Pick<EditorState, "status"> = useEditorStore.getState()): boolean {
  return state.status === "editor" && usingDatabase();
}

// Remembers (per browser) that someone signed in here, so the next visit
// restores the session without loading Firebase for everyone else.
const SIGNED_IN_KEY = "ep-policy-editor-signed-in";

function rememberSignedIn(on: boolean) {
  try {
    if (on) localStorage.setItem(SIGNED_IN_KEY, "1");
    else localStorage.removeItem(SIGNED_IN_KEY);
  } catch {
    // Storage blocked - the session just won't be restored on the next visit.
  }
}

function wasSignedIn(): boolean {
  try {
    return localStorage.getItem(SIGNED_IN_KEY) === "1";
  } catch {
    return false;
  }
}

let authPromise: Promise<Auth> | null = null;

/** Firebase Auth, initialised once from the server's config, with the session listener attached. */
function getAuthInstance(): Promise<Auth> {
  authPromise ??= (async () => {
    const response = await fetch("/api/policy/auth-config");
    if (!response.ok) throw new Error(`sign-in isn't configured (HTTP ${response.status})`);
    const config = await response.json();
    const [{ initializeApp }, { getAuth, onAuthStateChanged }] = await Promise.all([
      import("firebase/app"),
      import("firebase/auth"),
    ]);
    const auth = getAuth(initializeApp(config, "policy-editor"));
    onAuthStateChanged(auth, (user) => {
      if (user) void checkEditor();
      else {
        rememberSignedIn(false);
        useEditorStore.setState({ status: "signed-out", email: null, message: null });
      }
    });
    return auth;
  })();
  authPromise.catch(() => {
    authPromise = null; // let a later attempt retry
  });
  return authPromise;
}

/** Fetch with this editor's Firebase ID token attached. Throws when nobody is signed in. */
export async function editorFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const user = (await getAuthInstance()).currentUser;
  if (!user) throw new Error("not signed in");
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${await user.getIdToken()}`);
  return fetch(url, { ...init, headers });
}

async function checkEditor() {
  useEditorStore.setState({ status: "checking", message: null });
  try {
    const response = await editorFetch("/api/policy/me");
    const body = await response.json().catch(() => ({}));
    if (response.ok) {
      rememberSignedIn(true);
      useEditorStore.setState({ status: "editor", email: body.email, message: null });
    } else if (response.status === 403) {
      useEditorStore.setState({ status: "not-editor", email: null, message: body.detail ?? null });
    } else {
      useEditorStore.setState({ status: "error", email: null, message: body.detail ?? `HTTP ${response.status}` });
    }
  } catch (error) {
    useEditorStore.setState({ status: "error", email: null, message: String(error) });
  }
}

/** Opens Google's sign-in popup. The outcome arrives through useEditorStore. */
export async function signInEditor(): Promise<void> {
  useEditorStore.setState({ status: "checking", message: null });
  try {
    const auth = await getAuthInstance();
    const { GoogleAuthProvider, signInWithPopup } = await import("firebase/auth");
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (error) {
    const code = (error as { code?: string }).code;
    const closed = code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request";
    useEditorStore.setState({ status: closed ? "signed-out" : "error", message: closed ? null : String(error) });
  }
}

export async function signOutEditor(): Promise<void> {
  rememberSignedIn(false);
  const { signOut } = await import("firebase/auth");
  await signOut(await getAuthInstance());
}

/** On load: quietly restore a session this browser had before. */
export function restoreEditorSession(): void {
  if (EDITING_NEEDS_SIGN_IN && wasSignedIn()) {
    useEditorStore.setState({ status: "checking" });
    getAuthInstance().catch((error) => useEditorStore.setState({ status: "error", message: String(error) }));
  }
}
