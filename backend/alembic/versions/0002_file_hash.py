"""add invoices.file_hash for exact-file duplicate detection

Revision ID: 0002
Revises: 0001
"""
import sqlalchemy as sa

from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("invoices", sa.Column("file_hash", sa.String(64), nullable=True))
    op.create_index("ix_invoices_file_hash", "invoices", ["user_id", "file_hash"])


def downgrade() -> None:
    op.drop_index("ix_invoices_file_hash", table_name="invoices")
    op.drop_column("invoices", "file_hash")
