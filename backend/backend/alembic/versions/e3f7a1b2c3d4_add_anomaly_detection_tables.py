"""add anomaly_runs and anomaly_report_records tables

Revision ID: e3f7a1b2c3d4
Revises: a3b4c5d6e7f8
Create Date: 2026-10-14 16:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'e3f7a1b2c3d4'
down_revision: Union[str, None] = 'a3b4c5d6e7f8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'anomaly_runs',
        sa.Column('run_id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='QUEUED'),
        sa.Column('current_stage', sa.String(length=100), nullable=False, server_default='Queued'),
        sa.Column('progress_percent', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('requested_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.user_id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('total_reports_evaluated', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('anomalies_detected', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('parameters', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('summary', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('fleet_benchmarks', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
    )
    op.create_index(op.f('ix_anomaly_runs_status'), 'anomaly_runs', ['status'], unique=False)
    op.create_index(op.f('ix_anomaly_runs_created_at'), 'anomaly_runs', ['created_at'], unique=False)

    op.create_table(
        'anomaly_report_records',
        sa.Column('record_id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('run_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('anomaly_runs.run_id', ondelete='CASCADE'), nullable=False),
        sa.Column('report_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('reports.report_id', ondelete='CASCADE'), nullable=False),
        sa.Column('is_anomaly', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('anomaly_tier', sa.String(length=50), nullable=False, server_default='NOMINAL_COMPLIANT'),
        sa.Column('ensemble_score', sa.Numeric(precision=7, scale=4), nullable=False),
        sa.Column('iforest_score', sa.Numeric(precision=7, scale=4), nullable=True),
        sa.Column('ecod_score', sa.Numeric(precision=7, scale=4), nullable=True),
        sa.Column('embedding_score', sa.Numeric(precision=7, scale=4), nullable=True),
        sa.Column('primary_drivers', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('ecod_attributions', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('feature_deviations', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('semantic_profile', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('run_id', 'report_id', name='uq_anomaly_run_report'),
    )
    op.create_index(op.f('ix_anomaly_report_records_run_id'), 'anomaly_report_records', ['run_id'], unique=False)
    op.create_index(op.f('ix_anomaly_report_records_report_id'), 'anomaly_report_records', ['report_id'], unique=False)
    op.create_index(op.f('ix_anomaly_report_records_is_anomaly'), 'anomaly_report_records', ['is_anomaly'], unique=False)
    op.create_index(op.f('ix_anomaly_report_records_anomaly_tier'), 'anomaly_report_records', ['anomaly_tier'], unique=False)
    op.create_index(op.f('ix_anomaly_report_records_ensemble_score'), 'anomaly_report_records', ['ensemble_score'], unique=False)
    op.create_index('ix_anomaly_run_tier', 'anomaly_report_records', ['run_id', 'anomaly_tier'], unique=False)


def downgrade() -> None:
    op.drop_table('anomaly_report_records')
    op.drop_table('anomaly_runs')
