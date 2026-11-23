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
    # A few words standing in for `text` where space is short; null until someone writes one.
    title: Mapped[str | None] = mapped_column(Text)
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
    # A proposal filed against a section an editor then deletes goes with it; one whose question is
    # later deleted is kept, just no longer linked (migration 0002).
    section_id: Mapped[str] = mapped_column(ForeignKey("sections.id", ondelete="CASCADE"))
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
    question_id: Mapped[str | None] = mapped_column(ForeignKey("questions.id", ondelete="SET NULL"))
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


# --- Deployment Explorer data (schema `deployment`) ---------------------------------------------
#
# The Deployment Explorer's three datasets - `deployment/src/data/ember_solar.json`,
# `ember_generation.json` and `population.json` - entry for entry. They are rebuilt from Ember and
# the World Bank by `deployment/scripts/`, never edited by people, so `ep_db.deployment_import`
# replaces every table here wholesale on each run. Their own schema keeps them apart from the
# policy tables; Alembic's version table stays in `policy`.

DEPLOYMENT_SCHEMA = "deployment"
DEPLOYMENT_DATASETS = ("solar", "generation", "population")


class DeploymentDataset(Base):
    """Each file's own top-level fields: where it came from, when it was fetched, its note."""

    __tablename__ = "datasets"
    __table_args__ = (CheckConstraint(_in("name", DEPLOYMENT_DATASETS), name="name"), {"schema": DEPLOYMENT_SCHEMA})

    name: Mapped[str] = mapped_column(Text, primary_key=True)
    # A URL string, or (ember_solar.json) a {"monthly", "annual"} map of URLs.
    source: Mapped[object] = mapped_column(JSONB)
    fetched_at: Mapped[str] = mapped_column(Text)
    note: Mapped[str] = mapped_column(Text)
    imported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    imported_by: Mapped[str] = mapped_column(Text)


class SolarCountry(Base):
    """A country in `ember_solar.json`; `position` keeps the file's key order."""

    __tablename__ = "solar_countries"
    __table_args__ = (
        CheckConstraint(_in("granularity", ("monthly", "annual")), name="granularity"),
        {"schema": DEPLOYMENT_SCHEMA},
    )

    code: Mapped[str] = mapped_column(String(16), primary_key=True)
    position: Mapped[int] = mapped_column(Integer, unique=True)
    name: Mapped[str] = mapped_column(Text)
    granularity: Mapped[str] = mapped_column(Text)


class SolarMonthly(Base):
    """Installed solar capacity (GW) by month, for a `monthly` country."""

    __tablename__ = "solar_monthly"
    __table_args__ = (CheckConstraint("month BETWEEN 1 AND 12", name="month"), {"schema": DEPLOYMENT_SCHEMA})

    code: Mapped[str] = mapped_column(ForeignKey("deployment.solar_countries.code", ondelete="CASCADE"), primary_key=True)
    year: Mapped[int] = mapped_column(Integer, primary_key=True)
    month: Mapped[int] = mapped_column(Integer, primary_key=True)
    gw: Mapped[float] = mapped_column(Float)


class SolarAnnual(Base):
    """Installed solar capacity (GW) by year, for an `annual` country."""

    __tablename__ = "solar_annual"
    __table_args__ = {"schema": DEPLOYMENT_SCHEMA}

    code: Mapped[str] = mapped_column(ForeignKey("deployment.solar_countries.code", ondelete="CASCADE"), primary_key=True)
    year: Mapped[int] = mapped_column(Integer, primary_key=True)
    gw: Mapped[float] = mapped_column(Float)


class GenerationCountry(Base):
    """A country in `ember_generation.json`."""

    __tablename__ = "generation_countries"
    __table_args__ = {"schema": DEPLOYMENT_SCHEMA}

    code: Mapped[str] = mapped_column(String(16), primary_key=True)
    position: Mapped[int] = mapped_column(Integer, unique=True)
    name: Mapped[str] = mapped_column(Text)


class GenerationYearly(Base):
    """Solar and total generation (TWh) and solar's share (%) by year, as Ember reports them."""

    __tablename__ = "generation_yearly"
    __table_args__ = {"schema": DEPLOYMENT_SCHEMA}

    code: Mapped[str] = mapped_column(ForeignKey("deployment.generation_countries.code", ondelete="CASCADE"), primary_key=True)
    year: Mapped[int] = mapped_column(Integer, primary_key=True)
    solar_twh: Mapped[float] = mapped_column(Float)
    total_twh: Mapped[float] = mapped_column(Float)
    share_pct: Mapped[float] = mapped_column(Float)


class Population(Base):
    """`population.json`: the latest population per country; `source` only where hand-added."""

    __tablename__ = "population"
    __table_args__ = {"schema": DEPLOYMENT_SCHEMA}

    code: Mapped[str] = mapped_column(String(16), primary_key=True)
    position: Mapped[int] = mapped_column(Integer, unique=True)
    name: Mapped[str] = mapped_column(Text)
    population_millions: Mapped[float] = mapped_column(Float)
    year: Mapped[int] = mapped_column(Integer)
    source: Mapped[str | None] = mapped_column(Text)


# --- Solar Homes Calculator data (schema `calculator`) ------------------------------------------
#
# `calculator/src/data/country-irradiance.json`, `country-self-sufficiency.json` and
# `pc1-demand-profile.json`, entry for entry, loaded by `ep_db.calculator_import` (which replaces
# them wholesale - `calculator/scripts/` regenerates them; nobody edits them). The irradiance file
# is 10.7 MB because each country carries 8760 hourly values; keeping them in rows lets the API
# hand the browser one country's profile instead of all of them.

CALCULATOR_SCHEMA = "calculator"


class CountryIrradianceRow(Base):
    """One country's representative point, panel orientation and 8760-hour W/Wp profile (UTC)."""

    __tablename__ = "irradiance"
    __table_args__ = {"schema": CALCULATOR_SCHEMA}

    code: Mapped[str] = mapped_column(String(16), primary_key=True)
    position: Mapped[int] = mapped_column(Integer, unique=True)
    lat: Mapped[float] = mapped_column(Float)
    lon: Mapped[float] = mapped_column(Float)
    tilt_deg: Mapped[int] = mapped_column(Integer)
    azimuth_deg: Mapped[int] = mapped_column(Integer)
    # The profile's sum, worked out at import the same way the browser sums it (left to right, in
    # float64), so the map and league table can show it without downloading the profile.
    annual_kwh_per_kwp: Mapped[float] = mapped_column(Float)
    profile_w_per_wp: Mapped[list[float]] = mapped_column(ARRAY(Float))


class SelfSufficiencyRow(Base):
    """Precomputed self-sufficiency (%) for the low/medium/high system tiers."""

    __tablename__ = "self_sufficiency"
    __table_args__ = {"schema": CALCULATOR_SCHEMA}

    code: Mapped[str] = mapped_column(String(16), primary_key=True)
    position: Mapped[int] = mapped_column(Integer, unique=True)
    low: Mapped[int] = mapped_column(Integer)
    medium: Mapped[int] = mapped_column(Integer)
    high: Mapped[int] = mapped_column(Integer)


class DemandProfileRow(Base):
    """A normalised 8760-hour demand shape (fractions summing to 1). Only `pc1` today."""

    __tablename__ = "demand_profiles"
    __table_args__ = {"schema": CALCULATOR_SCHEMA}

    name: Mapped[str] = mapped_column(Text, primary_key=True)
    profile: Mapped[list[float]] = mapped_column(ARRAY(Float))
