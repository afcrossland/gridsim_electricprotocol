import { create } from "zustand";
import { persist } from "zustand/middleware";

import seed from "../data/protocol.seed.json";
import { sourcedResponses } from "../data/sourcedAnswers";
import { resolveTargets } from "../lib/jurisdictions";
import type { Protocol, Question, Response, Role, Section } from "../lib/types";

const protocol = seed as unknown as Protocol;

/**
 * Everything mutable lives here behind a small set of actions. There is no
 * backend yet — state persists to localStorage — but nothing above this layer
 * knows that, so swapping in Firestore later means reimplementing these
 * actions and leaving the components alone.
 */
interface ProtocolState {
  role: Role;
  sections: Section[];
  questions: Question[];
  responses: Response[];
  selectedCountry: string | null;

  setRole: (role: Role) => void;
  selectCountry: (code: string | null) => void;

  // Registered users and admins
  setResponse: (
    countryCode: string,
    questionId: string,
    patch: Partial<Pick<Response, "score" | "source" | "note">>,
  ) => void;

  // Admin only
  deleteResponse: (countryCode: string, questionId: string) => void;
  updateQuestion: (id: string, patch: Partial<Question>) => void;
  addQuestion: (sectionId: string) => string;
  deleteQuestion: (id: string) => void;

  resetToSeed: () => void;
}

/**
 * Spreadsheet answers plus researched answers, both as ordinary responses.
 *
 * The spreadsheet's GB and NZ answers carry no citation — they arrived as bare
 * scores — whereas everything in sourced-answers.json must cite something.
 */
function seedResponses(): Response[] {
  const out: Response[] = [];
  for (const q of protocol.questions) {
    for (const [countryCode, score] of Object.entries(q.seedAnswers ?? {})) {
      out.push({
        questionId: q.id,
        countryCode,
        score,
        source: "",
        note: "",
        updatedAt: new Date(0).toISOString(),
        seeded: true,
      });
    }
  }
  return [...out, ...sourcedResponses(protocol.questions)];
}

function initialState() {
  return {
    role: "registered" as Role,
    sections: protocol.sections.map((s) => ({ ...s })),
    questions: protocol.questions.map((q) => ({ ...q })),
    responses: seedResponses(),
    selectedCountry: null,
  };
}

export const useProtocolStore = create<ProtocolState>()(
  persist(
    (set, get) => ({
      ...initialState(),

      setRole: (role) => set({ role }),
      selectCountry: (code) => set({ selectedCountry: code }),

      setResponse: (countryCode, questionId, patch) =>
        set((state) => {
          const i = state.responses.findIndex(
            (r) => r.countryCode === countryCode && r.questionId === questionId,
          );
          const now = new Date().toISOString();

          if (i === -1) {
            if (patch.score === undefined) return state; // nothing to create from
            return {
              responses: [
                ...state.responses,
                {
                  questionId,
                  countryCode,
                  score: patch.score,
                  source: patch.source ?? "",
                  note: patch.note ?? "",
                  updatedAt: now,
                },
              ],
            };
          }

          const responses = state.responses.slice();
          responses[i] = { ...responses[i], ...patch, updatedAt: now, seeded: false };
          return { responses };
        }),

      deleteResponse: (countryCode, questionId) =>
        set((state) => ({
          responses: state.responses.filter(
            (r) => !(r.countryCode === countryCode && r.questionId === questionId),
          ),
        })),

      updateQuestion: (id, patch) =>
        set((state) => ({
          questions: state.questions.map((q) => (q.id === id ? { ...q, ...patch } : q)),
        })),

      addQuestion: (sectionId) => {
        const id = `q-${Date.now().toString(36)}`;
        const order = Math.max(0, ...get().questions.map((q) => q.order)) + 1;
        set((state) => ({
          questions: [
            ...state.questions,
            {
              id,
              sectionId,
              subsection: null,
              order,
              text: "New question",
              weight: 1,
              rubric: [
                { score: 0, label: "Not in place" },
                { score: 1, label: "Partly in place" },
                { score: 2, label: "Fully in place" },
              ],
            },
          ],
        }));
        return id;
      },

      // Responses to a deleted question go with it, otherwise they linger as
      // orphans that still count toward nothing but can never be edited.
      deleteQuestion: (id) =>
        set((state) => ({
          questions: state.questions.filter((q) => q.id !== id),
          responses: state.responses.filter((r) => r.questionId !== id),
        })),

      resetToSeed: () => set(initialState()),
    }),
    {
      name: "electric-protocol-policy-map",
      // Bump only for a change in the *shape* of stored state. Adding or
      // editing seed data needs no bump, because seeded answers are never
      // persisted — see partialize below.
      //
      // v5: section ids changed when the redundant "Electric Protocol" prefix
      // was stripped from headings, so persisted questions pointed at sections
      // that no longer existed.
      version: 5,

      /**
       * Take the current seed's sections and questions, keeping only the
       * responses a user typed. Admin edits to question text or weights are
       * lost on a structural change, which is the right trade while the
       * question set itself is still moving.
       */
      migrate: (persisted) => {
        const state = persisted as Partial<ProtocolState> | undefined;
        return {
          ...initialState(),
          role: state?.role ?? "registered",
          responses: (state?.responses ?? []).filter((r) => !r.seeded),
        } as ProtocolState;
      },

      /**
       * Persist only what a person actually did: their role, any admin edits to
       * the questions, and answers they typed.
       *
       * Seeded answers are derived from `protocol.seed.json` and
       * `sourced-answers.json`, so writing them to localStorage means a cached
       * copy shadows every later data update. That is how Australia went blank
       * when answers moved to per-state codes, and how newly researched US and
       * South Asian answers failed to appear. Deriving them fresh on every load
       * removes the failure mode rather than relying on remembering to bump the
       * version each time the data changes.
       */
      partialize: (state) => ({
        role: state.role,
        sections: state.sections,
        questions: state.questions,
        responses: state.responses.filter((r) => !r.seeded),
      }),

      /**
       * Rebuild the full response list on load: current seed data, plus the
       * user's own answers with their jurisdiction codes re-resolved. A response
       * recorded against a country that has since been subdivided would
       * otherwise be stranded on a code the map no longer draws.
       */
      merge: (persisted, current) => {
        const state = persisted as Partial<ProtocolState> | undefined;
        if (!state) return current;

        const userEntered = (state.responses ?? [])
          .filter((r) => !r.seeded)
          .flatMap((r) =>
            resolveTargets(r.countryCode).map((code) => ({ ...r, countryCode: code })),
          );

        return {
          ...current,
          ...state,
          responses: [...seedResponses(), ...userEntered],
        };
      },
    },
  ),
);

export { protocol };
