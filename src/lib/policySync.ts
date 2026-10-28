import { create } from "zustand";

import type { QuestionProposal, Suggestion } from "./suggestions";
import type { Question, Response, Section } from "./types";

/**
 * Saves editors' changes to the policy database (ROADMAP.md, Phase 4).
 *
 * The store's actions stay exactly as they were - local, immediate. This
 * watches the store instead: every action replaces only the objects it
 * changed, so comparing each section, question and answer by reference
 * against the previous state finds exactly what changed, whichever action
 * changed it (an admin-console edit, Edit mode, accepting a suggestion...).
 *
 * Each changed thing is saved whole - its current state, never a diff -
 * once it has been still for DEBOUNCE_MS, so typing a question's wording
 * sends one request, not one per key. Saves go one at a time, parents before
 * children (a new section before the question added to it) and children
 * before parents on deletes. Anything that no longer exists is deleted; a
 * removed answer is saved as cleared (score null), so it also hides the
 * researched answer underneath. Endpoints: klute/gate/ep_db/writes.py.
 *
 * Accept/reject decisions on public suggestions and question proposals
 * (Phase 6, ep_db/review.py) are saved the same way, but only when a
 * decision changes: those lists are loaded from the server (wrapped in
 * `withoutSaving`), and nothing else about them is the editor's to save. A
 * decision goes after any question it adds, so the server can link it.
 */

export interface SyncSnapshot {
  sections: Section[];
  questions: Question[];
  responses: Response[];
  threshold: number;
  suggestions: Suggestion[];
  questionProposals: QuestionProposal[];
}

export type SyncKey =
  | `section:${string}`
  | `question:${string}`
  | `response:${string}|${string}`
  | `suggestion:${string}`
  | `proposal:${string}`
  | "protocol";

export interface SyncRequest {
  method: "PUT" | "DELETE";
  url: string;
  body?: unknown;
}

export const DEBOUNCE_MS = 800;
const API = "/api/policy";

interface SyncState {
  /** Changes not yet confirmed by the server. */
  pending: number;
  /** The first failure, kept until reload - later saves may depend on it. */
  error: string | null;
}

export const useSyncStore = create<SyncState>(() => ({ pending: 0, error: null }));

const responseKey = (r: Pick<Response, "countryCode" | "questionId">) => `${r.countryCode}|${r.questionId}`;

function changedIds<T>(prev: T[], next: T[], id: (item: T) => string): string[] {
  const before = new Map(prev.map((item) => [id(item), item]));
  const after = new Map(next.map((item) => [id(item), item]));
  return [...new Set([...before.keys(), ...after.keys()])].filter((k) => before.get(k) !== after.get(k));
}

/** What changed between two store states, as keys to save. */
export function diffSnapshots(prev: SyncSnapshot, next: SyncSnapshot): SyncKey[] {
  const keys: SyncKey[] = [];
  if (prev.sections !== next.sections) {
    for (const id of changedIds(prev.sections, next.sections, (s) => s.id)) keys.push(`section:${id}`);
  }
  if (prev.questions !== next.questions) {
    for (const id of changedIds(prev.questions, next.questions, (q) => q.id)) keys.push(`question:${id}`);
  }
  if (prev.responses !== next.responses) {
    for (const k of changedIds(prev.responses, next.responses, responseKey)) keys.push(`response:${k}` as SyncKey);
  }
  if (prev.threshold !== next.threshold) keys.push("protocol");
  if (prev.suggestions !== next.suggestions) {
    for (const id of decided(prev.suggestions, next.suggestions, (s) => s.status)) keys.push(`suggestion:${id}`);
  }
  if (prev.questionProposals !== next.questionProposals) {
    for (const id of decided(prev.questionProposals, next.questionProposals, (p) => `${p.status}|${p.questionId ?? ""}`)) {
      keys.push(`proposal:${id}`);
    }
  }
  return keys;
}

/** Ids whose decision changed - not ones that appeared or went (those come from the server). */
function decided<T extends { id: string }>(prev: T[], next: T[], decision: (item: T) => string): string[] {
  const before = new Map(prev.map((item) => [item.id, item]));
  return next.filter((item) => before.has(item.id) && decision(before.get(item.id)!) !== decision(item)).map((item) => item.id);
}

let suppressed = 0;

/** Apply state that came from the server - nothing in it is saved back. */
export function withoutSaving(apply: () => void): void {
  suppressed++;
  try {
    apply();
  } finally {
    suppressed--;
  }
}

/** The request that brings the server in line with `state` for one key, and its place in the save order. */
export function requestFor(key: SyncKey, state: SyncSnapshot): { order: number; request: SyncRequest } {
  if (key === "protocol") {
    return { order: 2, request: { method: "PUT", url: `${API}/protocol`, body: { completenessThreshold: state.threshold } } };
  }
  const [kind, id] = [key.slice(0, key.indexOf(":")), key.slice(key.indexOf(":") + 1)];
  if (kind === "suggestion") {
    const s = state.suggestions.find((x) => x.id === id);
    return {
      order: 2,
      request: { method: "PUT", url: `${API}/suggestions/${encodeURIComponent(id)}/status`, body: { status: s?.status ?? "pending" } },
    };
  }
  if (kind === "proposal") {
    const p = state.questionProposals.find((x) => x.id === id);
    return {
      order: 2, // after the question an acceptance adds (1), before one a rejection deletes (3)
      request: {
        method: "PUT",
        url: `${API}/question-proposals/${encodeURIComponent(id)}/status`,
        body: { status: p?.status ?? "pending", questionId: p?.questionId ?? null },
      },
    };
  }
  if (kind === "section") {
    const s = state.sections.find((x) => x.id === id);
    const url = `${API}/sections/${encodeURIComponent(id)}`;
    return s
      ? { order: 0, request: { method: "PUT", url, body: { title: s.title, order: s.order } } }
      : { order: 4, request: { method: "DELETE", url } };
  }
  if (kind === "question") {
    const q = state.questions.find((x) => x.id === id);
    const url = `${API}/questions/${encodeURIComponent(id)}`;
    return q
      ? {
          order: 1,
          request: {
            method: "PUT",
            url,
            body: { sectionId: q.sectionId, subsection: q.subsection, order: q.order, text: q.text, title: q.title ?? null, weight: q.weight, rubric: q.rubric },
          },
        }
      : { order: 3, request: { method: "DELETE", url } };
  }
  const [countryCode, questionId] = id.split("|");
  const r = state.responses.find((x) => x.countryCode === countryCode && x.questionId === questionId);
  return {
    order: 2,
    request: {
      method: "PUT",
      url: `${API}/responses/${encodeURIComponent(countryCode)}/${encodeURIComponent(questionId)}`,
      body: r ? { score: r.score, basis: r.basis ?? null, evidence: r.evidence ?? [] } : { score: null, evidence: [] },
    },
  };
}

type Send = (request: SyncRequest) => Promise<void>;

/**
 * Start saving changes. `subscribe` is the store's own (listener gets the new
 * and previous state); `getState` reads the latest state at save time.
 * Returns a function that stops watching (pending saves still go out).
 */
export function startPolicySync(
  subscribe: (listener: (next: SyncSnapshot, prev: SyncSnapshot) => void) => () => void,
  getState: () => SyncSnapshot,
  send: Send,
  debounceMs = DEBOUNCE_MS,
): () => void {
  const due = new Map<SyncKey, number>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let flushing = false;

  const updatePending = () => useSyncStore.setState({ pending: due.size + (flushing ? 1 : 0) });

  const schedule = () => {
    if (timer || flushing || due.size === 0) return;
    const wait = Math.max(0, Math.min(...due.values()) - Date.now());
    timer = setTimeout(() => {
      timer = null;
      void flush();
    }, wait);
  };

  const flush = async () => {
    flushing = true;
    try {
      const now = Date.now();
      const ready = [...due.entries()].filter(([, at]) => at <= now).map(([key]) => key);
      for (const key of ready) due.delete(key);
      const state = getState();
      const requests = ready.map((key) => requestFor(key, state)).sort((a, b) => a.order - b.order);
      for (const { request } of requests) {
        try {
          await send(request);
        } catch (error) {
          if (!useSyncStore.getState().error) useSyncStore.setState({ error: String(error instanceof Error ? error.message : error) });
        }
      }
    } finally {
      flushing = false;
      updatePending();
      schedule();
    }
  };

  const unsubscribe = subscribe((next, prev) => {
    if (suppressed > 0) return;
    const keys = diffSnapshots(prev, next);
    if (keys.length === 0) return;
    const at = Date.now() + debounceMs;
    for (const key of keys) due.set(key, at);
    updatePending();
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    schedule();
  });

  return unsubscribe;
}

/** Sends one request with the editor's sign-in; throws with the server's reason on failure. */
export function sendWith(fetchAsEditor: (url: string, init: RequestInit) => Promise<globalThis.Response>): Send {
  return async ({ method, url, body }) => {
    const response = await fetchAsEditor(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) {
      const detail = await response
        .json()
        .then((b) => (typeof b.detail === "string" ? b.detail : JSON.stringify(b.detail ?? b)))
        .catch(() => `HTTP ${response.status}`);
      throw new Error(detail);
    }
  };
}
