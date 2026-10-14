"""add report_images table

Revision ID: a3b4c5d6e7f8
Revises: d2b87f1e9012
Create Date: 2026-10-14 15:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

# revision identifiers, used by Alembic.
revision: str = 'a3b4c5d6e7f8'
down_revision: Union[str, None] = 'd2b87f1e9012'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'report_images',
        sa.Column('image_id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('report_id', UUID(as_uuid=True), sa.ForeignKey('reports.report_id', ondelete='CASCADE'), nullable=False),

        # Image identity & tag
        sa.Column('tag', sa.Text(), nullable=False, server_default=''),
        sa.Column('page', sa.SmallInteger(), nullable=False),
        sa.Column('figure', sa.SmallInteger(), nullable=False, server_default='0'),

        # Storage location
        sa.Column('sha256', sa.String(64), nullable=False),
        sa.Column('seaweed_path', sa.String(500), nullable=False),

        # Image metadata
        sa.Column('format', sa.String(10), nullable=False),
        sa.Column('width', sa.Integer(), nullable=False),
        sa.Column('height', sa.Integer(), nullable=False),
        sa.Column('bbox', JSONB(), nullable=True),
        sa.Column('file_size', sa.Integer(), nullable=True),

        # Classification
        sa.Column('is_figure', sa.Boolean(), nullable=False, server_default='true'),

        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
    )
    op.create_index('idx_report_images_report', 'report_images', ['report_id'])
    op.create_index('idx_report_images_sha256', 'report_images', ['sha256'])


def downgrade() -> None:
    op.drop_index('idx_report_images_sha256', table_name='report_images')
    op.drop_index('idx_report_images_report', table_name='report_images')
    op.drop_table('report_images')
