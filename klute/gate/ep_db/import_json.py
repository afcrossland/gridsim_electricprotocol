"""Load the policy tool's JSON data into the policy database (ROADMAP.md, Phase 0).

    cd klute/gate
    DATABASE_URL=postgresql+psycopg://... python -m ep_db.import_json            # import
    DATABASE_URL=postgresql+psycopg://... python -m ep_db.import_json --check    # compare only

Reads `src/data/protocol.seed.json`, `sourced-answers.json`, `indicator-answers.json` and
`jurisdictions.json`. What happens to each table depends on who owns it (see models.py):

- Imported research (sources, groups, researched answers) is replaced wholesale on every run.
- The protocol's structure and the jurisdictions are inserted on the first run only. Once they
  exist, admins own them; `--overwrite-structure` updates them from JSON again, and refuses to
  remove anything a person's response, suggestion or proposal still points at.
- Responses, evidence, suggestions and proposals are never touched.

`--check` writes nothing: it exports the database back into the four files' shapes and fails if
they differ from the files (only the answers files' README text isn't stored). That is the
evidence Phase 1 needs that the database serves exactly what the JSON does today. Once editors
change questions and sections in the app (Phase 4), `--check --research-only` compares just the
imported research, and `--overwrite-structure` would throw their work away - don't use it.

Everything runs in one transaction, so a failed import leaves the database as it was. Any key the
script doesn't know about fails the run rather than being silently dropped.
"""

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

from ep_db.db import database_url, engine
from ep_db.models import (
    AuditLog,
    Jurisdiction,
    JurisdictionGroupMember,
    Protocol,
    ProtocolCountry,
    Question,
    ResearchedAnswer,
    RubricTier,
    Section,
    Source,
)

def default_data_dir() -> Path:
    """`src/data` in this repo (klute/gate/ep_db/ is three levels down). Only worked out when
    needed: the gate's image holds ep_db without the repo around it, and the API imports this
    module there."""
    return Path(__file__).resolve().parents[3] / "src" / "data"

ANSWER_FILES = {"sourced": "sourced-answers.json", "indicator": "indicator-answers.json"}


class DataError(Exception):
    """A data problem the files need fixing for, as opposed to a bug here."""


def _keys(obj: dict, required: set[str], optional: set[str], where: str) -> None:
    missing = required - obj.keys()
    unknown = obj.keys() - required - optional
    if missing or unknown:
        raise DataError(f"{where}: missing {sorted(missing)}, unknown {sorted(unknown)}")


def load_files(data_dir: Path | None = None) -> dict[str, Any]:
    data_dir = data_dir or default_data_dir()
    files = {"protocol": "protocol.seed.json", "jurisdictions": "jurisdictions.json", **ANSWER_FILES}
    return {name: json.loads((data_dir / file).read_text()) for name, file in files.items()}


# --- Import -------------------------------------------------------------------------------------


def _import_research(session: Session, files: dict[str, Any]) -> dict[str, int]:
    session.execute(delete(ResearchedAnswer))
    session.execute(delete(JurisdictionGroupMember))
    session.execute(delete(Source))
    session.flush()

    seen_sources: dict[str, str] = {}
    seen_groups: dict[str, str] = {}
    counts = {"sources": 0, "groups": 0, "answers": 0}
    for origin, file in ANSWER_FILES.items():
        data = files[origin]
        _keys(data, {"sources", "groups", "answers"}, {"README"}, file)

        for position, (source_id, source) in enumerate(data["sources"].items()):
            _keys(source, {"title", "url"}, {"quality"}, f"{file} source {source_id}")
            # sourcedAnswers.ts lets a hand-written source silently replace an indicator one with
            # the same id; refusing it here makes that a decision rather than an accident.
            if source_id in seen_sources:
                raise DataError(f"source {source_id} is in both {seen_sources[source_id]} and {file}")
            seen_sources[source_id] = file
            session.add(Source(id=source_id, origin=origin, position=position, **source))
            counts["sources"] += 1

        for group_name, codes in data["groups"].items():
            if group_name in seen_groups:
                raise DataError(f"group {group_name} is in both {seen_groups[group_name]} and {file}")
            seen_groups[group_name] = file
            for position, code in enumerate(codes):
                session.add(JurisdictionGroupMember(group_name=group_name, position=position, code=code, origin=origin))
            counts["groups"] += 1

        session.flush()  # sources must exist before answers point at them
        for position, answer in enumerate(data["answers"]):
            where = f"{file} answer #{position}"
            _keys(answer, {"row", "score", "basis", "sourceId", "note"}, {"group", "countries"}, where)
            if ("group" in answer) == ("countries" in answer):
                raise DataError(f"{where}: needs exactly one of group / countries")
            if answer["sourceId"] not in data["sources"]:
                raise DataError(f"{where}: unknown source {answer['sourceId']}")
            session.add(
                ResearchedAnswer(
                    origin=origin,
                    position=position,
                    group_name=answer.get("group"),
                    countries=answer.get("countries"),
                    question_row=answer["row"],
                    score=answer["score"],
                    basis=answer["basis"],
                    source_id=answer["sourceId"],
                    note=answer["note"],
                )
            )
            counts["answers"] += 1
    return counts


def _import_structure(session: Session, protocol: dict) -> dict[str, int]:
    _keys(
        protocol,
        {"title", "source", "maxScore", "completenessThreshold", "glossary", "sections", "countries", "questions"},
        set(),
        "protocol.seed.json",
    )
    session.merge(
        Protocol(
            id=1,
            title=protocol["title"],
            source=protocol["source"],
            max_score=protocol["maxScore"],
            completeness_threshold=protocol["completenessThreshold"],
            glossary=protocol["glossary"],
        )
    )

    for position, country in enumerate(protocol["countries"]):
        _keys(country, {"code", "name"}, set(), f"protocol.seed.json country #{position}")
        session.merge(ProtocolCountry(position=position, **country))

    for position, section in enumerate(protocol["sections"]):
        _keys(section, {"id", "title", "order"}, {"sourceRow"}, f"protocol.seed.json section #{position}")
        session.merge(
            Section(
                id=section["id"],
                title=section["title"],
                sort_order=section["order"],
                source_row=section.get("sourceRow"),
                position=position,
            )
        )
    session.flush()

    question_ids = [q["id"] for q in protocol["questions"]]
    session.execute(delete(RubricTier).where(RubricTier.question_id.in_(question_ids)))
    for position, question in enumerate(protocol["questions"]):
        where = f"protocol.seed.json question {question.get('id', position)}"
        _keys(question, {"id", "sectionId", "subsection", "order", "text", "weight", "rubric"}, {"sourceRow"}, where)
        session.merge(
            Question(
                id=question["id"],
                section_id=question["sectionId"],
                subsection=question["subsection"],
                sort_order=question["order"],
                text=question["text"],
                weight=question["weight"],
                source_row=question.get("sourceRow"),
                position=position,
            )
        )
        for tier_position, tier in enumerate(question["rubric"]):
            _keys(tier, {"score", "label", "points"}, set(), f"{where} rubric #{tier_position}")
            session.add(RubricTier(question_id=question["id"], position=tier_position, **tier))
    session.flush()

    # Anything no longer in the file goes - unless something a person did still points at it,
    # in which case the foreign keys stop the whole run.
    session.execute(delete(Question).where(Question.id.not_in(question_ids)))
    session.execute(delete(Section).where(Section.id.not_in([s["id"] for s in protocol["sections"]])))
    session.execute(
        delete(ProtocolCountry).where(ProtocolCountry.code.not_in([c["code"] for c in protocol["countries"]]))
    )
    return {"sections": len(protocol["sections"]), "questions": len(question_ids)}


def _import_jurisdictions(session: Session, jurisdictions: list[dict]) -> int:
    by_code = {}
    for position, j in enumerate(jurisdictions):
        _keys(j, {"code", "name", "level", "parent", "region", "mappable"}, set(), f"jurisdictions.json #{position}")
        if j["code"] in by_code:
            raise DataError(f"jurisdictions.json: {j['code']} appears twice")
        by_code[j["code"]] = (position, j)

    # Parents first, so the self-referencing foreign key holds at every insert.
    done: set[str] = set()

    def add(code: str, trail: tuple[str, ...] = ()) -> None:
        if code in done:
            return
        if code in trail:
            raise DataError(f"jurisdictions.json: parent cycle {' -> '.join(trail + (code,))}")
        position, j = by_code[code]
        if j["parent"] is not None:
            if j["parent"] not in by_code:
                raise DataError(f"jurisdictions.json: {code}'s parent {j['parent']} isn't listed")
            add(j["parent"], trail + (code,))
        session.merge(Jurisdiction(position=position, **j))
        session.flush()
        done.add(code)

    for code in by_code:
        add(code)
    session.execute(delete(Jurisdiction).where(Jurisdiction.code.not_in(list(by_code))))
    return len(by_code)


def import_all(session: Session, files: dict[str, Any], *, overwrite_structure: bool, actor: str) -> dict[str, Any]:
    summary: dict[str, Any] = {"research": _import_research(session, files)}

    has_structure = session.get(Protocol, 1) is not None
    if has_structure and not overwrite_structure:
        summary["structure"] = "kept (already in the database; --overwrite-structure to update)"
    else:
        summary["structure"] = _import_structure(session, files["protocol"])
        summary["jurisdictions"] = _import_jurisdictions(session, files["jurisdictions"])

    session.add(AuditLog(actor=actor, entity="import", entity_key="src/data", action="import_json", after=summary))
    return summary


# --- Export (for --check, and the shapes Phase 1's read endpoints will serve) -------------------


def export_all(session: Session) -> dict[str, Any]:
    protocol = session.get(Protocol, 1)
    if protocol is None:
        raise DataError("the database has no protocol yet - run the import first")

    tiers: dict[str, list[dict]] = {}
    for t in session.scalars(select(RubricTier).order_by(RubricTier.question_id, RubricTier.position)):
        tiers.setdefault(t.question_id, []).append({"score": t.score, "label": t.label, "points": t.points})

    def with_row(obj: dict, source_row: int | None) -> dict:
        return obj if source_row is None else {**obj, "sourceRow": source_row}

    out: dict[str, Any] = {
        "protocol": {
            "title": protocol.title,
            "source": protocol.source,
            "maxScore": protocol.max_score,
            "completenessThreshold": protocol.completeness_threshold,
            "glossary": list(protocol.glossary),
            "sections": [
                with_row({"id": s.id, "title": s.title, "order": s.sort_order}, s.source_row)
                for s in session.scalars(select(Section).order_by(Section.position))
            ],
            "countries": [
                {"code": c.code, "name": c.name}
                for c in session.scalars(select(ProtocolCountry).order_by(ProtocolCountry.position))
            ],
            "questions": [
                with_row(
                    {
                        "id": q.id,
                        "sectionId": q.section_id,
                        "subsection": q.subsection,
                        "order": q.sort_order,
                        "text": q.text,
                        "weight": q.weight,
                        "rubric": tiers.get(q.id, []),
                    },
                    q.source_row,
                )
                for q in session.scalars(select(Question).order_by(Question.position))
            ],
        },
        "jurisdictions": [
            {"code": j.code, "name": j.name, "level": j.level, "parent": j.parent, "region": j.region, "mappable": j.mappable}
            for j in session.scalars(select(Jurisdiction).order_by(Jurisdiction.position))
        ],
    }

    for origin in ANSWER_FILES:
        sources = {}
        for s in session.scalars(select(Source).where(Source.origin == origin).order_by(Source.position)):
            sources[s.id] = {"title": s.title, "url": s.url} | ({"quality": s.quality} if s.quality else {})
        groups: dict[str, list[str]] = {}
        members = select(JurisdictionGroupMember).where(JurisdictionGroupMember.origin == origin)
        for m in session.scalars(members.order_by(JurisdictionGroupMember.group_name, JurisdictionGroupMember.position)):
            groups.setdefault(m.group_name, []).append(m.code)
        answers = []
        for a in session.scalars(
            select(ResearchedAnswer).where(ResearchedAnswer.origin == origin).order_by(ResearchedAnswer.position)
        ):
            target = {"group": a.group_name} if a.group_name is not None else {"countries": list(a.countries)}
            answers.append(
                target
                | {"row": a.question_row, "score": a.score, "basis": a.basis, "sourceId": a.source_id, "note": a.note}
            )
        out[origin] = {"sources": sources, "groups": groups, "answers": answers}
    return out


def differences(expected: Any, actual: Any, path: str = "") -> list[str]:
    """Human-readable paths where two JSON values differ. Dict key order is ignored (it carries no
    meaning in these files); list order is not."""
    if isinstance(expected, dict) and isinstance(actual, dict):
        out = []
        for key in expected.keys() | actual.keys():
            if key not in actual:
                out.append(f"{path}.{key}: missing from database")
            elif key not in expected:
                out.append(f"{path}.{key}: only in database")
            else:
                out += differences(expected[key], actual[key], f"{path}.{key}")
        return out
    if isinstance(expected, list) and isinstance(actual, list):
        if len(expected) != len(actual):
            return [f"{path}: {len(expected)} items in file, {len(actual)} in database"]
        return [d for i, (e, a) in enumerate(zip(expected, actual)) for d in differences(e, a, f"{path}[{i}]")]
    # bool is an int in Python, so compare types too - True must not equal 1.
    if expected != actual or isinstance(expected, bool) != isinstance(actual, bool):
        return [f"{path}: file {expected!r}, database {actual!r}"]
    return []


def check(session: Session, files: dict[str, Any], *, research_only: bool = False) -> list[str]:
    """research_only compares just the imported research (sources, groups, answers): once editors
    change questions and sections in the app (Phase 4), those rightly differ from the files."""
    expected = dict(files)
    for origin in ANSWER_FILES:
        expected[origin] = {k: v for k, v in files[origin].items() if k != "README"}
    actual = export_all(session)
    if research_only:
        expected = {o: expected[o] for o in ANSWER_FILES}
        actual = {o: actual[o] for o in ANSWER_FILES}
    return differences(expected, actual)


# --- CLI ----------------------------------------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--data-dir", type=Path, help="default: src/data in this repo")
    parser.add_argument("--check", action="store_true", help="compare the database with the files; write nothing")
    parser.add_argument("--research-only", action="store_true", help="with --check: compare only the imported research")
    parser.add_argument("--overwrite-structure", action="store_true", help="update sections/questions/jurisdictions from JSON")
    parser.add_argument("--actor", default=os.environ.get("USER", "import_json"), help="recorded in audit_log")
    args = parser.parse_args(argv)

    url = make_url(database_url())
    print(f"Database: {url.host}:{url.port or 5432}/{url.database} as {url.username}", file=sys.stderr)
    files = load_files(args.data_dir)

    try:
        with Session(engine()) as session:
            if args.check:
                diffs = check(session, files, research_only=args.research_only)
                for d in diffs[:50]:
                    print(d)
                if len(diffs) > 50:
                    print(f"... and {len(diffs) - 50} more")
                print("Matches the JSON files." if not diffs else f"{len(diffs)} differences.", file=sys.stderr)
                return 1 if diffs else 0

            with session.begin():
                summary = import_all(session, files, overwrite_structure=args.overwrite_structure, actor=args.actor)
            print(json.dumps(summary, indent=2))
            return 0
    except DataError as e:
        print(f"Import failed, nothing written: {e}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
