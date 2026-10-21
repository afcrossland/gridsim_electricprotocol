"""Public suggestions and question proposals, and editors' review of them (ROADMAP.md, Phase 6).

Anyone can file one - no sign-in, as the Policy Explorer's "Suggest a correction" and "Propose a
new policy question" dialogs always allowed - and editors see every one, from any device:

- POST /api/policy/suggestions                         public: a correction to a country's answers
- POST /api/policy/question-proposals                  public: a new question
- GET  /api/policy/review                              editors: everything filed, oldest first
- PUT  /api/policy/suggestions/{id}/status             editors: pending / accepted / rejected
- PUT  /api/policy/question-proposals/{id}/status      editors: the same, plus the question it became

Recording a decision is all the server does: accepting a correction changes answers, and
accepting a proposal adds a question, through the ordinary editor writes (ep_db/writes.py) that
the Policy Explorer sends alongside it.

The public endpoints are guarded against abuse in proportion to what they risk - nothing filed
here is shown to anyone but editors, and nothing changes until an editor accepts it: every field
has a size limit, a hidden form field (`website`) that people never see but form-filling bots do
is quietly discarded, and each visitor can file at most RATE_LIMIT a RATE_WINDOW_S per gate
instance (in memory - Cloud Run runs at most two).
"""

import json
import time
import uuid
from collections import defaultdict, deque
from typing import Any, Literal

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ep_db.api import NO_STORE, _engine, database_url_or_503
from ep_db.auth import Editor
from ep_db.models import AuditLog, Jurisdiction, Question, QuestionProposal, Section, Suggestion

router = APIRouter(prefix="/api/policy")

RATE_LIMIT = 10
RATE_WINDOW_S = 60 * 60
MAX_JSON_BYTES = 200_000

_recent: dict[str, deque[float]] = defaultdict(deque)

Status = Literal["pending", "accepted", "rejected"]
Name = Field(min_length=1, max_length=200)
Organisation = Field(default="", max_length=200)


class SuggestionIn(BaseModel):
    countryCode: str = Field(min_length=1, max_length=16)
    submitterName: str = Name
    submitterOrganisation: str = Organisation
    # The frontend's own shapes (src/lib/suggestions.ts), kept as they are.
    changes: list[dict[str, Any]] = Field(min_length=1, max_length=200)
    baseline: list[dict[str, Any]] = Field(max_length=200)
    proposed: list[dict[str, Any]] = Field(max_length=200)
    website: str = ""  # honeypot


class ProposalIn(BaseModel):
    sectionId: str = Field(min_length=1, max_length=200)
    text: str = Field(min_length=1, max_length=2000)
    strongLabel: str = Field(min_length=1, max_length=1000)
    developedLabel: str = Field(default="", max_length=1000)
    weakLabel: str = Field(min_length=1, max_length=1000)
    reason: str = Field(default="", max_length=4000)
    source: str = Field(default="", max_length=2000)
    submitterName: str = Name
    submitterOrganisation: str = Organisation
    website: str = ""  # honeypot


class SuggestionStatusIn(BaseModel):
    status: Status


class ProposalStatusIn(BaseModel):
    status: Status
    questionId: str | None = None


def _client(request: Request) -> str:
    # Firebase Hosting -> Cloud Run: the visitor is the first X-Forwarded-For entry.
    forwarded = request.headers.get("x-forwarded-for", "")
    return forwarded.split(",")[0].strip() or (request.client.host if request.client else "unknown")


def _rate_limit(request: Request) -> None:
    now = time.monotonic()
    times = _recent[_client(request)]
    while times and times[0] <= now - RATE_WINDOW_S:
        times.popleft()
    if len(times) >= RATE_LIMIT:
        raise HTTPException(429, "Too many submissions from here - please try again later.")
    times.append(now)


def _session() -> Session:
    return Session(_engine(database_url_or_503()))


def _ok(body: Any) -> JSONResponse:
    return JSONResponse(body, headers=NO_STORE)


def _new_id(kind: str) -> str:
    return f"{kind}-{uuid.uuid4().hex[:12]}"


def _filed(new_id: str) -> JSONResponse:
    """What a submission gets back - also what the honeypot gets, so bots learn nothing."""
    return _ok({"id": new_id, "status": "pending"})


@router.post("/suggestions")
def submit_suggestion(body: SuggestionIn, request: Request) -> JSONResponse:
    if body.website:
        return _filed(_new_id("sg"))
    if len(json.dumps([body.changes, body.baseline, body.proposed])) > MAX_JSON_BYTES:
        raise HTTPException(413, "That suggestion is too large.")
    _rate_limit(request)
    with _session() as session, session.begin():
        if session.get(Jurisdiction, body.countryCode) is None:
            raise HTTPException(404, f"No jurisdiction {body.countryCode}.")
        sid = _new_id("sg")
        session.add(
            Suggestion(
                id=sid,
                country_code=body.countryCode,
                submitter_name=body.submitterName.strip(),
                submitter_organisation=body.submitterOrganisation.strip(),
                changes=body.changes,
                baseline=body.baseline,
                proposed=body.proposed,
            )
        )
        session.add(AuditLog(actor="public", entity="suggestion", entity_key=sid, action="submit",
                             after={"countryCode": body.countryCode, "submitterName": body.submitterName.strip()}))
    return _filed(sid)


@router.post("/question-proposals")
def submit_proposal(body: ProposalIn, request: Request) -> JSONResponse:
    if body.website:
        return _filed(_new_id("qp"))
    _rate_limit(request)
    with _session() as session, session.begin():
        if session.get(Section, body.sectionId) is None:
            raise HTTPException(404, f"No section {body.sectionId}.")
        pid = _new_id("qp")
        fields = body.model_dump(exclude={"website", "sectionId", "submitterName", "submitterOrganisation"})
        session.add(
            QuestionProposal(
                id=pid,
                section_id=body.sectionId,
                text=fields["text"].strip(),
                strong_label=fields["strongLabel"].strip(),
                developed_label=fields["developedLabel"].strip(),
                weak_label=fields["weakLabel"].strip(),
                reason=fields["reason"].strip(),
                source=fields["source"].strip(),
                submitter_name=body.submitterName.strip(),
                submitter_organisation=body.submitterOrganisation.strip(),
            )
        )
        session.add(AuditLog(actor="public", entity="question_proposal", entity_key=pid, action="submit",
                             after={"sectionId": body.sectionId, "submitterName": body.submitterName.strip()}))
    return _filed(pid)


@router.get("/review")
def review(email: str = Editor) -> JSONResponse:
    """Everything filed, in the frontend's Suggestion / QuestionProposal shapes."""
    with _session() as session:
        names = dict(session.execute(select(Jurisdiction.code, Jurisdiction.name)).all())
        titles = dict(session.execute(select(Section.id, Section.title)).all())
        suggestions = [
            {
                "id": s.id,
                "countryCode": s.country_code,
                "countryName": names.get(s.country_code, s.country_code),
                "submitterName": s.submitter_name,
                "submitterOrganisation": s.submitter_organisation,
                "submittedAt": s.submitted_at.isoformat(),
                "status": s.status,
                "changes": s.changes,
                "baseline": s.baseline,
                "proposed": s.proposed,
            }
            for s in session.scalars(select(Suggestion).order_by(Suggestion.submitted_at, Suggestion.id))
        ]
        proposals = [
            {
                "id": p.id,
                "sectionId": p.section_id,
                "sectionTitle": titles.get(p.section_id, p.section_id),
                "text": p.text,
                "strongLabel": p.strong_label,
                "developedLabel": p.developed_label,
                "weakLabel": p.weak_label,
                "reason": p.reason,
                "source": p.source,
                "submitterName": p.submitter_name,
                "submitterOrganisation": p.submitter_organisation,
                "submittedAt": p.submitted_at.isoformat(),
                "status": p.status,
                **({"questionId": p.question_id} if p.question_id else {}),
            }
            for p in session.scalars(select(QuestionProposal).order_by(QuestionProposal.submitted_at, QuestionProposal.id))
        ]
    return _ok({"suggestions": suggestions, "questionProposals": proposals})


def _decide(session: Session, row, email: str, entity: str, before: dict, after: dict) -> None:
    row.reviewed_by = email
    row.reviewed_at = func.now()
    session.add(AuditLog(actor=email, entity=entity, entity_key=row.id, action="review", before=before, after=after))


@router.put("/suggestions/{suggestion_id}/status")
def set_suggestion_status(suggestion_id: str, body: SuggestionStatusIn, email: str = Editor) -> JSONResponse:
    with _session() as session, session.begin():
        s = session.get(Suggestion, suggestion_id)
        if s is None:
            raise HTTPException(404, f"No suggestion {suggestion_id}.")
        before = {"status": s.status}
        s.status = body.status
        _decide(session, s, email, "suggestion", before, {"status": body.status})
    return _ok({"ok": True})


@router.put("/question-proposals/{proposal_id}/status")
def set_proposal_status(proposal_id: str, body: ProposalStatusIn, email: str = Editor) -> JSONResponse:
    with _session() as session, session.begin():
        p = session.get(QuestionProposal, proposal_id)
        if p is None:
            raise HTTPException(404, f"No question proposal {proposal_id}.")
        if body.questionId is not None and session.get(Question, body.questionId) is None:
            raise HTTPException(409, f"No question {body.questionId} yet - save it first.")
        before = {"status": p.status, "questionId": p.question_id}
        p.status = body.status
        p.question_id = body.questionId
        _decide(session, p, email, "question_proposal", before, {"status": body.status, "questionId": body.questionId})
    return _ok({"ok": True})
