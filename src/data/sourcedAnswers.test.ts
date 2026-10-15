import { describe, expect, it } from "vitest";

import seed from "./protocol.seed.json";
import handWritten from "./sourced-answers.json";
import indicators from "./indicator-answers.json";
import { sourcedResponses } from "./sourcedAnswers";
import type { Protocol } from "../lib/types";

const protocol = seed as unknown as Protocol;
const responses = sourcedResponses(protocol.questions);
const QUALITY_VALUES = new Set(["primary-official", "secondary"]);

describe("shipped answer data", () => {
  it("emits one answer per jurisdiction and question", () => {
    const seen = new Set<string>();
    for (const r of responses) {
      const key = `${r.countryCode}:${r.questionId}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("has answers, and cites a source and evidence on every one", () => {
    expect(responses.length).toBeGreaterThan(0);
    // A source is a link or the name of a report, so it just has to be present.
    expect(responses.every((r) => (r.evidence[0]?.source ?? "").trim() !== "")).toBe(true);
  });

  it("only uses scores that exist in the question's rubric", () => {
    const byId = new Map(protocol.questions.map((q) => [q.id, q]));
    for (const r of responses) {
      const rubric = byId.get(r.questionId)!.rubric;
      expect(rubric.some((t) => t.score === r.score)).toBe(true);
    }
  });

  // `quality` is optional and not backfilled onto sources added before the
  // field existed (see the long comment on SourceRef in sourcedAnswers.ts) -
  // this only checks that wherever it IS set, it is one of the two values the
  // rest of the app can rely on, not that every source has one.
  it("only uses recognised values for a source's evidence quality", () => {
    const allSources = { ...indicators.sources, ...handWritten.sources };
    for (const [id, source] of Object.entries(allSources)) {
      const quality = (source as { quality?: string }).quality;
      if (quality !== undefined) {
        expect(QUALITY_VALUES.has(quality), `source ${id} has an unrecognised quality value`).toBe(true);
      }
    }
  });
});
