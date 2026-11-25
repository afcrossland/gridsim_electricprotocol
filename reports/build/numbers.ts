import { parse as parseYaml } from "yaml";

export interface KeyNumber {
  value: string;
  label: string;
}

/** A `numbers` block in a post: one to four headline figures, each with what it counts. */
export function parseNumbers(source: string, fail: (message: string) => never): KeyNumber[] {
  let parsed: unknown;
  try {
    // Everything as text, so that 1.20 and 007 stay as they were written.
    parsed = parseYaml(source, { schema: "failsafe" });
  } catch (error) {
    fail(`a numbers block can't be read (text with a colon in it, or starting with a symbol such as %, needs quotes): ${(error as Error).message}`);
  }
  if (!Array.isArray(parsed) || !parsed.length || parsed.length > 4) return fail('a numbers block is a list of one to four "- value:" and "label:" pairs');
  return parsed.map((item: unknown) => {
    const entry = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};
    for (const key of Object.keys(entry)) if (key !== "value" && key !== "label") fail(`a numbers block has an unknown detail "${key}"`);
    const text = (key: "value" | "label"): string => {
      const value = entry[key];
      return typeof value === "string" && value.trim() ? value.trim() : fail(`every entry in a numbers block needs a "${key}"`);
    };
    const value = text("value");
    if (value.length > 14) fail(`"${value}" is too long for a numbers block (14 characters): put the words in the label`);
    return { value, label: text("label") };
  });
}
