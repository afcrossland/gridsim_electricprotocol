"""Editors' changes to the policy data (ROADMAP.md, Phase 4).

Every endpoint needs a signed-in editor (`Editor`, ep_db/auth.py) and records what it changed in
`audit_log` - who, when, before and after - in the same transaction as the change itself.

Writes are whole-object puts, last write wins: the Policy Explorer sends the current state of a
section, question or answer after an edit settles (src/lib/policySync.ts), never a diff.

- PUT    /api/policy/responses/{country}/{question}  an answer: score (null = cleared) + evidence
- PUT    /api/policy/sections/{id}                     create or update a section
- DELETE /api/policy/sections/{id}                     with its questions and their answers
- PUT    /api/policy/questions/{id}                    create or update a question and its rubric
- DELETE /api/policy/questions/{id}                    with its answers
- PUT    /api/policy/protocol                          protocol-wide settings
"""

from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from ep_db.api import NO_STORE, _engine, database_url_or_503
from ep_db.auth import Editor
from ep_db.models import (
    BASES,
    AuditLog,
    Jurisdiction,
    Protocol,
    Question,
    Response,
    ResponseEvidence,
    RubricTier,
    Section,
)

router = APIRouter(prefix="/api/policy")


class EvidenceIn(BaseModel):
    title: str = ""
    source: str = ""
    note: str = ""


class ResponseIn(BaseModel):
    score: int | None
    basis: str | None = None
    evidence: list[EvidenceIn] = []


class SectionIn(BaseModel):
    title: str = Field(min_length=1)
    order: int


class TierIn(BaseModel):
    score: int
    label: str
    points: float = Field(ge=0)


class QuestionIn(BaseModel):
    sectionId: str
    subsection: str | None = None
    order: int
    text: str = Field(min_length=1)
    weight: float = Field(ge=0)
    rubric: list[TierIn] = Field(min_length=1)


class ProtocolIn(BaseModel):
    completenessThreshold: float = Field(ge=0, le=1)


# --- Shapes the audit log records (and the frontend's own field names) --------------------------


def _response_json(session: Session, r: Response | None) -> dict | None:
    if r is None:
        return None
    evidence = session.scalars(
        select(ResponseEvidence)
        .where(ResponseEvidence.country_code == r.country_code, ResponseEvidence.question_id == r.question_id)
        .order_by(ResponseEvidence.position)
    )
    return {
        "score": r.score,
        "basis": r.basis,
        "evidence": [{"title": e.title, "source": e.source, "note": e.note} for e in evidence],
    }


def _section_json(s: Section | None) -> dict | None:
    return None if s is None else {"title": s.title, "order": s.sort_order}


def _question_json(session: Session, q: Question | None) -> dict | None:
    if q is None:
        return None
    tiers = session.scalars(select(RubricTier).where(RubricTier.question_id == q.id).order_by(RubricTier.position))
    return {
        "sectionId": q.section_id,
        "subsection": q.subsection,
        "order": q.sort_order,
        "text": q.text,
        "weight": q.weight,
        "rubric": [{"score": t.score, "label": t.label, "points": t.points} for t in tiers],
    }


def _audit(session: Session, actor: str, entity: str, key: str, action: str, before: Any, after: Any) -> None:
    session.add(AuditLog(actor=actor, entity=entity, entity_key=key, action=action, before=before, after=after))


def _session() -> Session:
    return Session(_engine(database_url_or_503()))


def _ok(body: Any = None) -> JSONResponse:
    return JSONResponse(body if body is not None else {"ok": True}, headers=NO_STORE)


def _next_position(session: Session, model) -> int:
    return (session.scalar(select(func.max(model.position))) or 0) + 1


def _delete_answers(session: Session, actor: str, question_id: str) -> None:
    for r in session.scalars(select(Response).where(Response.question_id == question_id)).all():
        _audit(session, actor, "response", f"{r.country_code}/{question_id}", "delete", _response_json(session, r), None)
        session.delete(r)


# --- Answers ------------------------------------------------------------------------------------


@router.put("/responses/{country}/{question_id}")
def put_response(country: str, question_id: str, body: ResponseIn, email: str = Editor) -> JSONResponse:
    if body.basis is not None and body.basis not in BASES:
        raise HTTPException(422, f"basis must be one of {', '.join(BASES)}")
    with _session() as session, session.begin():
        if session.get(Jurisdiction, country) is None:
            raise HTTPException(404, f"No jurisdiction {country}.")
        question = session.get(Question, question_id)
        if question is None:
            raise HTTPException(404, f"No question {question_id}.")
        scores = set(session.scalars(select(RubricTier.score).where(RubricTier.question_id == question_id)))
        if body.score is not None and body.score not in scores:
            raise HTTPException(422, f"{question_id} has no answer tier {body.score}.")

        existing = session.get(Response, (country, question_id))
        before = _response_json(session, existing)
        if existing is None:
            existing = Response(country_code=country, question_id=question_id)
            session.add(existing)
        existing.score = body.score
        existing.basis = body.basis
        existing.updated_by = email
        existing.updated_at = func.now()
        session.flush()
        session.execute(
            delete(ResponseEvidence).where(
                ResponseEvidence.country_code == country, ResponseEvidence.question_id == question_id
            )
        )
        for position, e in enumerate(body.evidence):
            session.add(ResponseEvidence(country_code=country, question_id=question_id, position=position, **e.model_dump()))
        session.flush()
        _audit(session, email, "response", f"{country}/{question_id}", "put", before, _response_json(session, existing))
    return _ok()


# --- Sections -----------------------------------------------------------------------------------


@router.put("/sections/{section_id}")
def put_section(section_id: str, body: SectionIn, email: str = Editor) -> JSONResponse:
    with _session() as session, session.begin():
        section = session.get(Section, section_id)
        before = _section_json(section)
        if section is None:
            section = Section(id=section_id, position=_next_position(session, Section))
            session.add(section)
        section.title = body.title
        section.sort_order = body.order
        _audit(session, email, "section", section_id, "put", before, _section_json(section))
    return _ok()


@router.delete("/sections/{section_id}")
def delete_section(section_id: str, email: str = Editor) -> JSONResponse:
    with _session() as session, session.begin():
        section = session.get(Section, section_id)
        if section is None:
            return _ok()  # already gone - deletes are idempotent
        for q in session.scalars(select(Question).where(Question.section_id == section_id)).all():
            _delete_answers(session, email, q.id)
            _audit(session, email, "question", q.id, "delete", _question_json(session, q), None)
            session.delete(q)
        session.flush()
        _audit(session, email, "section", section_id, "delete", _section_json(section), None)
        session.delete(section)
    return _ok()


# --- Questions ----------------------------------------------------------------------------------


@router.put("/questions/{question_id}")
def put_question(question_id: str, body: QuestionIn, email: str = Editor) -> JSONResponse:
    if len({t.score for t in body.rubric}) != len(body.rubric):
        raise HTTPException(422, "Each answer tier needs its own score.")
    with _session() as session, session.begin():
        if session.get(Section, body.sectionId) is None:
            raise HTTPException(404, f"No section {body.sectionId}.")
        question = session.get(Question, question_id)
        before = _question_json(session, question)
        if question is None:
            question = Question(id=question_id, position=_next_position(session, Question))
            session.add(question)
        question.section_id = body.sectionId
        question.subsection = body.subsection
        question.sort_order = body.order
        question.text = body.text
        question.weight = body.weight
        session.flush()
        session.execute(delete(RubricTier).where(RubricTier.question_id == question_id))
        for position, t in enumerate(body.rubric):
            session.add(RubricTier(question_id=question_id, position=position, **t.model_dump()))
        session.flush()
        _audit(session, email, "question", question_id, "put", before, _question_json(session, question))
    return _ok()


@router.delete("/questions/{question_id}")
def delete_question(question_id: str, email: str = Editor) -> JSONResponse:
    with _session() as session, session.begin():
        question = session.get(Question, question_id)
        if question is None:
            return _ok()
        _delete_answers(session, email, question_id)
        session.flush()
        _audit(session, email, "question", question_id, "delete", _question_json(session, question), None)
        session.delete(question)
    return _ok()


# --- Protocol settings --------------------------------------------------------------------------


@router.put("/protocol")
def put_protocol(body: ProtocolIn, email: str = Editor) -> JSONResponse:
    with _session() as session, session.begin():
        protocol = session.get(Protocol, 1)
        if protocol is None:
            raise HTTPException(409, "The database has no protocol yet - run the import first.")
        before = {"completenessThreshold": protocol.completeness_threshold}
        protocol.completeness_threshold = body.completenessThreshold
        _audit(session, email, "protocol", "1", "put", before, body.model_dump())
    return _ok()
