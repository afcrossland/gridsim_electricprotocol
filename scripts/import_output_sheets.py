#!/usr/bin/env python3
"""Import the per-country "Output Rev 8" spreadsheets in input/ into the app.

For every `input/<Country> Ouput Rev 8.xlsx` (the BLANK template is skipped) this
rewrites:

  src/data/sourced-answers.json  - one researched answer per (country, question),
                                   citing the sheet's own evidence
  src/data/indicator-answers.json - emptied (old proxy answers removed)
  src/data/protocol.seed.json    - seedAnswers stripped from every question and
                                   the country list replaced

Question matching: sheet question text -> seed question, exact match first, then
the closest wording within the same section (Indonesia's sheet paraphrases). A
sheet row with no confident match is reported and skipped, never guessed.

The app scores by rubric tier (0/1/2), so each answer's tier is taken from the
sheet's "Answer Category Statement". The sheet's own 0-10 score is kept in the
evidence note.
"""

import difflib
import json
import re
from pathlib import Path

import openpyxl

REPO = Path(__file__).resolve().parent.parent
INPUT = REPO / "input"
DATA = REPO / "src" / "data"

ISO = {
    "Bangladesh": ("BD", "Bangladesh"),
    "China": ("CN", "China"),
    "India": ("IN", "India"),
    "Indonesia": ("ID", "Indonesia"),
    "NZ": ("NZ", "New Zealand"),
    "Pakistan": ("PK", "Pakistan"),
    "Sri Lanka": ("LK", "Sri Lanka"),
    "UK": ("GB", "Great Britain"),
}


def norm(s):
    s = re.sub(r"[^a-z0-9 ]+", " ", (s or "").lower())
    s = s.replace("acessible", "accessible").replace("fomat", "format")
    return re.sub(r"\s+", " ", s).strip()


PARTIAL = re.compile(r"^some\b|some but not all|but are less than", re.I)


def add_middle_tiers(questions, sheets):
    """Six questions carry a two-tier rubric in the seed (0 and 2), but the sheets
    answer them with a partial category ("Some barriers...", "...some but not all...").
    Give those questions a middle tier (score 1, points 1 as on every other
    three-tier question) labelled with the sheet's own statement."""
    for q in questions:
        if [t["score"] for t in q["rubric"]] != [0, 2] or any(t["score"] == 1 for t in q["rubric"]):
            continue
        labels = [c.strip() for qid, c in sheets if qid == q["id"] and c and PARTIAL.search(c.strip())]
        if labels:
            label = max(set(labels), key=labels.count).rstrip(".")
            q["rubric"].insert(1, {"score": 1, "label": label, "points": 1})


def pick_tier(q, category):
    """Rubric tier whose wording is closest to the sheet's Answer Category Statement
    (column H). The 0-10 score in column G is deliberately not used."""
    tiers = q["rubric"]
    if not category:
        return None, None
    if PARTIAL.search(category.strip()) and any(t["score"] == 1 for t in tiers):
        return next(t for t in tiers if t["score"] == 1), None
    ranked = sorted(
        ((difflib.SequenceMatcher(None, norm(category), norm(t["label"])).ratio(), t) for t in tiers),
        key=lambda x: -x[0],
    )
    best, second = ranked[0], ranked[1]
    if best[0] >= 0.93 or (best[0] >= 0.6 and best[0] - second[0] >= 0.08):
        return best[1], None
    # Statement doesn't clearly match any tier (Indonesia's paraphrases): don't guess.
    return None, f"statement {category.strip()[:50]!r} matches no rubric tier clearly (best {best[0]:.2f})"


def main():
    seed_path = DATA / "protocol.seed.json"
    seed = json.loads(seed_path.read_text())
    questions = seed["questions"]
    section_title = {s["id"]: s["title"] for s in seed["sections"]}
    by_text = {norm(q["text"]): q for q in questions}

    old = json.loads((DATA / "sourced-answers.json").read_text())
    sources, answers, report = {}, [], []
    countries = []

    sheets = []
    for path in sorted(p for p in INPUT.glob("* Ouput Rev 8.xlsx") if not p.name.startswith("~$")):
        label0 = path.name.replace(" Ouput Rev 8.xlsx", "")
        if label0 not in ISO:
            continue
        for row in openpyxl.load_workbook(path, data_only=True)["Question Output"].iter_rows(min_row=2, values_only=True):
            q0 = by_text.get(norm(row[1]))
            if q0:
                sheets.append((q0["id"], row[7]))
    add_middle_tiers(questions, sheets)

    for path in sorted(p for p in INPUT.glob("* Ouput Rev 8.xlsx") if not p.name.startswith("~$")):
        label = path.name.replace(" Ouput Rev 8.xlsx", "")
        if label not in ISO:
            if label != "BLANK":
                report.append(f"{path.name}: no ISO mapping, skipped")
            continue
        code, name = ISO[label]
        countries.append({"code": code, "name": name})
        ws = openpyxl.load_workbook(path, data_only=True)["Question Output"]
        src_ids, matched = {}, set()

        for area, text, answer, etitle, eurl, enotes, rating, category in ws.iter_rows(min_row=2, values_only=True):
            if not text:
                continue
            q = by_text.get(norm(text))
            if q is None:
                pool = [x for x in questions if norm(section_title[x["sectionId"]]) == norm(area) and x["id"] not in matched]
                best = max(pool, key=lambda x: difflib.SequenceMatcher(None, norm(text), norm(x["text"])).ratio(), default=None)
                ratio = difflib.SequenceMatcher(None, norm(text), norm(best["text"])).ratio() if best else 0
                if best is None or ratio < 0.71:
                    report.append(f"{code}: no confident question match for {text.strip()[:90]!r} (best {ratio:.2f})")
                    continue
                report.append(f"{code}: fuzzy-matched {text.strip()[:60]!r} -> {best['id']} ({ratio:.2f})")
                q = best
            if q["id"] in matched:
                report.append(f"{code}: duplicate answer for {q['id']}, skipped")
                continue
            tier, how = pick_tier(q, category)
            if tier is None:
                report.append(f"{code}: {q['id']} skipped - {how or 'no category statement'}")
                continue
            if how:
                report.append(f"{code}: {q['id']} tier {tier['score']} {how}")
            matched.add(q["id"])
            key = (etitle, eurl)
            if key not in src_ids:
                sid = f"{code.lower()}-{len(src_ids) + 1:03d}"
                src_ids[key] = sid
                sources[sid] = {"title": (etitle or "Untitled source").strip(), "url": (eurl or "").strip()}
            # Column H (Answer Category Statement) is the answer; column C is supporting detail.
            parts = [(category or "").strip(), (answer or "").strip(), (enotes or "").strip()]
            note = "\n\n".join(p for p in parts if p)

            answers.append({
                "countries": [code],
                "row": q["sourceRow"],
                "score": tier["score"],
                "basis": "national",
                "sourceId": src_ids[key],
                "note": note,
            })
        report.append(f"{code}: {len(matched)}/{len(questions)} questions answered")

    old["README"] = (
        "Researched answers imported from input/*Ouput Rev 8.xlsx by scripts/import_output_sheets.py. "
        "Keyed by the question's row in the source spreadsheet. Each answer's score is the rubric tier named "
        "by the sheet's Answer Category Statement; the sheet's own 0-10 score is kept in the note."
    )
    old["sources"], old["answers"] = sources, answers
    (DATA / "sourced-answers.json").write_text(json.dumps(old, indent=2, ensure_ascii=False) + "\n")

    ind = json.loads((DATA / "indicator-answers.json").read_text())
    ind["sources"], ind["answers"] = {}, []
    (DATA / "indicator-answers.json").write_text(json.dumps(ind, indent=2, ensure_ascii=False) + "\n")

    for q in questions:
        q.pop("seedAnswers", None)
    seed["countries"] = countries
    seed_path.write_text(json.dumps(seed, indent=2, ensure_ascii=False) + "\n")

    print("\n".join(report))
    print(f"{len(answers)} answers, {len(sources)} sources, {len(countries)} countries")


if __name__ == "__main__":
    main()
