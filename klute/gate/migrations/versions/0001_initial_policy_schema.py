"""initial policy schema

Revision ID: 0001
Revises: 
Create Date: 2026-10-21 14:54:36.424684
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS policy")
    op.create_table('audit_log',
    sa.Column('id', sa.BigInteger(), nullable=False),
    sa.Column('at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('actor', sa.Text(), nullable=False),
    sa.Column('entity', sa.Text(), nullable=False),
    sa.Column('entity_key', sa.Text(), nullable=False),
    sa.Column('action', sa.Text(), nullable=False),
    sa.Column('before', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('after', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_audit_log')),
    schema='policy'
    )
    op.create_index(op.f('ix_audit_log_at'), 'audit_log', ['at'], unique=False, schema='policy')
    op.create_table('jurisdiction_groups',
    sa.Column('group_name', sa.Text(), nullable=False),
    sa.Column('position', sa.Integer(), nullable=False),
    sa.Column('code', sa.String(length=16), nullable=False),
    sa.Column('origin', sa.Text(), nullable=False),
    sa.CheckConstraint("origin IN ('sourced', 'indicator')", name=op.f('ck_jurisdiction_groups_origin')),
    sa.PrimaryKeyConstraint('group_name', 'position', name=op.f('pk_jurisdiction_groups')),
    schema='policy'
    )
    op.create_table('jurisdictions',
    sa.Column('code', sa.String(length=16), nullable=False),
    sa.Column('name', sa.Text(), nullable=False),
    sa.Column('level', sa.Text(), nullable=False),
    sa.Column('parent', sa.String(length=16), nullable=True),
    sa.Column('region', sa.Text(), nullable=True),
    sa.Column('mappable', sa.Boolean(), nullable=False),
    sa.Column('position', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['parent'], ['policy.jurisdictions.code'], name=op.f('fk_jurisdictions_parent')),
    sa.PrimaryKeyConstraint('code', name=op.f('pk_jurisdictions')),
    schema='policy'
    )
    op.create_index(op.f('ix_jurisdictions_parent'), 'jurisdictions', ['parent'], unique=False, schema='policy')
    op.create_table('protocol',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('title', sa.Text(), nullable=False),
    sa.Column('source', sa.Text(), nullable=False),
    sa.Column('max_score', sa.Integer(), nullable=False),
    sa.Column('completeness_threshold', sa.Float(), nullable=False),
    sa.Column('glossary', sa.ARRAY(sa.Text()), nullable=False),
    sa.CheckConstraint('id = 1', name=op.f('ck_protocol_single_row')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_protocol')),
    schema='policy'
    )
    op.create_table('protocol_countries',
    sa.Column('code', sa.String(length=16), nullable=False),
    sa.Column('name', sa.Text(), nullable=False),
    sa.Column('position', sa.Integer(), nullable=False),
    sa.PrimaryKeyConstraint('code', name=op.f('pk_protocol_countries')),
    schema='policy'
    )
    op.create_table('sections',
    sa.Column('id', sa.Text(), nullable=False),
    sa.Column('title', sa.Text(), nullable=False),
    sa.Column('sort_order', sa.Integer(), nullable=False),
    sa.Column('source_row', sa.Integer(), nullable=True),
    sa.Column('position', sa.Integer(), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_sections')),
    schema='policy'
    )
    op.create_table('sources',
    sa.Column('id', sa.Text(), nullable=False),
    sa.Column('title', sa.Text(), nullable=False),
    sa.Column('url', sa.Text(), nullable=False),
    sa.Column('quality', sa.Text(), nullable=True),
    sa.Column('origin', sa.Text(), nullable=False),
    sa.Column('position', sa.Integer(), nullable=False),
    sa.CheckConstraint("origin IN ('sourced', 'indicator')", name=op.f('ck_sources_origin')),
    sa.CheckConstraint("quality IN ('primary-official', 'secondary')", name=op.f('ck_sources_quality')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_sources')),
    schema='policy'
    )
    op.create_table('questions',
    sa.Column('id', sa.Text(), nullable=False),
    sa.Column('section_id', sa.Text(), nullable=False),
    sa.Column('subsection', sa.Text(), nullable=True),
    sa.Column('sort_order', sa.Integer(), nullable=False),
    sa.Column('text', sa.Text(), nullable=False),
    sa.Column('weight', sa.Float(), nullable=False),
    sa.Column('source_row', sa.Integer(), nullable=True),
    sa.Column('position', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['section_id'], ['policy.sections.id'], name=op.f('fk_questions_section_id')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_questions')),
    sa.UniqueConstraint('source_row', name=op.f('uq_questions_source_row')),
    schema='policy'
    )
    op.create_index(op.f('ix_questions_section_id'), 'questions', ['section_id'], unique=False, schema='policy')
    op.create_table('researched_answers',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('origin', sa.Text(), nullable=False),
    sa.Column('position', sa.Integer(), nullable=False),
    sa.Column('group_name', sa.Text(), nullable=True),
    sa.Column('countries', sa.ARRAY(sa.Text()), nullable=True),
    sa.Column('question_row', sa.Integer(), nullable=False),
    sa.Column('score', sa.Integer(), nullable=False),
    sa.Column('basis', sa.Text(), nullable=False),
    sa.Column('source_id', sa.Text(), nullable=False),
    sa.Column('note', sa.Text(), nullable=False),
    sa.CheckConstraint("basis IN ('national', 'directive-baseline', 'proxy-indicator')", name=op.f('ck_researched_answers_basis')),
    sa.CheckConstraint("origin IN ('sourced', 'indicator')", name=op.f('ck_researched_answers_origin')),
    sa.CheckConstraint('(group_name IS NULL) <> (countries IS NULL)', name=op.f('ck_researched_answers_one_target')),
    sa.ForeignKeyConstraint(['source_id'], ['policy.sources.id'], name=op.f('fk_researched_answers_source_id')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_researched_answers')),
    schema='policy'
    )
    op.create_index(op.f('ix_researched_answers_question_row'), 'researched_answers', ['question_row'], unique=False, schema='policy')
    op.create_table('suggestions',
    sa.Column('id', sa.Text(), nullable=False),
    sa.Column('country_code', sa.String(length=16), nullable=False),
    sa.Column('submitter_name', sa.Text(), nullable=False),
    sa.Column('submitter_organisation', sa.Text(), nullable=False),
    sa.Column('submitted_by', sa.Text(), nullable=True),
    sa.Column('submitted_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('status', sa.Text(), server_default='pending', nullable=False),
    sa.Column('changes', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('baseline', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('proposed', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('reviewed_by', sa.Text(), nullable=True),
    sa.CheckConstraint("status IN ('pending', 'accepted', 'rejected')", name=op.f('ck_suggestions_status')),
    sa.ForeignKeyConstraint(['country_code'], ['policy.jurisdictions.code'], name=op.f('fk_suggestions_country_code')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_suggestions')),
    schema='policy'
    )
    op.create_index(op.f('ix_suggestions_country_code'), 'suggestions', ['country_code'], unique=False, schema='policy')
    op.create_table('question_proposals',
    sa.Column('id', sa.Text(), nullable=False),
    sa.Column('section_id', sa.Text(), nullable=False),
    sa.Column('text', sa.Text(), nullable=False),
    sa.Column('strong_label', sa.Text(), nullable=False),
    sa.Column('developed_label', sa.Text(), nullable=False),
    sa.Column('weak_label', sa.Text(), nullable=False),
    sa.Column('reason', sa.Text(), nullable=False),
    sa.Column('source', sa.Text(), nullable=False),
    sa.Column('submitter_name', sa.Text(), nullable=False),
    sa.Column('submitter_organisation', sa.Text(), nullable=False),
    sa.Column('submitted_by', sa.Text(), nullable=True),
    sa.Column('submitted_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('status', sa.Text(), server_default='pending', nullable=False),
    sa.Column('question_id', sa.Text(), nullable=True),
    sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('reviewed_by', sa.Text(), nullable=True),
    sa.CheckConstraint("status IN ('pending', 'accepted', 'rejected')", name=op.f('ck_question_proposals_status')),
    sa.ForeignKeyConstraint(['question_id'], ['policy.questions.id'], name=op.f('fk_question_proposals_question_id')),
    sa.ForeignKeyConstraint(['section_id'], ['policy.sections.id'], name=op.f('fk_question_proposals_section_id')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_question_proposals')),
    schema='policy'
    )
    op.create_table('responses',
    sa.Column('country_code', sa.String(length=16), nullable=False),
    sa.Column('question_id', sa.Text(), nullable=False),
    sa.Column('score', sa.Integer(), nullable=True),
    sa.Column('basis', sa.Text(), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_by', sa.Text(), nullable=False),
    sa.CheckConstraint("basis IS NULL OR basis IN ('national', 'directive-baseline', 'proxy-indicator')", name=op.f('ck_responses_basis')),
    sa.ForeignKeyConstraint(['country_code'], ['policy.jurisdictions.code'], name=op.f('fk_responses_country_code')),
    sa.ForeignKeyConstraint(['question_id'], ['policy.questions.id'], name=op.f('fk_responses_question_id')),
    sa.PrimaryKeyConstraint('country_code', 'question_id', name=op.f('pk_responses')),
    schema='policy'
    )
    op.create_table('rubric_tiers',
    sa.Column('question_id', sa.Text(), nullable=False),
    sa.Column('score', sa.Integer(), nullable=False),
    sa.Column('label', sa.Text(), nullable=False),
    sa.Column('points', sa.Float(), nullable=False),
    sa.Column('position', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['question_id'], ['policy.questions.id'], name=op.f('fk_rubric_tiers_question_id'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('question_id', 'score', name=op.f('pk_rubric_tiers')),
    schema='policy'
    )
    op.create_table('response_evidence',
    sa.Column('country_code', sa.String(length=16), nullable=False),
    sa.Column('question_id', sa.Text(), nullable=False),
    sa.Column('position', sa.Integer(), nullable=False),
    sa.Column('title', sa.Text(), nullable=False),
    sa.Column('source', sa.Text(), nullable=False),
    sa.Column('note', sa.Text(), nullable=False),
    sa.ForeignKeyConstraint(['country_code', 'question_id'], ['policy.responses.country_code', 'policy.responses.question_id'], name=op.f('fk_response_evidence_country_code'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('country_code', 'question_id', 'position', name=op.f('pk_response_evidence')),
    schema='policy'
    )


def downgrade() -> None:
    op.drop_table('response_evidence', schema='policy')
    op.drop_table('rubric_tiers', schema='policy')
    op.drop_table('responses', schema='policy')
    op.drop_table('question_proposals', schema='policy')
    op.drop_index(op.f('ix_suggestions_country_code'), table_name='suggestions', schema='policy')
    op.drop_table('suggestions', schema='policy')
    op.drop_index(op.f('ix_researched_answers_question_row'), table_name='researched_answers', schema='policy')
    op.drop_table('researched_answers', schema='policy')
    op.drop_index(op.f('ix_questions_section_id'), table_name='questions', schema='policy')
    op.drop_table('questions', schema='policy')
    op.drop_table('sources', schema='policy')
    op.drop_table('sections', schema='policy')
    op.drop_table('protocol_countries', schema='policy')
    op.drop_table('protocol', schema='policy')
    op.drop_index(op.f('ix_jurisdictions_parent'), table_name='jurisdictions', schema='policy')
    op.drop_table('jurisdictions', schema='policy')
    op.drop_table('jurisdiction_groups', schema='policy')
    op.drop_index(op.f('ix_audit_log_at'), table_name='audit_log', schema='policy')
    op.drop_table('audit_log', schema='policy')
