import uuid
import enum
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import (
    Column, String, Integer, Text, DateTime, ForeignKey, Index
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.database import Base


class TrendRunStatus(str, enum.Enum):
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class TrendAnalysisRun(Base):
    __tablename__ = "trend_analysis_runs"

    run_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    status = Column(String(50), nullable=False, default=TrendRunStatus.QUEUED.value, index=True)
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

    parameters = Column(JSONB, nullable=True)
    summary = Column(JSONB, nullable=True)
    forecast_results = Column(JSONB, nullable=True)
    data_readiness = Column(JSONB, nullable=True)
    warnings = Column(JSONB, nullable=True)
    error_message = Column(Text, nullable=True)

    # Relationships
    user = relationship("User", lazy="joined")

