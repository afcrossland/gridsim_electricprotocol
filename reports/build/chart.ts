import { parse as parseYaml } from "yaml";

/** What a chart block in a post comes to, and what the page's script (chart.client.js) draws from. */
export interface Chart {
  type: "line" | "column" | "bar";
  stacked: boolean;
  title: string;
  /** What the chart shows, for people who can't see it. */
  description: string;
  unit: string;
  caption: string;
  /** The CSV in the post's folder, if the numbers are in one. */
  file?: string;
  /** The first column's heading, then one label for each row. */
  axis: string;
  labels: string[];
  series: { name: string; values: (number | null)[] }[];
}

const KEYS = ["type", "stacked", "title", "description", "unit", "caption", "data"];
/** Four colours can be told apart by colour-blind readers; a fifth could not (see --s1 to --s4 in page.css). */
export const MAX_SERIES = 4;

/** `readFile` returns the text of a CSV in the post's folder, or fails the build. */
export function parseChart(source: string, readFile: (name: string) => string, fail: (message: string) => never): Chart {
  let parsed: unknown;
  try {
    parsed = parseYaml(source);
  } catch (error) {
    fail(`a chart block can't be read (text with a colon in it needs quotes): ${(error as Error).message}`);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) fail('a chart block must be a list of "name: value" lines');
  const meta = parsed as Record<string, unknown>;
  const name = typeof meta.title === "string" ? `the chart "${meta.title}"` : "a chart";
  const bad = (message: string): never => fail(`${name}: ${message}`);

  for (const key of Object.keys(meta)) if (!KEYS.includes(key)) bad(`unknown detail "${key}"`);
  const text = (key: string, required: boolean): string => {
    const value = meta[key];
    if (value === undefined || value === null || value === "") return required ? bad(`"${key}" is missing`) : "";
    return typeof value === "string" ? value.trim() : bad(`"${key}" must be text (put it in quotes)`);
  };
  const type = text("type", true);
  if (type !== "line" && type !== "column" && type !== "bar") return bad('"type" must be line, column or bar');
  const stacked = meta.stacked ?? false;
  if (typeof stacked !== "boolean") return bad('"stacked" must be true or false');
  if (stacked && type === "line") bad("a line chart can't be stacked");

  const data = text("data", true);
  const file = /^[^\n,]+\.csv$/i.test(data) ? data : undefined;
  const rows = parseCsv(file ? readFile(file) : data);
  const [head, ...body] = rows;
  if (!head || head.length < 2 || body.length < 2) return bad("the data needs a row of headings, then at least two rows of numbers");
  const names = head.slice(1);
  if (names.length > MAX_SERIES) bad(`${names.length} columns of numbers is too many to tell apart (${MAX_SERIES} at most): split it into two charts, or add the small ones up`);
  if (names.some((n) => !n) || new Set(names).size !== names.length) bad("every column needs its own heading");
  body.forEach((row) => row.length === head.length || bad(`the row "${row.join(", ")}" has ${row.length} values and the headings have ${head.length}`));

  const labels = body.map((row) => row[0]);
  if (labels.some((l) => !l) || new Set(labels).size !== labels.length) bad("every row needs its own label");
  const series = names.map((n, i) => ({
    name: n,
    values: body.map((row) => {
      const cell = row[i + 1];
      if (cell === "") return null;
      const value = Number(cell);
      return /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(cell) && Number.isFinite(value) ? value : bad(`"${cell}" is not a number (leave out units and thousands commas)`);
    }),
  }));
  series.forEach((s) => s.values.some((v) => v !== null) || bad(`"${s.name}" has no numbers`));
  if (stacked && series.some((s) => s.values.some((v) => v === null || v < 0))) bad("a stacked chart can't have gaps or numbers below zero");
  if (type === "line" && labels.every(isNumber) && labels.some((l, i) => i > 0 && Number(l) <= Number(labels[i - 1]))) {
    bad(`"${head[0]}" must go up from one row to the next`);
  }
  return { type, stacked, title: text("title", true), description: text("description", true), unit: text("unit", false), caption: text("caption", false), file, axis: head[0], labels, series };
}

const isNumber = (label: string) => /^-?\d+(\.\d+)?$/.test(label);

/** Rows of trimmed cells. A cell in double quotes can hold commas, quotes (doubled) and line breaks. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const endRow = () => {
    row.push(cell.trim());
    if (row.some((c) => c !== "")) rows.push(row);
    row = [];
    cell = "";
  };
  const source = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (quoted) {
      if (c !== '"') cell += c;
      else if (source[i + 1] === '"') cell += source[++i];
      else quoted = false;
    } else if (c === '"' && cell.trim() === "") {
      quoted = true;
      cell = "";
    } else if (c === ",") {
      row.push(cell.trim());
      cell = "";
    } else if (c === "\n") endRow();
    else cell += c;
  }
  endRow();
  return rows;
}
