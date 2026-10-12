"""add trend_analysis_runs table

Revision ID: d2b87f1e9012
Revises: c1a93b4e7821
Create Date: 2026-10-12 16:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'd2b87f1e9012'
down_revision: Union[str, None] = 'c1a93b4e7821'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'trend_analysis_runs',
        sa.Column('run_id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='QUEUED'),
        sa.Column('current_stage', sa.String(length=100), nullable=False, server_default='Queued'),
        sa.Column('progress_percent', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('requested_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.user_id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('parameters', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('summary', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('forecast_results', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('data_readiness', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('warnings', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
    )
    op.create_index(op.f('ix_trend_analysis_runs_status'), 'trend_analysis_runs', ['status'], unique=False)
    op.create_index(op.f('ix_trend_analysis_runs_created_at'), 'trend_analysis_runs', ['created_at'], unique=False)


def downgrade() -> None:
    op.drop_table('trend_analysis_runs')

