from pydantic import BaseModel
from typing import Optional, Any, Dict, List
from datetime import datetime
from uuid import UUID


class AuditLogOut(BaseModel):
    log_id: UUID
    user_id: Optional[UUID] = None
    username: Optional[str] = None
    report_id: Optional[UUID] = None
    action: str
    status: str
    details: Optional[Dict[str, Any]] = None
    created_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_with_user(cls, log):
        username = None
        if log.user:
            username = log.user.username
        elif log.details and isinstance(log.details, dict):
            username = log.details.get("username") or log.details.get("attempted_username")

        return cls(
            log_id=log.log_id,
            user_id=log.user_id,
            username=username or "System",
            report_id=log.report_id,
            action=log.action,
            status=log.status,
            details=log.details or {},
            created_at=log.created_at,
        )


class AuditLogListOut(BaseModel):
    logs: List[AuditLogOut]
    total: int


class SecurityEventOut(BaseModel):
    event_id: UUID
    user_id: Optional[UUID] = None
    severity: str
    event_type: str
    description: Optional[str] = None
    event_metadata: Optional[Dict[str, Any]] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class SecurityEventListOut(BaseModel):
    events: List[SecurityEventOut]
    total: int


class AuditStatsOut(BaseModel):
    total_logs: int
    success_count: int
    failed_count: int
    success_rate: float
    security_alerts_count: int
    action_counts: Dict[str, int]
    activity_today: int
    distinct_operators: int
    recent_security_events: List[Dict[str, Any]] = []


class DashboardStats(BaseModel):
    total_reports: int
    total_users: int
    recent_uploads: List[Dict[str, Any]]
    reports_by_status: Dict[str, int]
    recent_activity: List[Dict[str, Any]] = []
    audit_summary: Optional[Dict[str, Any]] = None
