"""add batch_jobs and batch_items tables and batch_id to reports

Revision ID: b4c5d6e7f8a9
Revises: e3f7a1b2c3d4
Create Date: 2026-10-22 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'b4c5d6e7f8a9'
down_revision: Union[str, None] = 'e3f7a1b2c3d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create batch_jobs table
    op.create_table(
        'batch_jobs',
        sa.Column('batch_id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(length=255), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.user_id', ondelete='SET NULL'), nullable=True),
        sa.Column('agency_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('agencies.agency_id', ondelete='SET NULL'), nullable=True),
        sa.Column(
            'status',
            sa.Enum('PENDING', 'RUNNING', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED', name='batch_status_enum'),
            nullable=False,
            server_default='PENDING',
        ),
        sa.Column('total_files', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('completed_files', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('failed_files', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('concurrency', sa.Integer(), nullable=False, server_default='4'),
        sa.Column('password_map', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('bulk_passwords', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            'source_type',
            sa.Enum('UPLOAD', 'SERVER_PATH', name='batch_source_type_enum'),
            nullable=False,
            server_default='UPLOAD',
        ),
        sa.Column('server_path', sa.String(length=1000), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(op.f('ix_batch_jobs_status'), 'batch_jobs', ['status'], unique=False)
    op.create_index(op.f('ix_batch_jobs_created_at'), 'batch_jobs', ['created_at'], unique=False)

    # 2. Create batch_items table
    op.create_table(
        'batch_items',
        sa.Column('item_id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('batch_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('batch_jobs.batch_id', ondelete='CASCADE'), nullable=False),
        sa.Column('original_filename', sa.String(length=500), nullable=False),
        sa.Column(
            'status',
            sa.Enum('PENDING', 'UPLOADING', 'PIPELINE', 'SUCCESS', 'FAILED', 'SKIPPED', name='batch_item_status_enum'),
            nullable=False,
            server_default='PENDING',
        ),
        sa.Column('detail', sa.String(length=1000), nullable=False, server_default='-'),
        sa.Column('report_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('reports.report_id', ondelete='SET NULL'), nullable=True),
        sa.Column('stored_file_path', sa.String(length=1000), nullable=True),
        sa.Column('is_protected', sa.String(length=50), nullable=True, server_default='Unknown'),
        sa.Column('retry_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(op.f('ix_batch_items_batch_id'), 'batch_items', ['batch_id'], unique=False)
    op.create_index(op.f('ix_batch_items_status'), 'batch_items', ['status'], unique=False)
    op.create_index(op.f('ix_batch_items_report_id'), 'batch_items', ['report_id'], unique=False)

    # 3. Add batch_id to reports
    op.add_column(
        'reports',
        sa.Column('batch_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('batch_jobs.batch_id', ondelete='SET NULL'), nullable=True),
    )
    op.create_index(op.f('ix_reports_batch_id'), 'reports', ['batch_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_reports_batch_id'), table_name='reports')
    op.drop_column('reports', 'batch_id')

    op.drop_index(op.f('ix_batch_items_report_id'), table_name='batch_items')
    op.drop_index(op.f('ix_batch_items_status'), table_name='batch_items')
    op.drop_index(op.f('ix_batch_items_batch_id'), table_name='batch_items')
    op.drop_table('batch_items')

    op.drop_index(op.f('ix_batch_jobs_created_at'), table_name='batch_jobs')
    op.drop_index(op.f('ix_batch_jobs_status'), table_name='batch_jobs')
    op.drop_table('batch_jobs')

    # Drop enums
    op.execute('DROP TYPE IF EXISTS batch_item_status_enum;')
    op.execute('DROP TYPE IF EXISTS batch_source_type_enum;')
    op.execute('DROP TYPE IF EXISTS batch_status_enum;')
