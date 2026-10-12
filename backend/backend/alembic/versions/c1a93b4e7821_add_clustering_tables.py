"""add clustering tables

Revision ID: c1a93b4e7821
Revises: f5a1c2d3e4f6
Create Date: 2026-10-12 15:46:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'c1a93b4e7821'
down_revision: Union[str, None] = 'f5a1c2d3e4f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create clustering_runs table
    op.create_table(
        'clustering_runs',
        sa.Column('run_id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('clustering_type', sa.String(length=50), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='QUEUED'),
        sa.Column('current_stage', sa.String(length=100), nullable=False, server_default='Queued'),
        sa.Column('progress_percent', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('requested_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.user_id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('input_record_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('discovered_cluster_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('noise_record_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('algorithm_version', sa.String(length=100), nullable=False, server_default='HDBSCAN-v1.0'),
        sa.Column('parameters', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('summary', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
    )
    op.create_index(op.f('ix_clustering_runs_clustering_type'), 'clustering_runs', ['clustering_type'], unique=False)
    op.create_index(op.f('ix_clustering_runs_status'), 'clustering_runs', ['status'], unique=False)
    op.create_index(op.f('ix_clustering_runs_created_at'), 'clustering_runs', ['created_at'], unique=False)

    # 2. Create vulnerability_cluster_members table
    op.create_table(
        'vulnerability_cluster_members',
        sa.Column('member_id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('run_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('clustering_runs.run_id', ondelete='CASCADE'), nullable=False),
        sa.Column('cluster_id', sa.Integer(), nullable=False),
        sa.Column('finding_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('detailed_observations.finding_id', ondelete='CASCADE'), nullable=False),
        sa.Column('membership_strength', sa.Numeric(precision=5, scale=4), nullable=True),
        sa.Column('cluster_label', sa.String(length=255), nullable=True),
        sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('run_id', 'finding_id', name='uq_vuln_cluster_run_finding')
    )
    op.create_index(op.f('ix_vulnerability_cluster_members_run_id'), 'vulnerability_cluster_members', ['run_id'], unique=False)
    op.create_index(op.f('ix_vulnerability_cluster_members_cluster_id'), 'vulnerability_cluster_members', ['cluster_id'], unique=False)
    op.create_index(op.f('ix_vulnerability_cluster_members_finding_id'), 'vulnerability_cluster_members', ['finding_id'], unique=False)
    op.create_index('ix_vuln_cluster_run_cluster', 'vulnerability_cluster_members', ['run_id', 'cluster_id'], unique=False)

    # 3. Create report_cluster_members table
    op.create_table(
        'report_cluster_members',
        sa.Column('member_id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('run_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('clustering_runs.run_id', ondelete='CASCADE'), nullable=False),
        sa.Column('cluster_id', sa.Integer(), nullable=False),
        sa.Column('report_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('reports.report_id', ondelete='CASCADE'), nullable=False),
        sa.Column('membership_strength', sa.Numeric(precision=5, scale=4), nullable=True),
        sa.Column('cluster_label', sa.String(length=255), nullable=True),
        sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('run_id', 'report_id', name='uq_report_cluster_run_report')
    )
    op.create_index(op.f('ix_report_cluster_members_run_id'), 'report_cluster_members', ['run_id'], unique=False)
    op.create_index(op.f('ix_report_cluster_members_cluster_id'), 'report_cluster_members', ['cluster_id'], unique=False)
    op.create_index(op.f('ix_report_cluster_members_report_id'), 'report_cluster_members', ['report_id'], unique=False)
    op.create_index('ix_report_cluster_run_cluster', 'report_cluster_members', ['run_id', 'cluster_id'], unique=False)


def downgrade() -> None:
    op.drop_table('report_cluster_members')
    op.drop_table('vulnerability_cluster_members')
    op.drop_table('clustering_runs')

