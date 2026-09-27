"""initial schema: invoices, invoice_items, jobs

Revision ID: 0001
Revises:
"""
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

JSON_TYPE = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")


def upgrade() -> None:
    op.create_table(
        "invoices",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("storage_path", sa.String(512), nullable=False),
        sa.Column("content_type", sa.String(100), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("vendor", sa.String(255)),
        sa.Column("invoice_number", sa.String(100)),
        sa.Column("invoice_date", sa.Date()),
        sa.Column("currency", sa.String(8)),
        sa.Column("subtotal", sa.Numeric(14, 2)),
        sa.Column("tax", sa.Numeric(14, 2)),
        sa.Column("total", sa.Numeric(14, 2)),
        sa.Column("issues", JSON_TYPE, nullable=False),
        sa.Column("is_duplicate", sa.Boolean(), nullable=False),
        sa.Column("error", sa.Text()),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_invoices_user_id", "invoices", ["user_id"])
    op.create_index("ix_invoices_status", "invoices", ["status"])
    op.create_index("ix_invoices_dupe", "invoices", ["user_id", "vendor", "invoice_number"])

    op.create_table(
        "invoice_items",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("invoice_id", sa.Uuid(), sa.ForeignKey("invoices.id", ondelete="CASCADE"),
                  nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("description", sa.String(500)),
        sa.Column("quantity", sa.Numeric(14, 3)),
        sa.Column("unit_price", sa.Numeric(14, 2)),
        sa.Column("amount", sa.Numeric(14, 2)),
    )
    op.create_index("ix_invoice_items_invoice_id", "invoice_items", ["invoice_id"])

    op.create_table(
        "jobs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("invoice_id", sa.Uuid(), sa.ForeignKey("invoices.id", ondelete="CASCADE"),
                  nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("run_at", sa.DateTime(), nullable=False),
        sa.Column("locked_at", sa.DateTime()),
        sa.Column("last_error", sa.Text()),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_jobs_invoice_id", "jobs", ["invoice_id"])
    op.create_index("ix_jobs_claim", "jobs", ["status", "run_at"])


def downgrade() -> None:
    op.drop_table("jobs")
    op.drop_table("invoice_items")
    op.drop_table("invoices")
