import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_roles, get_current_user
from app.models.audit import SecurityEvent
from app.models.user import User
from app.schemas.audit import (
    AuditLogOut,
    AuditLogListOut,
    DashboardStats,
    AuditStatsOut,
    SecurityEventOut,
    SecurityEventListOut,
)
from app.services import audit_service

router = APIRouter(prefix="/api", tags=["Audit Logs"])


@router.get("/audit-logs", response_model=AuditLogListOut)
async def list_audit_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    action: Optional[str] = Query(None),
    user_id: Optional[uuid.UUID] = Query(None),
    report_id: Optional[uuid.UUID] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    current_user: User = Depends(require_roles("ADMIN", "AUDITOR")),
    db: AsyncSession = Depends(get_db),
):
    """List audit logs with comprehensive multi-criteria filtering and full-text search."""
    logs, total = await audit_service.get_audit_logs(
        db,
        skip=skip,
        limit=limit,
        action=action,
        user_id=user_id,
        report_id=report_id,
        status=status,
        search=search,
        category=category,
        start_date=start_date,
        end_date=end_date,
    )
    return AuditLogListOut(
        logs=[AuditLogOut.from_orm_with_user(log) for log in logs],
        total=total,
    )


@router.get("/audit-logs/stats", response_model=AuditStatsOut)
async def get_audit_stats(
    current_user: User = Depends(require_roles("ADMIN", "AUDITOR")),
    db: AsyncSession = Depends(get_db),
):
    """Get high-level summary KPIs and security metrics for the audit operations center."""
    stats = await audit_service.get_audit_stats(db)
    return AuditStatsOut(**stats)


@router.get("/audit-logs/security-events", response_model=SecurityEventListOut)
async def list_security_events(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    severity: Optional[str] = Query(None),
    current_user: User = Depends(require_roles("ADMIN", "AUDITOR")),
    db: AsyncSession = Depends(get_db),
):
    """List forensic security alert events."""
    query = select(SecurityEvent)
    count_query = select(func.count(SecurityEvent.event_id))

    if severity and severity.upper() != "ALL":
        query = query.where(SecurityEvent.severity == severity.upper())
        count_query = count_query.where(SecurityEvent.severity == severity.upper())

    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0

    result = await db.execute(
        query.order_by(desc(SecurityEvent.created_at)).offset(skip).limit(limit)
    )
    events = result.scalars().all()

    return SecurityEventListOut(
        events=[
            SecurityEventOut(
                event_id=e.event_id,
                user_id=e.user_id,
                severity=e.severity,
                event_type=e.event_type,
                description=e.description,
                event_metadata=e.event_metadata,
                created_at=e.created_at,
            )
            for e in events
        ],
        total=total,
    )


@router.get("/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get dashboard statistics including live system activity stream."""
    stats = await audit_service.get_dashboard_stats(db)
    return DashboardStats(**stats)
