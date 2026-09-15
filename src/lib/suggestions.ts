import type { Question, Response } from "./types";

export interface SuggestionChange {
  questionId: string;
  questionText: string;
  kind: "score" | "evidence-added" | "evidence-removed" | "evidence-edited";
  description: string;
}

export interface Suggestion {
  id: string;
  countryCode: string;
  countryName: string;
  submitterName: string;
  submitterOrganisation: string;
  submittedAt: string;
  status: "pending" | "accepted" | "rejected";
  changes: SuggestionChange[];
  /** This country's responses exactly as they were before this suggestion's edits - what "reject" reverts to. */
  baseline: Response[];
  /** This country's responses exactly as they were when submitted - what "accept" applies, including re-accepting after a reject. */
  proposed: Response[];
}

/**
 * Only works within one visitor's own browser until a real backend exists -
 * see ROADMAP.md's "Known gaps flagged in code" section (closed by Phase 6).
 * Written so swapping the local `suggestions` array for real API calls later
 * should not need this shape to change.
 */
export function diffResponses(
  before: Response[],
  after: Response[],
  questions: Question[],
): SuggestionChange[] {
  const questionById = new Map(questions.map((q) => [q.id, q]));
  const beforeById = new Map(before.map((r) => [r.questionId, r]));
  const afterById = new Map(after.map((r) => [r.questionId, r]));
  const questionIds = new Set([...beforeById.keys(), ...afterById.keys()]);

  const changes: SuggestionChange[] = [];

  for (const questionId of questionIds) {
    const question = questionById.get(questionId);
    const questionText = question?.text ?? questionId;
    const b = beforeById.get(questionId);
    const a = afterById.get(questionId);

    if (b?.score !== a?.score) {
      const tierLabel = (score: number | undefined) =>
        score === undefined
          ? "no answer"
          : (question?.rubric?.find((t) => t.score === score)?.label ?? String(score));
      changes.push({
        questionId,
        questionText,
        kind: "score",
        description: `Answer changed from "${tierLabel(b?.score)}" to "${tierLabel(a?.score)}"`,
      });
    }

    const bEvidence = b?.evidence ?? [];
    const aEvidence = a?.evidence ?? [];
    const maxLen = Math.max(bEvidence.length, aEvidence.length);
    // Compared by index, matching how addEvidence/updateEvidence/
    // removeEvidence already address evidence items - simple, and honest
    // that removing one item and adding a different one at the same index
    // reads as "edited" rather than "removed + added".
    for (let i = 0; i < maxLen; i++) {
      const bi = bEvidence[i];
      const ai = aEvidence[i];
      if (bi && !ai) {
        changes.push({
          questionId,
          questionText,
          kind: "evidence-removed",
          description: `Evidence removed: "${bi.title || bi.source || "untitled"}"`,
        });
      } else if (!bi && ai) {
        changes.push({
          questionId,
          questionText,
          kind: "evidence-added",
          description: `Evidence added: "${ai.title || ai.source || "untitled"}"`,
        });
      } else if (bi && ai && (bi.title !== ai.title || bi.source !== ai.source || bi.note !== ai.note)) {
        changes.push({
          questionId,
          questionText,
          kind: "evidence-edited",
          description: `Evidence edited: "${ai.title || ai.source || "untitled"}"`,
        });
      }
    }
  }

  return changes;
}
