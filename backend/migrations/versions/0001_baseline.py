"""Baseline schema: users, reports, risk_assessments, audit_logs.

Revision ID: 0001_baseline
Revises:
Create Date: 2026-10-21

This is the exact schema of the pre-migration application (`app/models.py`),
so an existing database can be stamped at this revision instead of being
recreated. See README.md -> "Database setup".
"""
from alembic import op
import sqlalchemy as sa

revision = "0001_baseline"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("username", sa.String(length=80), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(length=256), nullable=False),
        sa.Column("salt", sa.String(length=64), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False, server_default="viewer"),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )
    op.create_table(
        "reports",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("case_id", sa.String(length=20), nullable=False, unique=True),
        sa.Column("reporter_type", sa.String(length=20), nullable=False, server_default="victim"),
        sa.Column("contact", sa.String(length=255), nullable=True),
        sa.Column("location", sa.String(length=255), nullable=True),
        sa.Column("incident_date", sa.String(length=50), nullable=True),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="new"),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )
    op.create_table(
        "risk_assessments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("report_id", sa.Integer(), sa.ForeignKey("reports.id", ondelete="CASCADE"),
                   nullable=False, unique=True),
        sa.Column("risk_score", sa.Integer(), nullable=True),
        sa.Column("risk_level", sa.String(length=10), nullable=True),
        sa.Column("abuse_types", sa.JSON(), nullable=True),
        sa.Column("threat_indicators", sa.JSON(), nullable=True),
        sa.Column("ai_summary", sa.Text(), nullable=True),
        sa.Column("ai_available", sa.Boolean(), nullable=True, server_default=sa.true()),
        sa.Column("ai_generated_at", sa.DateTime(), nullable=True),
        sa.Column("human_override", sa.String(length=10), nullable=True),
        sa.Column("override_reason", sa.Text(), nullable=True),
        sa.Column("override_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("override_at", sa.DateTime(), nullable=True),
    )
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("actor_id", sa.Integer(), nullable=True),
        sa.Column("actor_role", sa.String(length=20), nullable=True),
        sa.Column("action", sa.String(length=80), nullable=False),
        sa.Column("report_id", sa.Integer(), nullable=True),
        sa.Column("details", sa.JSON(), nullable=True),
        sa.Column("timestamp", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_reports_case_id", "reports", ["case_id"], unique=True)
    op.create_index("ix_risk_assessments_report_id", "risk_assessments", ["report_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_risk_assessments_report_id", table_name="risk_assessments")
    op.drop_index("ix_reports_case_id", table_name="reports")
    op.drop_table("audit_logs")
    op.drop_table("risk_assessments")
    op.drop_table("reports")
    op.drop_table("users")
