import uuid
from datetime import datetime, timezone
import enum

from sqlalchemy import (
    Column, String, Integer, Text, Enum, DateTime, ForeignKey, Index
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.database import Base


class BatchStatus(str, enum.Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    PAUSED = "PAUSED"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class BatchSourceType(str, enum.Enum):
    UPLOAD = "UPLOAD"
    SERVER_PATH = "SERVER_PATH"


class BatchItemStatus(str, enum.Enum):
    PENDING = "PENDING"
    UPLOADING = "UPLOADING"
    PIPELINE = "PIPELINE"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    SKIPPED = "SKIPPED"


class BatchJob(Base):
    __tablename__ = "batch_jobs"

    batch_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=True)
    created_by = Column(
        UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="SET NULL"), nullable=True
    )
    agency_id = Column(
        UUID(as_uuid=True), ForeignKey("agencies.agency_id", ondelete="SET NULL"), nullable=True
    )
    status = Column(
        Enum(BatchStatus, name="batch_status_enum", create_constraint=True),
        default=BatchStatus.PENDING,
        nullable=False,
        index=True,
    )
    total_files = Column(Integer, default=0, nullable=False)
    completed_files = Column(Integer, default=0, nullable=False)
    failed_files = Column(Integer, default=0, nullable=False)
    concurrency = Column(Integer, default=4, nullable=False)
    password_map = Column(JSONB, nullable=True)
    bulk_passwords = Column(JSONB, nullable=True)
    source_type = Column(
        Enum(BatchSourceType, name="batch_source_type_enum", create_constraint=True),
        default=BatchSourceType.UPLOAD,
        nullable=False,
    )
    server_path = Column(String(1000), nullable=True)
    error_message = Column(Text, nullable=True)
    
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True
    )
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    creator = relationship("User", foreign_keys=[created_by], lazy="joined")
    agency = relationship("Agency", foreign_keys=[agency_id], lazy="joined")
    items = relationship(
        "BatchItem",
        back_populates="batch",
        cascade="all, delete-orphan",
        order_by="BatchItem.created_at",
        lazy="selectin",
    )
    reports = relationship(
        "Report",
        back_populates="batch",
        lazy="noload",
    )


class BatchItem(Base):
    __tablename__ = "batch_items"

    item_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    batch_id = Column(
        UUID(as_uuid=True),
        ForeignKey("batch_jobs.batch_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    original_filename = Column(String(500), nullable=False)
    status = Column(
        Enum(BatchItemStatus, name="batch_item_status_enum", create_constraint=True),
        default=BatchItemStatus.PENDING,
        nullable=False,
        index=True,
    )
    detail = Column(String(1000), default="-", nullable=False)
    report_id = Column(
        UUID(as_uuid=True),
        ForeignKey("reports.report_id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    stored_file_path = Column(String(1000), nullable=True)
    is_protected = Column(String(50), default="Unknown", nullable=True)
    retry_count = Column(Integer, default=0, nullable=False)
    error_message = Column(Text, nullable=True)

    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    batch = relationship("BatchJob", back_populates="items")
    report = relationship("Report", foreign_keys=[report_id], lazy="joined")
