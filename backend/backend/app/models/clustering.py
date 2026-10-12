import uuid
import enum
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import (
    Column, String, Integer, Text, DateTime, ForeignKey, Numeric, UniqueConstraint, Index
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.database import Base


class ClusteringType(str, enum.Enum):
    VULNERABILITY = "VULNERABILITY"
    REPORT = "REPORT"


class RunStatus(str, enum.Enum):
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class ClusteringRun(Base):
    __tablename__ = "clustering_runs"

    run_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    clustering_type = Column(String(50), nullable=False, index=True)
    status = Column(String(50), nullable=False, default=RunStatus.QUEUED.value, index=True)
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
    
    input_record_count = Column(Integer, default=0, nullable=False)
    discovered_cluster_count = Column(Integer, default=0, nullable=False)
    noise_record_count = Column(Integer, default=0, nullable=False)
    algorithm_version = Column(String(100), default="HDBSCAN-v1.0", nullable=False)
    
    parameters = Column(JSONB, nullable=True)
    summary = Column(JSONB, nullable=True)
    error_message = Column(Text, nullable=True)

    # Relationships
    user = relationship("User", lazy="joined")
    vulnerability_members = relationship(
        "VulnerabilityClusterMember",
        back_populates="run",
        cascade="all, delete-orphan",
        lazy="noload"
    )
    report_members = relationship(
        "ReportClusterMember",
        back_populates="run",
        cascade="all, delete-orphan",
        lazy="noload"
    )


class VulnerabilityClusterMember(Base):
    __tablename__ = "vulnerability_cluster_members"

    member_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    run_id = Column(
        UUID(as_uuid=True),
        ForeignKey("clustering_runs.run_id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    cluster_id = Column(Integer, nullable=False, index=True)  # -1 represents Noise
    finding_id = Column(
        UUID(as_uuid=True),
        ForeignKey("detailed_observations.finding_id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    membership_strength = Column(Numeric(5, 4), nullable=True)
    cluster_label = Column(String(255), nullable=True)
    member_metadata = Column("metadata", JSONB, nullable=True)
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    # Relationships
    run = relationship("ClusteringRun", back_populates="vulnerability_members")
    observation = relationship("DetailedObservation", lazy="joined")

    __table_args__ = (
        UniqueConstraint("run_id", "finding_id", name="uq_vuln_cluster_run_finding"),
        Index("ix_vuln_cluster_run_cluster", "run_id", "cluster_id"),
    )


class ReportClusterMember(Base):
    __tablename__ = "report_cluster_members"

    member_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    run_id = Column(
        UUID(as_uuid=True),
        ForeignKey("clustering_runs.run_id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    cluster_id = Column(Integer, nullable=False, index=True)  # -1 represents Noise
    report_id = Column(
        UUID(as_uuid=True),
        ForeignKey("reports.report_id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    membership_strength = Column(Numeric(5, 4), nullable=True)
    cluster_label = Column(String(255), nullable=True)
    member_metadata = Column("metadata", JSONB, nullable=True)
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    # Relationships
    run = relationship("ClusteringRun", back_populates="report_members")
    report = relationship("Report", lazy="joined")

    __table_args__ = (
        UniqueConstraint("run_id", "report_id", name="uq_report_cluster_run_report"),
        Index("ix_report_cluster_run_cluster", "run_id", "cluster_id"),
    )

