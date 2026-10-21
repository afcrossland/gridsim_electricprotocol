import { create } from "zustand";
import { persist } from "zustand/middleware";

import { readPolicyData, usingDatabase } from "../data/policyData";
import { sourcedResponses } from "../data/sourcedAnswers";
import i18n, { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from "../i18n";
import { MAX_COMPARE_COUNTRIES } from "../lib/compareColors";
import { resolveTargets } from "../lib/jurisdictions";
import { DEFAULT_SCOREBOARD_FILTERS, type ScoreboardFilters } from "../lib/scoreboardFilters";
import { diffResponses, type QuestionProposal, type Suggestion } from "../lib/suggestions";
import { getStoredMode, setStoredMode } from "../../shared/lib/darkMode";
import { type EvidenceItem, type Protocol, type Question, type Response, type Section } from "../lib/types";

const protocol = readPolicyData().protocol as unknown as Protocol;

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
  /** Light/dark theme preference - persisted so it survives reload, same treatment as any other user-chosen setting. */
  mode: "light" | "dark";
  /** UI language - persisted the same way as `mode`. Actually switching i18next's active language is a side effect handled where this is set (see setLanguage and main.tsx), not something the store does itself. */
  language: string;
  sections: Section[];
  questions: Question[];
  responses: Response[];
  selectedCountry: string | null;
  /** Whether the detail view is in side-by-side compare mode (the legacy full-screen CompareView, kept but not wired into the UI). Not persisted. */
  comparing: boolean;
  /**
   * Jurisdictions being compared against `selectedCountry` on its windrose
   * and rubric tiles, in the order picked - that order is also colour
   * assignment order (see compareColorFor in lib/compareColors.ts), so
   * removing one from the middle does not reshuffle everyone else's colour.
   * Capped at MAX_COMPARE_COUNTRIES. Not persisted.
   */
  compareCountries: string[];
  /** Scoreboard's continent/country/score filters. Not persisted - a view preference, reset on reload like `page`. */
  scoreboardFilters: ScoreboardFilters;
  /**
   * Which way the Scoreboard list is ordered - what it's ordered *by* is not
   * a separate setting any more (removed 2026-09-09): the list always sorts
   * by whatever `mapMetric` the map/legend toggle is currently showing, so
   * the two never disagree. Not persisted, same as scoreboardFilters.
   */
  scoreboardSortDirection: "asc" | "desc";
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
  /** Every suggested change submitted so far, pending/accepted/rejected - persisted, same reasoning as responses: something a person actually did. */
  suggestions: Suggestion[];
  questionProposals: QuestionProposal[];
  /**
   * A country's responses exactly as they were the first time its page was
   * opened this session - session-only, not persisted (same treatment as
   * `page`/`selectedCountry`). Purely diffing scaffolding for "Submit
   * revised evidence": what a suggestion's summary and reject-to-revert
   * baseline are computed against. Losing it on reload (someone leaves and
   * comes back) just means their next edit starts a fresh diff, which is an
   * acceptable simplification rather than a bug.
   */
  editBaselines: Record<string, Response[]>;
  /**
   * Which section's accordion panel the tour forces open in CountryPanel,
   * overriding its own uncontrolled tile-click state while a scene needs a
   * specific section's questions on screen (the rubric-editing and
   * submit-for-review scenes) - same "drive the live app from a scene"
   * idea as `selectedCountry`, added 2026-10-09 once the accordion
   * redesign meant a question's own rubric box no longer rendered at all
   * until a tile had actually been clicked, leaving the tour's own
   * spotlight with nothing to find. Not persisted, same as
   * `selectedCountry` - a navigation aid, not user data.
   */
  tourSectionId: string | null;
  /**
   * Which policy area is open on the selected country's page ("" for the
   * tile overview). Lives here rather than in CountryPanel so the map can
   * recolour by that section and the URL can carry it. Reset on every
   * selectCountry, so a newly opened country starts from its overview. Not
   * persisted, same as `selectedCountry`.
   */
  activeSectionId: string;

  setThreshold: (threshold: number) => void;
  setMapMetric: (mapMetric: "score" | "completeness") => void;
  setPage: (page: "map" | "admin" | "help") => void;
  setWelcomeSeen: (seen: boolean) => void;
  setTourSeen: (seen: boolean) => void;
  setMode: (mode: "light" | "dark") => void;
  setLanguage: (language: string) => void;
  selectCountry: (code: string | null) => void;
  setTourSectionId: (id: string | null) => void;
  setActiveSectionId: (id: string) => void;
  setComparing: (comparing: boolean) => void;
  /** No-ops past MAX_COMPARE_COUNTRIES or on a duplicate code. */
  addCompareCountry: (code: string) => void;
  removeCompareCountry: (code: string) => void;
  clearCompareCountries: () => void;
  setScoreboardFilters: (patch: Partial<ScoreboardFilters>) => void;
  resetScoreboardFilters: () => void;
  setScoreboardSortDirection: (direction: "asc" | "desc") => void;

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

  /** No-op if a baseline for this country already exists this session. */
  captureEditBaseline: (countryCode: string) => void;
  /** Diffs the country's live responses against its captured baseline, files the result as a new pending Suggestion, then re-captures the baseline as the just-submitted state. */
  submitSuggestion: (input: {
    countryCode: string;
    countryName: string;
    submitterName: string;
    submitterOrganisation: string;
  }) => void;
  /**
   * Files a single-question correction as a pending Suggestion without touching the live
   * responses - the proposed answer (and its evidence) only applies if a reviewer accepts it.
   */
  submitCorrection: (input: {
    countryCode: string;
    countryName: string;
    questionId: string;
    proposedScore: number;
    source: string;
    reason: string;
    submitterName: string;
    submitterOrganisation: string;
  }) => void;
  /** Files a proposal for a new question as pending. Nothing is added to the question set until it is accepted. */
  submitQuestionProposal: (input: Omit<QuestionProposal, "id" | "submittedAt" | "status" | "questionId">) => void;
  /** Accepting adds the question (three rubric tiers, the given weight) so it counts toward scores straight away; rejecting a previously-accepted proposal removes it again. */
  reviewQuestionProposal: (id: string, decision: "accepted" | "rejected", weight?: number) => void;
  /** On "rejected", also restores every response the suggestion touched back to its pre-suggestion value. */
  reviewSuggestion: (id: string, decision: "accepted" | "rejected") => void;

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
export function seedResponses(): Response[] {
  const out: Response[] = [];
  const seedScore = new Map<string, number>(); // `${countryCode}|${questionId}` -> spreadsheet score
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
      seedScore.set(`${countryCode}|${q.id}`, score);
    }
  }

  // A spreadsheet answer is a country's own hand-completed survey response -
  // the primary record for that (country, question) pair. sourced-answers.json's
  // "national" entries are usually written to attach a citation to that exact
  // same score (confirmed for GB rows 13/51/52/57, which all match), not to
  // compete with it - but indicator-answers.json's proxy layer is a blunt,
  // automated stand-in meant only for countries with *no* spreadsheet answer,
  // and was silently winning here on the previous plain concatenation (GB row
  // 12: spreadsheet says 1, a generic World-Bank-lending-rate proxy said 2,
  // and the proxy won purely because it happened to sort last). A sourced
  // answer only replaces the spreadsheet's bare entry when it agrees with it
  // (contributing its evidence); a genuine conflict is logged rather than
  // silently overriding a country's own survey response.
  const byKey = new Map<string, Response>();
  for (const r of out) byKey.set(`${r.countryCode}|${r.questionId}`, r);
  for (const r of sourcedResponses(protocol.questions)) {
    const key = `${r.countryCode}|${r.questionId}`;
    const spreadsheet = seedScore.get(key);
    if (spreadsheet !== undefined && spreadsheet !== r.score) {
      console.warn(
        `sourced answer for ${key} (score ${r.score}) conflicts with the spreadsheet's own score ` +
          `(${spreadsheet}) - keeping the spreadsheet score, discarding the sourced evidence`,
      );
      continue;
    }
    byKey.set(key, r);
  }

  // Answers editors set in the app (Phase 4) win over researched ones; a
  // cleared one (score null) removes the researched answer too.
  if (usingDatabase()) {
    for (const e of readPolicyData().responses) {
      const key = `${e.countryCode}|${e.questionId}`;
      if (e.score === null) {
        byKey.delete(key);
        continue;
      }
      byKey.set(key, {
        questionId: e.questionId,
        countryCode: e.countryCode,
        score: e.score,
        evidence: e.evidence,
        updatedAt: e.updatedAt,
        ...(e.basis ? { basis: e.basis } : {}),
      });
    }
  }
  return [...byKey.values()];
}

function initialState() {
  return {
    threshold: protocol.completenessThreshold,
    mapMetric: "score" as const,
    page: "map" as const,
    // WelcomeModal (the Charter) is driven by `open={!welcomeSeen}` - unlike
    // tourSeen, this one must default to *true* (closed) or the Charter pops
    // up over the scroll-story hero on every fresh visit and every reset,
    // before anyone has asked to see it. It only ever goes false when
    // something actively opens the Charter - the nav link or the tour's own
    // "Read the Charter" pill (App.tsx's onOpenCharter) - both explicit
    // `setWelcomeSeen(false)` calls, never a default.
    welcomeSeen: true,
    tourSeen: false,
    // Cross-app choice (see shared/lib/darkMode.ts) - `merge` below also
    // re-applies this on every load, since this app's own persisted `mode`
    // (in this store's own localStorage entry, alongside everything else
    // partialize keeps) would otherwise win over a choice made in a
    // sibling app after this store was first created.
    mode: getStoredMode() ?? "light",
    language: DEFAULT_LANGUAGE,
    sections: protocol.sections.map((s) => ({ ...s })),
    questions: protocol.questions.map((q) => ({ ...q })),
    responses: seedResponses(),
    selectedCountry: null,
    tourSectionId: null,
    activeSectionId: "",
    comparing: false,
    compareCountries: [],
    scoreboardFilters: DEFAULT_SCOREBOARD_FILTERS,
    scoreboardSortDirection: "desc" as const,
    questionOverrides: {},
    sectionOverrides: {},
    customSections: [],
    customQuestions: [],
    removedSectionIds: [],
    removedQuestionIds: [],
    suggestions: [],
    questionProposals: [],
    editBaselines: {},
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
      setMode: (mode) => {
        setStoredMode(mode);
        set({ mode });
      },
      setLanguage: (language) => {
        i18n.changeLanguage(language);
        set({ language });
      },
      // Picking a jurisdiction - from the map, search, or the scoreboard -
      // always means "look at this one", which is not compatible with
      // whatever compare state was left over from a previous detail view.
      selectCountry: (code) =>
        set({ selectedCountry: code, comparing: false, compareCountries: [], tourSectionId: null, activeSectionId: "" }),
      setTourSectionId: (tourSectionId) => set({ tourSectionId }),
      setActiveSectionId: (activeSectionId) => set({ activeSectionId }),
      setComparing: (comparing) => set({ comparing }),
      addCompareCountry: (code) =>
        set((state) =>
          state.compareCountries.includes(code) || state.compareCountries.length >= MAX_COMPARE_COUNTRIES
            ? state
            : { compareCountries: [...state.compareCountries, code] },
        ),
      removeCompareCountry: (code) =>
        set((state) => ({ compareCountries: state.compareCountries.filter((c) => c !== code) })),
      clearCompareCountries: () => set({ compareCountries: [] }),
      setScoreboardFilters: (patch) =>
        set((state) => ({ scoreboardFilters: { ...state.scoreboardFilters, ...patch } })),
      resetScoreboardFilters: () => set({ scoreboardFilters: DEFAULT_SCOREBOARD_FILTERS }),
      setScoreboardSortDirection: (scoreboardSortDirection) => set({ scoreboardSortDirection }),

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
            evidence: [...(responses[i].evidence ?? []), { title: "", source: "", note: "" }],
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
          if (i === -1 || !state.responses[i].evidence?.[index]) return state;
          const evidence = (state.responses[i].evidence ?? []).slice();
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
            evidence: (responses[i].evidence ?? []).filter((_, ei) => ei !== index),
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

      captureEditBaseline: (countryCode) =>
        set((state) => {
          if (state.editBaselines[countryCode]) return state; // already captured this session
          return {
            editBaselines: {
              ...state.editBaselines,
              [countryCode]: state.responses.filter((r) => r.countryCode === countryCode),
            },
          };
        }),

      submitSuggestion: ({ countryCode, countryName, submitterName, submitterOrganisation }) =>
        set((state) => {
          const baseline = state.editBaselines[countryCode] ?? [];
          const current = state.responses.filter((r) => r.countryCode === countryCode);
          const changes = diffResponses(baseline, current, state.questions);
          if (changes.length === 0) return state; // nothing to file

          const suggestion: Suggestion = {
            id: `sg-${Date.now().toString(36)}`,
            countryCode,
            countryName,
            submitterName,
            submitterOrganisation,
            submittedAt: new Date().toISOString(),
            status: "pending",
            changes,
            baseline,
            proposed: current,
          };

          return {
            suggestions: [...state.suggestions, suggestion],
            // Re-baseline to what was just submitted, so further edits diff cleanly against it.
            editBaselines: { ...state.editBaselines, [countryCode]: current },
          };
        }),

      submitCorrection: ({
        countryCode,
        countryName,
        questionId,
        proposedScore,
        source,
        reason,
        submitterName,
        submitterOrganisation,
      }) =>
        set((state) => {
          const baseline = state.responses.filter((r) => r.countryCode === countryCode);
          const existing = baseline.find((r) => r.questionId === questionId);
          const evidence = [
            ...(existing?.evidence ?? []),
            { title: "Submitted correction", source: source.trim(), note: reason.trim() },
          ];
          const revised: Response = {
            questionId,
            countryCode,
            score: proposedScore,
            evidence,
            updatedAt: new Date().toISOString(),
          };
          const proposed = [...baseline.filter((r) => r.questionId !== questionId), revised];
          const changes = diffResponses(baseline, proposed, state.questions);
          if (changes.length === 0) return state;

          const suggestion: Suggestion = {
            id: `sg-${Date.now().toString(36)}`,
            countryCode,
            countryName,
            submitterName,
            submitterOrganisation,
            submittedAt: new Date().toISOString(),
            status: "pending",
            changes,
            baseline,
            proposed,
          };
          return { suggestions: [...state.suggestions, suggestion] };
        }),

      submitQuestionProposal: (input) =>
        set((state) => ({
          questionProposals: [
            ...state.questionProposals,
            {
              ...input,
              id: `qp-${Date.now().toString(36)}`,
              submittedAt: new Date().toISOString(),
              status: "pending",
            },
          ],
        })),

      reviewQuestionProposal: (id, decision, weight = 1) => {
        const proposal = get().questionProposals.find((p) => p.id === id);
        if (!proposal) return;
        let questionId = proposal.questionId;
        if (decision === "accepted" && !questionId) {
          questionId = get().addQuestion(proposal.sectionId);
          get().updateQuestion(questionId, {
            text: proposal.text,
            weight,
            // Some questions only have two answers - the middle tier is optional.
            rubric: [
              { score: 0, label: proposal.weakLabel, points: 0 },
              ...(proposal.developedLabel.trim() ? [{ score: 1, label: proposal.developedLabel, points: 1 }] : []),
              { score: 2, label: proposal.strongLabel, points: 4 },
            ],
          });
        } else if (decision === "rejected" && questionId) {
          get().deleteQuestion(questionId);
          questionId = undefined;
        }
        set((state) => ({
          questionProposals: state.questionProposals.map((p) =>
            p.id === id ? { ...p, status: decision, questionId } : p,
          ),
        }));
      },

      reviewSuggestion: (id, decision) =>
        set((state) => {
          const suggestion = state.suggestions.find((s) => s.id === id);
          if (!suggestion) return state;

          const suggestions = state.suggestions.map((s) =>
            s.id === id ? { ...s, status: decision } : s,
          );

          // Both directions are reversible, not just reject - accepting (or
          // re-accepting a previously-rejected suggestion) applies exactly
          // what was proposed at submission time, and rejecting (including
          // re-rejecting a previously-accepted one) restores exactly the
          // pre-suggestion baseline. Only the questions this suggestion
          // actually touched are affected either way; other responses
          // (including later, still-pending suggestions) are untouched.
          const source = (decision === "accepted" ? suggestion.proposed : suggestion.baseline) ?? [];
          const byQuestion = new Map(source.map((r) => [r.questionId, r]));
          const touchedQuestionIds = new Set(suggestion.changes.map((c) => c.questionId));

          const withoutTouched = state.responses.filter(
            (r) => !(r.countryCode === suggestion.countryCode && touchedQuestionIds.has(r.questionId)),
          );
          const restored = [...touchedQuestionIds]
            .map((qid) => byQuestion.get(qid))
            .filter((r): r is Response => r !== undefined);

          return { suggestions, responses: [...withoutTouched, ...restored] };
        }),

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
      //
      // `suggestions` (added after v10, also no bump) is likewise additive -
      // an existing visitor's blob simply lacks the key and starts with none.
      //
      // `mode` (added after v10, also no bump) is likewise additive - an
      // existing visitor's blob simply lacks the key and starts on `light`,
      // same as initialState()'s default.
      // v11 (2026-10-14): the policy dataset was replaced wholesale (new countries
      // and answers from input/*Rev 8.xlsx). Answers a visitor had saved against
      // the old dataset - including typed answers - are dropped by migrate().
      version: 11,

      /**
       * Keep the user's answers and every admin edit (overrides, additions,
       * deletions); everything else comes fresh from `initialState()`.
       */
      migrate: (persisted, fromVersion) => {
        const state = persisted as Partial<ProtocolState> | undefined;
        const keepResponses = fromVersion >= 11;
        const { sections, questions } = buildLiveData(state ?? {});
        return {
          ...initialState(),
          threshold: protocol.completenessThreshold,
          responses: keepResponses ? (state?.responses ?? []).filter((r) => !r.seeded).map(migrateResponseShape) : [],
          questionOverrides: state?.questionOverrides ?? {},
          sectionOverrides: state?.sectionOverrides ?? {},
          customSections: state?.customSections ?? [],
          customQuestions: state?.customQuestions ?? [],
          removedSectionIds: state?.removedSectionIds ?? [],
          removedQuestionIds: state?.removedQuestionIds ?? [],
          sections,
          questions,
        } as unknown as ProtocolState;
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
      partialize: (state) =>
        usingDatabase()
          ? // The policy database holds the data on these builds (see merge
            // below), so only preferences and the browser-only suggestion
            // queues (until Phase 6) are kept here.
            {
              mapMetric: state.mapMetric,
              welcomeSeen: state.welcomeSeen,
              tourSeen: state.tourSeen,
              mode: state.mode,
              language: state.language,
              suggestions: state.suggestions,
              questionProposals: state.questionProposals,
            }
          : {
        threshold: state.threshold,
        mapMetric: state.mapMetric,
        welcomeSeen: state.welcomeSeen,
        tourSeen: state.tourSeen,
        mode: state.mode,
        language: state.language,
        responses: state.responses.filter((r) => !r.seeded),
        questionOverrides: state.questionOverrides,
        sectionOverrides: state.sectionOverrides,
        customSections: state.customSections,
        customQuestions: state.customQuestions,
        removedSectionIds: state.removedSectionIds,
        removedQuestionIds: state.removedQuestionIds,
        suggestions: state.suggestions,
        questionProposals: state.questionProposals,
            },

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

        // On builds reading the policy database the database is the record:
        // edits this browser saved before (or under an older build) must not
        // hide it, so only preferences and the browser-only suggestion queues
        // (until Phase 6) carry over. Sections, questions, answers and the
        // threshold all come from the database, already in `current`.
        if (usingDatabase()) {
          if (state.language && (SUPPORTED_LANGUAGES as readonly string[]).includes(state.language)) {
            i18n.changeLanguage(state.language);
          }
          return {
            ...current,
            mapMetric: state.mapMetric ?? current.mapMetric,
            welcomeSeen: state.welcomeSeen ?? current.welcomeSeen,
            tourSeen: state.tourSeen ?? current.tourSeen,
            mode: getStoredMode() ?? state.mode ?? current.mode,
            language: state.language ?? current.language,
            suggestions: state.suggestions ?? current.suggestions,
            questionProposals: state.questionProposals ?? current.questionProposals,
          };
        }

        // migrateResponseShape also runs here, not just in `migrate` below -
        // `migrate` only fires on an actual version bump, so a response
        // whose `evidence` field was missing (or otherwise stored pre-v10
        // and never diffed against a bumped version) would otherwise flow
        // through untouched on every ordinary load and crash the first
        // reader that assumes `evidence` is always an array.
        const userEntered = (state.responses ?? [])
          .filter((r) => !r.seeded)
          .map(migrateResponseShape)
          .flatMap((r) =>
            resolveTargets(r.countryCode).map((code) => ({ ...r, countryCode: code })),
          );
        const { sections, questions } = buildLiveData(state);

        // A response the user has actually edited replaces the seed's
        // answer for that same (country, question) pair rather than sitting
        // alongside it - a plain concatenation left both in the array
        // simultaneously, which made a question look impossible to edit
        // once it had ever been edited before: setResponse only ever
        // updates the *first* matching entry it finds, so the older,
        // untouched duplicate kept winning wherever responses get looked up
        // by a Map keyed on questionId (last entry with that key wins a
        // Map's construction, and that stale duplicate always sorted last).
        const byKey = new Map<string, Response>();
        for (const r of seedResponses()) byKey.set(`${r.countryCode}|${r.questionId}`, r);
        for (const r of userEntered) byKey.set(`${r.countryCode}|${r.questionId}`, r);

        // i18next is a singleton outside this store - restoring `language`
        // into the store's own state (below) doesn't by itself change what
        // i18next actually renders, unlike `mode` (read fresh from the store
        // every render by ThemedApp). A returning visitor's saved language
        // needs this explicit push on load; setLanguage handles it for
        // every later change. Guarded by SUPPORTED_LANGUAGES so a value
        // saved while a language was offered (es/fr, before Andrew turned
        // them off in the menu 2026-09-11) doesn't silently keep rendering
        // in a language the switcher no longer lets anyone choose.
        if (state.language && (SUPPORTED_LANGUAGES as readonly string[]).includes(state.language)) {
          i18n.changeLanguage(state.language);
        }

        return {
          ...current,
          ...state,
          // The shared cross-app key (see shared/lib/darkMode.ts), not
          // whatever this app's own persisted `mode` field says - it can be
          // stale the moment a sibling app's own toggle writes a newer
          // value to that key without this store ever hearing about it.
          mode: getStoredMode() ?? state.mode ?? current.mode,
          sections,
          questions,
          responses: [...byKey.values()],
        };
      },
    },
  ),
);

export { protocol };
