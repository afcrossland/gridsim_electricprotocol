import { create } from "zustand";
import { persist } from "zustand/middleware";

import seed from "../data/protocol.seed.json";
import { sourcedResponses } from "../data/sourcedAnswers";
import { resolveTargets } from "../lib/jurisdictions";
import {
  DEFAULT_SCOREBOARD_FILTERS,
  DEFAULT_SCOREBOARD_SORT,
  type ScoreboardFilters,
  type ScoreboardSort,
} from "../lib/scoreboardFilters";
import {
  WINDROSE,
  type CountryPanelTab,
  type EvidenceItem,
  type Protocol,
  type Question,
  type Response,
  type Section,
} from "../lib/types";

const protocol = seed as unknown as Protocol;

/**
 * Everything mutable lives here behind a small set of actions. There is no
 * backend yet - state persists to localStorage - but nothing above this layer
 * knows that, so swapping in Firestore later means reimplementing these
 * actions and leaving the components alone.
 */
interface ProtocolState {
  /**
   * Completeness a jurisdiction must reach to be ranked and coloured. Seeded
   * from the protocol but adjustable, because how much evidence is "enough"
   * is a judgement rather than a property of the data.
   */
  threshold: number;
  /** Which measure the choropleth paints: the score, or how much is answered. */
  mapMetric: "score" | "completeness";
  /** Which full-screen view is showing. Not persisted - always opens on the map. */
  page: "map" | "admin" | "help";
  /** False until the visitor dismisses the Charter welcome screen. */
  welcomeSeen: boolean;
  /** False until the visitor dismisses (or skips) the scroll-driven onboarding tour. */
  tourSeen: boolean;
  sections: Section[];
  questions: Question[];
  responses: Response[];
  selectedCountry: string | null;
  /** Whether the detail view is in side-by-side compare mode. Not persisted. */
  comparing: boolean;
  /** The second jurisdiction being compared against `selectedCountry`, or null if comparing hasn't picked one yet. Not persisted. */
  compareCountry: string | null;
  /**
   * Which tab the main (non-compare) CountryPanel shows. Lifted out of that
   * component's own state - same as `page`, a view preference, not
   * persisted - so the onboarding tour can drive it from outside, reusing
   * the controlled-prop mechanism CountryPanel already exposes for
   * CompareView.
   */
  countryPanelTab: CountryPanelTab;
  /** Scoreboard's continent/country/score filters. Not persisted - a view preference, reset on reload like `page`. */
  scoreboardFilters: ScoreboardFilters;
  /** How the Scoreboard list is ordered. Not persisted, same as scoreboardFilters. */
  scoreboardSort: ScoreboardSort;
  /**
   * Admin edits to a shipped question's text/weight/rubric, keyed by question
   * id and persisted standalone rather than the full `questions` array - see
   * the long comment on `partialize` below for why.
   */
  questionOverrides: Record<string, Partial<Question>>;
  /** Admin edits to a shipped section's title, same shape as questionOverrides. */
  sectionOverrides: Record<string, Partial<Section>>;
  /** Whole sections the admin added, not present in the shipped seed at all. */
  customSections: Section[];
  /** Whole questions the admin added, not present in the shipped seed at all. */
  customQuestions: Question[];
  /** Shipped section ids the admin deleted - filtered out of the live seed on every load. */
  removedSectionIds: string[];
  /** Shipped question ids the admin deleted - filtered out of the live seed on every load. */
  removedQuestionIds: string[];

  setThreshold: (threshold: number) => void;
  setMapMetric: (mapMetric: "score" | "completeness") => void;
  setPage: (page: "map" | "admin" | "help") => void;
  setWelcomeSeen: (seen: boolean) => void;
  setTourSeen: (seen: boolean) => void;
  selectCountry: (code: string | null) => void;
  setComparing: (comparing: boolean) => void;
  setCompareCountry: (code: string | null) => void;
  setCountryPanelTab: (tab: CountryPanelTab) => void;
  setScoreboardFilters: (patch: Partial<ScoreboardFilters>) => void;
  resetScoreboardFilters: () => void;
  setScoreboardSort: (sort: ScoreboardSort) => void;

  setResponse: (
    countryCode: string,
    questionId: string,
    patch: Partial<Pick<Response, "score">>,
  ) => void;
  deleteResponse: (countryCode: string, questionId: string) => void;
  /** Appends a blank evidence item - only meaningful once a response already exists (a score has been picked). */
  addEvidence: (countryCode: string, questionId: string) => void;
  updateEvidence: (
    countryCode: string,
    questionId: string,
    index: number,
    patch: Partial<EvidenceItem>,
  ) => void;
  removeEvidence: (countryCode: string, questionId: string, index: number) => void;

  // Admin console only
  updateSection: (id: string, patch: Partial<Section>) => void;
  addSection: (title: string) => string;
  /** Deletes a section and every question in it (and their responses). */
  deleteSection: (id: string) => void;
  updateQuestion: (id: string, patch: Partial<Question>) => void;
  /** Discards a question's persisted override, reverting it to the shipped seed version. */
  resetQuestion: (id: string) => void;
  addQuestion: (sectionId: string) => string;
  deleteQuestion: (id: string) => void;

  resetToSeed: () => void;
}

/**
 * A response persisted before evidence became a list carried a flat
 * `source`/`note` pair instead of `evidence: EvidenceItem[]` - folded into a
 * single evidence entry here (or an empty array if both were blank) rather
 * than discarded, since it is real citation text someone typed in. Already-
 * current-shape responses pass through unchanged.
 */
function migrateResponseShape(r: Response & { source?: string; note?: string }): Response {
  if (Array.isArray(r.evidence)) return r;
  const { source, note, ...rest } = r;
  const evidence: EvidenceItem[] =
    source || note ? [{ title: "", source: source ?? "", note: note ?? "" }] : [];
  return { ...rest, evidence };
}

/** Applies a sparse override map on top of a base list of records with an `id`. */
function withOverrides<T extends { id: string }>(
  items: T[],
  overrides: Record<string, Partial<T>>,
): T[] {
  return items.map((item) => (overrides[item.id] ? { ...item, ...overrides[item.id] } : item));
}

/**
 * The live section/question set: the shipped seed, minus anything admin-
 * deleted, plus anything admin-added, with admin overrides reapplied on top.
 * Used both to build the initial in-memory state and to rebuild it from a
 * persisted blob on every load, so the two never drift apart.
 */
function buildLiveData(persisted: {
  sectionOverrides?: Record<string, Partial<Section>>;
  questionOverrides?: Record<string, Partial<Question>>;
  customSections?: Section[];
  customQuestions?: Question[];
  removedSectionIds?: string[];
  removedQuestionIds?: string[];
}) {
  const sectionOverrides = persisted.sectionOverrides ?? {};
  const questionOverrides = persisted.questionOverrides ?? {};
  const customSections = persisted.customSections ?? [];
  const customQuestions = persisted.customQuestions ?? [];
  const removedSectionIds = persisted.removedSectionIds ?? [];
  const removedQuestionIds = persisted.removedQuestionIds ?? [];

  const sections = withOverrides(
    [
      ...protocol.sections.filter((s) => !removedSectionIds.includes(s.id)),
      ...customSections,
    ],
    sectionOverrides,
  );
  const questions = withOverrides(
    [
      ...protocol.questions.filter((q) => !removedQuestionIds.includes(q.id)),
      ...customQuestions,
    ],
    questionOverrides,
  );

  return { sections, questions };
}

/**
 * Spreadsheet answers plus researched answers, both as ordinary responses.
 *
 * The spreadsheet's GB and NZ answers carry no citation - they arrived as bare
 * scores - whereas everything in sourced-answers.json must cite something.
 */
function seedResponses(): Response[] {
  const out: Response[] = [];
  for (const q of protocol.questions) {
    for (const [countryCode, score] of Object.entries(q.seedAnswers ?? {})) {
      out.push({
        questionId: q.id,
        countryCode,
        score,
        evidence: [],
        updatedAt: new Date(0).toISOString(),
        seeded: true,
      });
    }
  }
  return [...out, ...sourcedResponses(protocol.questions)];
}

function initialState() {
  return {
    threshold: protocol.completenessThreshold,
    mapMetric: "score" as const,
    page: "map" as const,
    welcomeSeen: false,
    tourSeen: false,
    sections: protocol.sections.map((s) => ({ ...s })),
    questions: protocol.questions.map((q) => ({ ...q })),
    responses: seedResponses(),
    selectedCountry: null,
    comparing: false,
    compareCountry: null,
    countryPanelTab: WINDROSE as CountryPanelTab,
    scoreboardFilters: DEFAULT_SCOREBOARD_FILTERS,
    scoreboardSort: DEFAULT_SCOREBOARD_SORT,
    questionOverrides: {},
    sectionOverrides: {},
    customSections: [],
    customQuestions: [],
    removedSectionIds: [],
    removedQuestionIds: [],
  };
}

const DEFAULT_RUBRIC = [
  { score: 0, label: "Not in place", points: 0 },
  { score: 1, label: "Partly in place", points: 1 },
  { score: 2, label: "Fully in place", points: 4 },
];

export const useProtocolStore = create<ProtocolState>()(
  persist(
    (set, get) => ({
      ...initialState(),

      setThreshold: (threshold) => set({ threshold }),
      setMapMetric: (mapMetric) => set({ mapMetric }),
      setPage: (page) => set({ page }),
      setWelcomeSeen: (welcomeSeen) => set({ welcomeSeen }),
      setTourSeen: (tourSeen) => set({ tourSeen }),
      // Picking a jurisdiction - from the map, search, or the scoreboard -
      // always means "look at this one", which is not compatible with
      // whatever compare state was left over from a previous detail view.
      selectCountry: (code) =>
        set({ selectedCountry: code, comparing: false, compareCountry: null }),
      setComparing: (comparing) => set({ comparing }),
      setCompareCountry: (compareCountry) => set({ compareCountry }),
      setCountryPanelTab: (countryPanelTab) => set({ countryPanelTab }),
      setScoreboardFilters: (patch) =>
        set((state) => ({ scoreboardFilters: { ...state.scoreboardFilters, ...patch } })),
      resetScoreboardFilters: () => set({ scoreboardFilters: DEFAULT_SCOREBOARD_FILTERS }),
      setScoreboardSort: (scoreboardSort) => set({ scoreboardSort }),

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
                  evidence: [],
                  updatedAt: now,
                },
              ],
            };
          }

          const responses = state.responses.slice();
          responses[i] = { ...responses[i], ...patch, updatedAt: now, seeded: false };
          return { responses };
        }),

      // No-ops rather than creating a response from nothing - evidence only
      // makes sense once a score has actually been picked, the same way the
      // Evidence panel in QuestionCard only ever shows once `response` exists.
      addEvidence: (countryCode, questionId) =>
        set((state) => {
          const i = state.responses.findIndex(
            (r) => r.countryCode === countryCode && r.questionId === questionId,
          );
          if (i === -1) return state;
          const responses = state.responses.slice();
          responses[i] = {
            ...responses[i],
            evidence: [...responses[i].evidence, { title: "", source: "", note: "" }],
            updatedAt: new Date().toISOString(),
            seeded: false,
          };
          return { responses };
        }),

      updateEvidence: (countryCode, questionId, index, patch) =>
        set((state) => {
          const i = state.responses.findIndex(
            (r) => r.countryCode === countryCode && r.questionId === questionId,
          );
          if (i === -1 || !state.responses[i].evidence[index]) return state;
          const evidence = state.responses[i].evidence.slice();
          evidence[index] = { ...evidence[index], ...patch };
          const responses = state.responses.slice();
          responses[i] = {
            ...responses[i],
            evidence,
            updatedAt: new Date().toISOString(),
            seeded: false,
          };
          return { responses };
        }),

      removeEvidence: (countryCode, questionId, index) =>
        set((state) => {
          const i = state.responses.findIndex(
            (r) => r.countryCode === countryCode && r.questionId === questionId,
          );
          if (i === -1) return state;
          const responses = state.responses.slice();
          responses[i] = {
            ...responses[i],
            evidence: responses[i].evidence.filter((_, ei) => ei !== index),
            updatedAt: new Date().toISOString(),
            seeded: false,
          };
          return { responses };
        }),

      deleteResponse: (countryCode, questionId) =>
        set((state) => ({
          responses: state.responses.filter(
            (r) => !(r.countryCode === countryCode && r.questionId === questionId),
          ),
        })),

      updateSection: (id, patch) =>
        set((state) => {
          const isCustom = state.customSections.some((s) => s.id === id);
          return {
            sections: state.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)),
            customSections: isCustom
              ? state.customSections.map((s) => (s.id === id ? { ...s, ...patch } : s))
              : state.customSections,
            sectionOverrides: isCustom
              ? state.sectionOverrides
              : {
                  ...state.sectionOverrides,
                  [id]: { ...state.sectionOverrides[id], ...patch },
                },
          };
        }),

      addSection: (title) => {
        const id = `s-${Date.now().toString(36)}`;
        const order = Math.max(0, ...get().sections.map((s) => s.order)) + 1;
        const section: Section = { id, title, order };
        set((state) => ({
          sections: [...state.sections, section],
          customSections: [...state.customSections, section],
        }));
        return id;
      },

      // Cascades to every question in the section (and their responses), the
      // same way deleting a question cascades to its responses - an orphaned
      // question with no section would be unreachable from the rail forever.
      deleteSection: (id) =>
        set((state) => {
          const questionIdsInSection = new Set(
            state.questions.filter((q) => q.sectionId === id).map((q) => q.id),
          );
          const isCustom = state.customSections.some((s) => s.id === id);

          const questionOverrides = { ...state.questionOverrides };
          for (const qid of questionIdsInSection) delete questionOverrides[qid];

          const sectionOverrides = { ...state.sectionOverrides };
          delete sectionOverrides[id];

          return {
            sections: state.sections.filter((s) => s.id !== id),
            customSections: state.customSections.filter((s) => s.id !== id),
            removedSectionIds: isCustom
              ? state.removedSectionIds
              : [...state.removedSectionIds, id],
            questions: state.questions.filter((q) => q.sectionId !== id),
            customQuestions: state.customQuestions.filter((q) => q.sectionId !== id),
            removedQuestionIds: [
              ...state.removedQuestionIds,
              ...[...questionIdsInSection].filter(
                (qid) => !state.customQuestions.some((q) => q.id === qid),
              ),
            ],
            responses: state.responses.filter((r) => !questionIdsInSection.has(r.questionId)),
            questionOverrides,
            sectionOverrides,
          };
        }),

      updateQuestion: (id, patch) =>
        set((state) => {
          const isCustom = state.customQuestions.some((q) => q.id === id);
          return {
            questions: state.questions.map((q) => (q.id === id ? { ...q, ...patch } : q)),
            customQuestions: isCustom
              ? state.customQuestions.map((q) => (q.id === id ? { ...q, ...patch } : q))
              : state.customQuestions,
            questionOverrides: isCustom
              ? state.questionOverrides
              : {
                  ...state.questionOverrides,
                  [id]: { ...state.questionOverrides[id], ...patch },
                },
          };
        }),

      // Only meaningful for a shipped question - a custom one has no seed
      // version to revert to, so this is a no-op for those.
      resetQuestion: (id) =>
        set((state) => {
          const overrides = { ...state.questionOverrides };
          delete overrides[id];
          const seedQuestion = protocol.questions.find((q) => q.id === id);
          return {
            questionOverrides: overrides,
            questions: state.questions.map((q) =>
              q.id === id && seedQuestion ? { ...seedQuestion } : q,
            ),
          };
        }),

      addQuestion: (sectionId) => {
        const id = `q-${Date.now().toString(36)}`;
        const order = Math.max(0, ...get().questions.map((q) => q.order)) + 1;
        const question: Question = {
          id,
          sectionId,
          subsection: null,
          order,
          text: "New question",
          weight: 1,
          rubric: DEFAULT_RUBRIC.map((t) => ({ ...t })),
        };
        set((state) => ({
          questions: [...state.questions, question],
          customQuestions: [...state.customQuestions, question],
        }));
        return id;
      },

      // Responses to a deleted question go with it, otherwise they linger as
      // orphans that still count toward nothing but can never be edited.
      deleteQuestion: (id) =>
        set((state) => {
          const isCustom = state.customQuestions.some((q) => q.id === id);
          const questionOverrides = { ...state.questionOverrides };
          delete questionOverrides[id];
          return {
            questions: state.questions.filter((q) => q.id !== id),
            customQuestions: state.customQuestions.filter((q) => q.id !== id),
            removedQuestionIds: isCustom
              ? state.removedQuestionIds
              : [...state.removedQuestionIds, id],
            responses: state.responses.filter((r) => r.questionId !== id),
            questionOverrides,
          };
        }),

      resetToSeed: () => set(initialState()),
    }),
    {
      name: "electric-protocol-policy-map",
      // Bump only for a change in the *shape* of stored state. Adding or
      // editing seed data needs no bump, because seeded answers are never
      // persisted - see partialize below.
      //
      // v5: section ids changed when the redundant "Electric Protocol" prefix
      // was stripped from headings, so persisted questions pointed at sections
      // that no longer existed.
      // v6: default completeness threshold moved from 40% to 30%, which a
      // persisted preference would otherwise mask.
      //
      // v7: `sections` and `questions` are no longer persisted at all (see
      // partialize below) - a browser that had cached them before a text fix
      // shipped (the CER/CP acronym cleanup, in this case) would silently keep
      // showing the old wording forever, because `merge` spread the stale
      // persisted copy over the freshly-loaded, fixed one. Bumping the version
      // clears any copy written by the old, buggy partialize.
      //
      // v8: admin edits to a shipped question persist again, but as
      // `questionOverrides` - a sparse patch keyed by question id, not the
      // full `questions` array. A field an admin never touched still comes
      // from the live seed on every load, so unrelated fixes (new questions,
      // rewording elsewhere) are not masked - only the specific fields a
      // specific question was overridden on are. The v7 fix's actual point
      // (don't let a whole-array cache shadow the seed) still holds; only the
      // granularity changed.
      //
      // v9: sections and questions can now be added or deleted outright, not
      // just edited - `customSections`/`customQuestions` (whole records with
      // no seed counterpart) and `removedSectionIds`/`removedQuestionIds`
      // (shipped ids to filter out) persist alongside the overrides, all
      // reapplied to the live seed on every load by buildLiveData().
      //
      // v10: a response's evidence is now a list (`evidence: EvidenceItem[]`,
      // each with its own title/source/note), not one flat `source`/`note`
      // pair - a score can rest on more than one citation. migrate() folds
      // any pre-v10 response's source/note into a single evidence entry
      // rather than dropping it.
      //
      // `tourSeen` (added after v10, no bump) is a bare additive boolean -
      // an existing visitor's persisted blob simply lacks the key, `merge`
      // leaves `initialState()`'s `false` default in place for them, and the
      // onboarding tour plays once for everyone who hasn't dismissed it
      // rather than being silently skipped for pre-existing visitors.
      version: 10,

      /**
       * Keep the user's answers and every admin edit (overrides, additions,
       * deletions); everything else comes fresh from `initialState()`.
       */
      migrate: (persisted) => {
        const state = persisted as Partial<ProtocolState> | undefined;
        const { sections, questions } = buildLiveData(state ?? {});
        return {
          ...initialState(),
          threshold: protocol.completenessThreshold,
          responses: (state?.responses ?? []).filter((r) => !r.seeded).map(migrateResponseShape),
          questionOverrides: state?.questionOverrides ?? {},
          sectionOverrides: state?.sectionOverrides ?? {},
          customSections: state?.customSections ?? [],
          customQuestions: state?.customQuestions ?? [],
          removedSectionIds: state?.removedSectionIds ?? [],
          removedQuestionIds: state?.removedQuestionIds ?? [],
          sections,
          questions,
        } as ProtocolState;
      },

      /**
       * Persist only what a person actually did: their preferences, answers
       * they typed, and admin edits to the question set. Nothing derived
       * wholesale from the seed files.
       *
       * The shipped `sections`/`questions` arrays are deliberately excluded -
       * they come from `protocol.seed.json`, and persisting the full arrays
       * means a cached copy shadows every later fix to that data, exactly the
       * bug that let stale CER/CP wording and pre-cleanup question text keep
       * showing up after both had been fixed at the source. The sparse
       * override/addition/removal fields below avoid that: each only shadows
       * the specific thing an admin actually touched, so an unrelated
       * question added or reworded later in the seed still comes through
       * untouched. The same reasoning applies to `responses`: seeded answers
       * are derived from `protocol.seed.json` and `sourced-answers.json`, so
       * a persisted copy shadows every later data update - that's how
       * Australia went blank when answers moved to per-state codes, and how
       * newly researched countries failed to appear. Deriving them fresh on
       * every load removes that failure mode rather than relying on
       * remembering to bump the version every time the data changes.
       */
      partialize: (state) => ({
        threshold: state.threshold,
        mapMetric: state.mapMetric,
        welcomeSeen: state.welcomeSeen,
        tourSeen: state.tourSeen,
        responses: state.responses.filter((r) => !r.seeded),
        questionOverrides: state.questionOverrides,
        sectionOverrides: state.sectionOverrides,
        customSections: state.customSections,
        customQuestions: state.customQuestions,
        removedSectionIds: state.removedSectionIds,
        removedQuestionIds: state.removedQuestionIds,
      }),

      /**
       * Rebuild the full response list on every load - current seed data,
       * plus the user's own answers with their jurisdiction codes
       * re-resolved (a response recorded against a country that has since
       * been subdivided would otherwise be stranded on a code the map no
       * longer draws) - then rebuild sections/questions from the fresh seed
       * with every persisted admin edit reapplied on top.
       */
      merge: (persisted, current) => {
        const state = persisted as Partial<ProtocolState> | undefined;
        if (!state) return current;

        const userEntered = (state.responses ?? [])
          .filter((r) => !r.seeded)
          .flatMap((r) =>
            resolveTargets(r.countryCode).map((code) => ({ ...r, countryCode: code })),
          );
        const { sections, questions } = buildLiveData(state);

        return {
          ...current,
          ...state,
          sections,
          questions,
          responses: [...seedResponses(), ...userEntered],
        };
      },
    },
  ),
);

export { protocol };
