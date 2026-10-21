import { editorFetch } from "./editorAuth";
import type { QuestionProposal, Suggestion } from "./suggestions";

/**
 * Public suggestions and question proposals on database builds (ROADMAP.md
 * Phase 6; klute/gate/ep_db/review.py). Anyone files them, no sign-in;
 * editors load everyone's into the admin console. Their accept/reject
 * decisions are saved by lib/policySync.ts like any other edit.
 */

async function failure(response: Response): Promise<Error> {
  const detail = await response
    .json()
    .then((b) => (typeof b.detail === "string" ? b.detail : null))
    .catch(() => null);
  return new Error(detail ?? `HTTP ${response.status}`);
}

async function post(url: string, body: unknown): Promise<void> {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!response.ok) throw await failure(response);
}

/**
 * `website` is the dialogs' hidden honeypot field: people never see it,
 * form-filling bots fill it in, and the server quietly drops what they send.
 */
export function fileSuggestion(s: Suggestion, website = ""): Promise<void> {
  const { countryCode, submitterName, submitterOrganisation, changes, baseline, proposed } = s;
  return post("/api/policy/suggestions", { countryCode, submitterName, submitterOrganisation, changes, baseline, proposed, website });
}

export function fileQuestionProposal(p: QuestionProposal, website = ""): Promise<void> {
  const { sectionId, text, strongLabel, developedLabel, weakLabel, reason, source, submitterName, submitterOrganisation } = p;
  return post("/api/policy/question-proposals", {
    sectionId,
    text,
    strongLabel,
    developedLabel,
    weakLabel,
    reason,
    source,
    submitterName,
    submitterOrganisation,
    website,
  });
}

/** Everything filed, for an editor. */
export async function loadReviewQueue(): Promise<{ suggestions: Suggestion[]; questionProposals: QuestionProposal[] }> {
  const response = await editorFetch("/api/policy/review");
  if (!response.ok) throw await failure(response);
  return response.json();
}
