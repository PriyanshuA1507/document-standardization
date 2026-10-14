import uuid
import enum
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import (
    Column, String, Integer, Text, DateTime, ForeignKey, Numeric, Boolean, UniqueConstraint, Index
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.database import Base


class AnomalyRunStatus(str, enum.Enum):
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class AnomalyTier(str, enum.Enum):
    CRITICAL_OUTLIER = "CRITICAL_OUTLIER"
    ELEVATED_OUTLIER = "ELEVATED_OUTLIER"
    SEMANTIC_ANOMALY = "SEMANTIC_ANOMALY"
    METRIC_ANOMALY = "METRIC_ANOMALY"
    NOMINAL_COMPLIANT = "NOMINAL_COMPLIANT"


class AnomalyRun(Base):
    __tablename__ = "anomaly_runs"

    run_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    status = Column(String(50), nullable=False, default=AnomalyRunStatus.QUEUED.value, index=True)
    current_stage = Column(String(100), default="Queued", nullable=False)
    progress_percent = Column(Integer, default=0, nullable=False)

    requested_by = Column(
        UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="SET NULL"), nullable=True
    )

    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True
    )
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    total_reports_evaluated = Column(Integer, default=0, nullable=False)
    anomalies_detected = Column(Integer, default=0, nullable=False)

    parameters = Column(JSONB, nullable=True)
    summary = Column(JSONB, nullable=True)
    fleet_benchmarks = Column(JSONB, nullable=True)
    error_message = Column(Text, nullable=True)

    # Relationships
    user = relationship("User", lazy="joined")
    records = relationship(
        "AnomalyReportRecord",
        back_populates="run",
        cascade="all, delete-orphan",
        lazy="noload"
    )


class AnomalyReportRecord(Base):
    __tablename__ = "anomaly_report_records"

    record_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    run_id = Column(
        UUID(as_uuid=True),
        ForeignKey("anomaly_runs.run_id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    report_id = Column(
        UUID(as_uuid=True),
        ForeignKey("reports.report_id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    is_anomaly = Column(Boolean, nullable=False, default=False, index=True)
    anomaly_tier = Column(String(50), nullable=False, default=AnomalyTier.NOMINAL_COMPLIANT.value, index=True)

    ensemble_score = Column(Numeric(7, 4), nullable=False, index=True)
    iforest_score = Column(Numeric(7, 4), nullable=True)
    ecod_score = Column(Numeric(7, 4), nullable=True)
    embedding_score = Column(Numeric(7, 4), nullable=True)

    primary_drivers = Column(JSONB, nullable=True)
    ecod_attributions = Column(JSONB, nullable=True)
    feature_deviations = Column(JSONB, nullable=True)
    semantic_profile = Column(JSONB, nullable=True)
    record_metadata = Column("metadata", JSONB, nullable=True)

    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    # Relationships
    run = relationship("AnomalyRun", back_populates="records")
    report = relationship("Report", lazy="joined")

    __table_args__ = (
        UniqueConstraint("run_id", "report_id", name="uq_anomaly_run_report"),
        Index("ix_anomaly_run_tier", "run_id", "anomaly_tier"),
    )
