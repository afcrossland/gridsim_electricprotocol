"""The Electric Futures policy database (decision 1 in ROADMAP.md).

Lives in its own Postgres database on the shared gridsim Cloud SQL instance, under the `policy`
schema. Two kinds of data are kept in separate tables so neither can overwrite the other:

- Imported research - `sources`, `jurisdiction_groups`, `researched_answers` - mirrors
  `src/data/sourced-answers.json` and `indicator-answers.json` entry for entry, unresolved. The
  spreadsheet import owns these tables and replaces them wholesale.
- Things people do in the app - `responses`, `response_evidence`, `suggestions`,
  `question_proposals`, `audit_log` - are never touched by an import.

The protocol's structure (`protocol`, `sections`, `questions`, `rubric_tiers`) and `jurisdictions`
are seeded from JSON once and then edited by admins.

Every table that mirrors a JSON list keeps a `position` so the list comes back in the same order:
answer order decides which of two equally specific, equally well-based answers wins in
`src/data/sourcedAnswers.ts`.
"""

from datetime import datetime

from sqlalchemy import (
    ARRAY,
    BigInteger,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    ForeignKeyConstraint,
    Integer,
    MetaData,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

SCHEMA = "policy"

BASES = ("national", "directive-baseline", "proxy-indicator")
REVIEW_STATUSES = ("pending", "accepted", "rejected")


def _in(column: str, values: tuple[str, ...]) -> str:
    return f"{column} IN ({', '.join(repr(v) for v in values)})"


class Base(DeclarativeBase):
    metadata = MetaData(
        schema=SCHEMA,
        naming_convention={
            "pk": "pk_%(table_name)s",
            "fk": "fk_%(table_name)s_%(column_0_name)s",
            "uq": "uq_%(table_name)s_%(column_0_name)s",
            "ck": "ck_%(table_name)s_%(constraint_name)s",
            "ix": "ix_%(table_name)s_%(column_0_name)s",
        },
    )


# --- Protocol structure -------------------------------------------------------------------------


class Protocol(Base):
    """The single row of protocol-wide settings from `protocol.seed.json`."""

    __tablename__ = "protocol"
    __table_args__ = (CheckConstraint("id = 1", name="single_row"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    title: Mapped[str] = mapped_column(Text)
    source: Mapped[str] = mapped_column(Text)
    max_score: Mapped[int] = mapped_column(Integer)
    completeness_threshold: Mapped[float] = mapped_column(Float)
    glossary: Mapped[list[str]] = mapped_column(ARRAY(Text))


class ProtocolCountry(Base):
    """`protocol.seed.json`'s own `countries` list - the countries the source workbook covered."""

    __tablename__ = "protocol_countries"

    code: Mapped[str] = mapped_column(String(16), primary_key=True)
    name: Mapped[str] = mapped_column(Text)
    position: Mapped[int] = mapped_column(Integer)


class Section(Base):
    __tablename__ = "sections"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    title: Mapped[str] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(Integer)
    source_row: Mapped[int | None] = mapped_column(Integer)
    position: Mapped[int] = mapped_column(Integer)


class Question(Base):
    __tablename__ = "questions"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    section_id: Mapped[str] = mapped_column(ForeignKey("sections.id"), index=True)
    subsection: Mapped[str | None] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(Integer)
    text: Mapped[str] = mapped_column(Text)
    weight: Mapped[float] = mapped_column(Float)
    # Researched answers address a question by its row in the source spreadsheet.
    source_row: Mapped[int | None] = mapped_column(Integer, unique=True)
    position: Mapped[int] = mapped_column(Integer)


class RubricTier(Base):
    __tablename__ = "rubric_tiers"

    question_id: Mapped[str] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"), primary_key=True)
    score: Mapped[int] = mapped_column(Integer, primary_key=True)
    label: Mapped[str] = mapped_column(Text)
    points: Mapped[float] = mapped_column(Float)
    position: Mapped[int] = mapped_column(Integer)


# --- Jurisdictions ------------------------------------------------------------------------------


class Jurisdiction(Base):
    __tablename__ = "jurisdictions"

    code: Mapped[str] = mapped_column(String(16), primary_key=True)
    name: Mapped[str] = mapped_column(Text)
    level: Mapped[str] = mapped_column(Text)
    parent: Mapped[str | None] = mapped_column(ForeignKey("jurisdictions.code"), index=True)
    region: Mapped[str | None] = mapped_column(Text)
    mappable: Mapped[bool]
    position: Mapped[int] = mapped_column(Integer)


# --- Imported research --------------------------------------------------------------------------


class Source(Base):
    __tablename__ = "sources"
    __table_args__ = (
        CheckConstraint("quality IN ('primary-official', 'secondary')", name="quality"),
        CheckConstraint("origin IN ('sourced', 'indicator')", name="origin"),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    title: Mapped[str] = mapped_column(Text)
    url: Mapped[str] = mapped_column(Text)
    quality: Mapped[str | None] = mapped_column(Text)
    # Which file the source came from: "sourced" or "indicator".
    origin: Mapped[str] = mapped_column(Text)
    position: Mapped[int] = mapped_column(Integer)


class JurisdictionGroupMember(Base):
    """A named bloc answers can be addressed to (EU27, NEM, ...). Members aren't foreign keys:
    the frontend resolves them, and warns rather than fails on an unknown code."""

    __tablename__ = "jurisdiction_groups"
    __table_args__ = (CheckConstraint("origin IN ('sourced', 'indicator')", name="origin"),)

    group_name: Mapped[str] = mapped_column(Text, primary_key=True)
    position: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(16))
    origin: Mapped[str] = mapped_column(Text)


class ResearchedAnswer(Base):
    """One entry of an answers file, as written: addressed to a group or a list of codes, and to a
    question by spreadsheet row. Resolution into per-jurisdiction responses stays in the frontend
    (`sourcedAnswers.ts`) until a later phase. `question_row` is not a foreign key on purpose - an
    answer for a dropped row is skipped with a warning there, not rejected here."""

    __tablename__ = "researched_answers"
    __table_args__ = (
        CheckConstraint("(group_name IS NULL) <> (countries IS NULL)", name="one_target"),
        CheckConstraint(_in("basis", BASES), name="basis"),
        CheckConstraint("origin IN ('sourced', 'indicator')", name="origin"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    origin: Mapped[str] = mapped_column(Text)
    position: Mapped[int] = mapped_column(Integer)
    group_name: Mapped[str | None] = mapped_column(Text)
    countries: Mapped[list[str] | None] = mapped_column(ARRAY(Text))
    question_row: Mapped[int] = mapped_column(Integer, index=True)
    score: Mapped[int] = mapped_column(Integer)
    basis: Mapped[str] = mapped_column(Text)
    source_id: Mapped[str] = mapped_column(ForeignKey("sources.id"))
    note: Mapped[str] = mapped_column(Text)


# --- Things people do ---------------------------------------------------------------------------


class Response(Base):
    """A jurisdiction's answer to a question as entered in the app. Takes precedence over any
    researched answer for the same pair; `score IS NULL` records that someone cleared it."""

    __tablename__ = "responses"
    __table_args__ = (CheckConstraint(f"basis IS NULL OR {_in('basis', BASES)}", name="basis"),)

    country_code: Mapped[str] = mapped_column(ForeignKey("jurisdictions.code"), primary_key=True)
    question_id: Mapped[str] = mapped_column(ForeignKey("questions.id"), primary_key=True)
    score: Mapped[int | None] = mapped_column(Integer)
    basis: Mapped[str | None] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_by: Mapped[str] = mapped_column(Text)


class ResponseEvidence(Base):
    __tablename__ = "response_evidence"
    __table_args__ = (
        ForeignKeyConstraint(
            ["country_code", "question_id"],
            ["responses.country_code", "responses.question_id"],
            ondelete="CASCADE",
        ),
    )

    country_code: Mapped[str] = mapped_column(String(16), primary_key=True)
    question_id: Mapped[str] = mapped_column(Text, primary_key=True)
    position: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(Text)
    source: Mapped[str] = mapped_column(Text)
    note: Mapped[str] = mapped_column(Text)


class Suggestion(Base):
    """`Suggestion` in `src/lib/suggestions.ts`. `changes`/`baseline`/`proposed` keep that
    type's JSON shapes as they are."""

    __tablename__ = "suggestions"
    __table_args__ = (CheckConstraint(_in("status", REVIEW_STATUSES), name="status"),)

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    country_code: Mapped[str] = mapped_column(ForeignKey("jurisdictions.code"), index=True)
    submitter_name: Mapped[str] = mapped_column(Text)
    submitter_organisation: Mapped[str] = mapped_column(Text)
    # The signed-in account, once edit mode requires sign-in (Phase 2).
    submitted_by: Mapped[str | None] = mapped_column(Text)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    status: Mapped[str] = mapped_column(Text, server_default="pending")
    changes: Mapped[list] = mapped_column(JSONB)
    baseline: Mapped[list] = mapped_column(JSONB)
    proposed: Mapped[list] = mapped_column(JSONB)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reviewed_by: Mapped[str | None] = mapped_column(Text)


class QuestionProposal(Base):
    """`QuestionProposal` in `src/lib/suggestions.ts`."""

    __tablename__ = "question_proposals"
    __table_args__ = (CheckConstraint(_in("status", REVIEW_STATUSES), name="status"),)

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    section_id: Mapped[str] = mapped_column(ForeignKey("sections.id"))
    text: Mapped[str] = mapped_column(Text)
    strong_label: Mapped[str] = mapped_column(Text)
    developed_label: Mapped[str] = mapped_column(Text)
    weak_label: Mapped[str] = mapped_column(Text)
    reason: Mapped[str] = mapped_column(Text)
    source: Mapped[str] = mapped_column(Text)
    submitter_name: Mapped[str] = mapped_column(Text)
    submitter_organisation: Mapped[str] = mapped_column(Text)
    submitted_by: Mapped[str | None] = mapped_column(Text)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    status: Mapped[str] = mapped_column(Text, server_default="pending")
    # Set once accepted - the question this proposal became.
    question_id: Mapped[str | None] = mapped_column(ForeignKey("questions.id"))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reviewed_by: Mapped[str | None] = mapped_column(Text)


class AuditLog(Base):
    """Every write, with before/after (Phase 6). Imports log one row per run, not per row."""

    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    actor: Mapped[str] = mapped_column(Text)
    entity: Mapped[str] = mapped_column(Text)
    entity_key: Mapped[str] = mapped_column(Text)
    action: Mapped[str] = mapped_column(Text)
    before: Mapped[dict | None] = mapped_column(JSONB)
    after: Mapped[dict | None] = mapped_column(JSONB)
