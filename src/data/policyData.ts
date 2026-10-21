import seedJson from "./protocol.seed.json";
import sourcedJson from "./sourced-answers.json";
import indicatorJson from "./indicator-answers.json";
import jurisdictionsJson from "./jurisdictions.json";

/**
 * The Policy Explorer's four datasets, in one place (ROADMAP.md, Phase 1).
 *
 * They start as the JSON files bundled into the build. When the build sets
 * VITE_POLICY_API (dev only, see deploy.yml), `main.tsx` calls
 * `loadPolicyData()` before importing the app, and a good response from
 * `/api/policy/data` - the policy database, served in exactly these files'
 * shapes - replaces them. Any failure keeps the bundled JSON, so the app
 * always has data.
 *
 * Several modules (lib/jurisdictions.ts, data/sourcedAnswers.ts,
 * stores/protocolStore.ts) read this once, at module load. That is why
 * main.tsx only imports the app after the load settles, and why
 * `readPolicyData()` locks the data: replacing it after something has
 * already read it would leave the app built from two different sources, so
 * a late load is refused instead.
 */
/**
 * An answer an editor set in the app (Phase 4) - served by the API alongside
 * the files' data, never bundled. Takes precedence over a researched answer
 * for the same pair; `score: null` means the editor cleared it.
 */
export interface EditedResponse {
  countryCode: string;
  questionId: string;
  score: number | null;
  basis: "national" | "directive-baseline" | "proxy-indicator" | null;
  evidence: { title: string; source: string; note: string }[];
  updatedAt: string;
  updatedBy: string;
}

export interface PolicyData {
  protocol: typeof seedJson;
  jurisdictions: typeof jurisdictionsJson;
  sourced: typeof sourcedJson;
  indicator: typeof indicatorJson;
  responses: EditedResponse[];
}

export type PolicyDataSource = "bundled" | "api";

const data: PolicyData = {
  protocol: seedJson,
  jurisdictions: jurisdictionsJson,
  sourced: sourcedJson,
  indicator: indicatorJson,
  responses: [],
};
let source: PolicyDataSource = "bundled";
let read = false;

export const POLICY_API_URL = "/api/policy/data";

/** The datasets every consumer builds from. Locks them against a later load. */
export function readPolicyData(): PolicyData {
  read = true;
  return data;
}

/** Where the data in use came from. */
export function policyDataSource(): PolicyDataSource {
  return source;
}

/**
 * True when the data came from the policy database: the database, not this
 * browser's own saved edits, is then the record (see protocolStore's merge).
 */
export function usingDatabase(): boolean {
  return source === "api";
}

function looksLikePolicyData(value: unknown): value is PolicyData {
  const v = value as Partial<Record<keyof PolicyData, Record<string, unknown>>> | null;
  return (
    !!v &&
    Array.isArray(v.protocol?.questions) &&
    Array.isArray(v.protocol?.sections) &&
    Array.isArray(v.jurisdictions) &&
    Array.isArray(v.sourced?.answers) &&
    Array.isArray(v.indicator?.answers)
  );
}

/**
 * Replace the bundled data with the API's, if it answers in time with
 * something of the right shape. Never throws; resolves to the source in use.
 */
export async function loadPolicyData({
  url = POLICY_API_URL,
  timeoutMs = 8000,
  fetchImpl = fetch,
}: { url?: string; timeoutMs?: number; fetchImpl?: typeof fetch } = {}): Promise<PolicyDataSource> {
  if (read) {
    console.error("Policy data was read before loadPolicyData() finished; keeping the bundled JSON.");
    return source;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body: unknown = await response.json();
    if (!looksLikePolicyData(body)) throw new Error("unexpected response shape");
    if (read) throw new Error("data was read while the request was in flight");
    Object.assign(data, { responses: [] }, body);
    source = "api";
  } catch (error) {
    console.warn(`Policy data: using the bundled JSON (${url} unavailable: ${String(error)})`);
  } finally {
    clearTimeout(timer);
  }
  return source;
}
